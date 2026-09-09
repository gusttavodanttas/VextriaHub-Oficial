import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  tribunalFromCNJ, extractPartes, decodeHtmlEntities,
  classifyFase, classifyInstancia, summarize, extractMovs, parseDataAjuizamento,
} from "./_shared/processoParsing.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const PUBLIC_DATAJUD_KEY = "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";

// ============================================================================
// MAPEAMENTO DE TRIBUNAIS POR UF
// ============================================================================
const UF_TO_TRIBUNAL: Record<string, string> = {
  "AC": "tjac", "AL": "tjal", "AM": "tjam", "AP": "tjap", "BA": "tjba",
  "CE": "tjce", "DF": "tjdft", "ES": "tjes", "GO": "tjgo", "MA": "tjma",
  "MG": "tjmg", "MS": "tjms", "MT": "tjmt", "PA": "tjpa", "PB": "tjpb",
  "PE": "tjpe", "PI": "tjpi", "PR": "tjpr", "RJ": "tjrj", "RN": "tjrn",
  "RO": "tjro", "RR": "tjrr", "RS": "tjrs", "SC": "tjsc", "SE": "tjse",
  "SP": "tjsp", "TO": "tjto",
};

// Alguns tribunais (ex: TJDFT) gravam "?" no lugar de acentos perdidos na
// própria base do CNJ. Não dá pra recuperar o byte original, então corrigimos
// os termos jurídicos/topônimos mais frequentes por heurística.
function fixAccents(s: string | null | undefined): string {
  if (!s || !s.includes("?")) return s || "";
  let r = s;
  // Ordinais: dígito seguido de "?" => º  (ex: "2?" => "2º")
  r = r.replace(/(\d)\?/g, "$1º");
  const dict: Array<[RegExp, string]> = [
    [/\bC\?VEL\b/gi, "CÍVEL"],
    [/\bCRIMINAL\b/gi, "CRIMINAL"],
    [/\bFAM\?LIA\b/gi, "FAMÍLIA"],
    [/\?RF\?OS/gi, "ÓRFÃOS"], // sem \b inicial: "?" não é char de palavra, então \b antes do "?" nunca casa (bug)
    [/\bSUCESS\?ES\b/gi, "SUCESSÕES"],
    [/\bEXECU\?\?O\b/gi, "EXECUÇÃO"],
    [/\bEXECU\?\?ES\b/gi, "EXECUÇÕES"],
    [/\bFAL\?NCIA[S]?\b/gi, "FALÊNCIA"],
    [/\bF\?RUM\b/gi, "FÓRUM"],
    [/\bREGI\?O\b/gi, "REGIÃO"],
    [/\bPREVID\?NCIA\b/gi, "PREVIDÊNCIA"],
    [/\bBRAS\?LIA\b/gi, "BRASÍLIA"],
    [/\bTRIBUTA\?\?O\b/gi, "TRIBUTAÇÃO"],
    [/\bINF\?NCIA\b/gi, "INFÂNCIA"],
    [/\bJUVENTUDE\b/gi, "JUVENTUDE"],
  ];
  for (const [re, v] of dict) r = r.replace(re, v);
  return r;
}

// DataJud só fornece o código IBGE do município (ex: "5300108"), não o nome.
// Resolve via API pública do IBGE -> "Brasília/DF". Em caso de falha, mantém o código.
async function resolveMunicipio(codigo: string): Promise<string> {
  if (!codigo || !/^\d+$/.test(codigo)) return codigo || "";
  try {
    const r = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${codigo}`);
    if (r.ok) {
      const m = await r.json();
      const nome = m?.nome;
      const uf = m?.microrregiao?.mesorregiao?.UF?.sigla
        || m?.regiao_imediata?.regiao_intermediaria?.UF?.sigla;
      if (nome) return uf ? `${nome}/${uf}` : nome;
    }
  } catch (_) { /* mantém o código */ }
  return codigo;
}

function enrichMovText(a: any): string {
  const base = a?.descricao ?? a?.titulo ?? a?.nome ?? a?.texto ?? "";
  const compls: any[] = Array.isArray(a?.complementosTabelados) ? a.complementosTabelados : [];
  if (!compls.length) return base;
  const detalhes = compls.map((c) => c?.nome).filter(Boolean).join(", ");
  return detalhes ? `${base} (${detalhes})` : base;
}

function buildAndamentos(rawMovs: any[]): Array<{ data: string | null; resumo: string; descricao: string; fase: string }> {
  if (!Array.isArray(rawMovs)) return [];
  return rawMovs
    .slice(0, 100)
    .map((a: any) => {
      const texto = enrichMovText(a);
      const dataRaw = a?.dataHora ?? a?.data ?? a?.dt ?? null;
      return {
        data: dataRaw,
        resumo: summarize(texto, 600),
        descricao: summarize(texto, 3000),
        fase: classifyFase(texto),
      };
    })
    .filter((a) => a.descricao.length > 0)
    .sort((a, b) => {
      const da = a.data ? new Date(a.data).getTime() : 0;
      const db = b.data ? new Date(b.data).getTime() : 0;
      return db - da;
    });
}

// ============================================================================
// MAPPER PADRONIZADO (mesmo shape do fetch-by-oab)
// ============================================================================
function mapDatajudHit(hit: any, tribunalSigla?: string) {
  const source = hit?._source;
  if (!source) return null;

  const autoresList: string[] = [];
  const reusList: string[] = [];
  for (const p of (source.partes || [])) {
    const nome = p.nome || p.pessoa?.nome || "";
    if (!nome || nome.length < 3) continue;
    const tipo = String(p.tipo || p.tipoParte || "").toLowerCase();
    const polo = p.polo || p.poloParte;
    if (tipo.includes("ativ") || tipo.includes("autor") || polo === 1 || polo === "1" || polo === "AT") {
      if (!autoresList.includes(nome)) autoresList.push(nome);
    } else if (tipo.includes("passi") || tipo.includes("réu") || tipo.includes("reu") || polo === 2 || polo === "2" || polo === "PA") {
      if (!reusList.includes(nome)) reusList.push(nome);
    }
  }

  const movsRaw = extractMovs(source);
  let autor = autoresList.join(", ");
  let reu = reusList.join(", ");
  if (!autor || !reu) {
    const fullText = [
      source.classe?.nome,
      movsRaw[0]?.nome ?? movsRaw[0]?.descricao,
      ...(source.partes?.map((p: any) => p.nome) || []),
    ].filter(Boolean).join(" \n ");
    const ext = extractPartes(fullText);
    autor = autor || ext.autor;
    reu = reu || ext.reu;
  }
  autor = autor || "Não identificado";
  reu = reu || "Não identificado";

  const andamentos = buildAndamentos(movsRaw);
  const classe = source.classe?.nome || "";
  const assunto = (Array.isArray(source.assuntos) && source.assuntos[0]?.nome) || source.assunto?.nome || "";
  const dataAjuizamento = parseDataAjuizamento(source.dataAjuizamento);
  const grau = source.grau || source.classe?.grau || "";
  const instancia = classifyInstancia(grau, classe);

  return {
    id: hit._id,
    numeroProcesso: source.numeroProcesso || "",
    // "OR" aqui misturava um "Não identificado" literal no título quando só uma
    // parte era achada (ex.: "Fulano x Não identificado"). Só junta os dois nomes
    // quando os DOIS foram identificados; senão usa o que tem, ou a classe.
    titulo: (autor !== "Não identificado" && reu !== "Não identificado") ? `${autor} x ${reu}`
      : autor !== "Não identificado" ? autor
      : reu !== "Não identificado" ? reu
      : (classe || "Processo"),
    partes: `${autor} x ${reu}`,
    autor,
    reu,
    tribunal: source.tribunal || tribunalSigla?.toUpperCase() || "",
    ultimoAndamento: andamentos[0] ? {
      descricao: andamentos[0].descricao,
      data: andamentos[0].data,
    } : null,
    andamentos,
    faseProcessual: andamentos[0]?.fase ?? classifyFase(classe),
    classe,
    assunto,
    dataAjuizamento,
    instancia,
    valorCausa: Number(source.valorCausa) || 0,
    vara: fixAccents((source.orgaoJulgador?.nome || "").trim()),
    comarca: source.orgaoJulgador?.codigoMunicipioIBGE != null ? String(source.orgaoJulgador.codigoMunicipioIBGE) : "",
    orgaoJulgadorCodigo: source.orgaoJulgador?.codigo != null ? String(source.orgaoJulgador.codigo) : "",
    nivelSigilo: Number(source.nivelSigilo) || 0,
    conteudo: andamentos
      .map((a) => `[${a.data ? new Date(a.data).toLocaleDateString("pt-BR") : "sem data"}] ${a.descricao}`)
      .join("\n\n"),
    tipo_documento: classe || (andamentos[0]?.fase ?? null),
    nome_orgao: fixAccents((source.orgaoJulgador?.nome || "").trim()) || null,
    data_disponibilizacao: andamentos[0]?.data || null,
    fonte: "datajud",
  };
}

function mapPjeItem(item: any, ufFallback: string) {
  const numProc = item.numero_processo || item.numeroProcesso;
  if (!numProc) return null;

  const rawContent = item.texto_comunicacao || item.texto || item.textoComunicacao || item.conteudo || "";
  const cleanContent = decodeHtmlEntities(rawContent.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
  const { autor: extAutor, reu: extReu } = extractPartes(cleanContent);
  const dataDisp = item.data_disponibilizacao || item.dataDisponibilizacao || null;

  // PJE: publicação inteira NÃO é um andamento — não exibir na timeline
  const andamentos: Array<{ data: string | null; resumo: string; descricao: string; fase: string }> = [];
  const tribunalReal = item.nome_tribunal || item.sigla_tribunal || item.nomeTribunal || "TJ";
  const classe = item.nome_classe || item.nomeClasse || "";

  const nomeOrgao = item.nome_orgao || item.nomeOrgao || item.orgaoJulgador || "";
  const tipoComunicacao = item.tipo_comunicacao || item.tipoComunicacao || item.tipo || "";

  return {
    id: String(item.id || numProc),
    numeroProcesso: numProc,
    // Mesmo cuidado do mapDatajudHit: usa o nome que tem antes de cair pro
    // código bruto da comunicação (ex.: "INTIMACAO_ELETRONICA") como título.
    titulo: extAutor && extReu ? `${extAutor} x ${extReu}`
      : extAutor ? extAutor
      : extReu ? extReu
      : (classe || tipoComunicacao || "Comunicação"),
    partes: extAutor && extReu ? `${extAutor} x ${extReu}` : "",
    autor: extAutor || "",
    reu: extReu || "",
    tribunal: tribunalReal,
    ultimoAndamento: { descricao: summarize(cleanContent, 3000), data: dataDisp },
    andamentos,
    faseProcessual: classifyFase(cleanContent),
    classe,
    assunto: "",
    dataAjuizamento: null,
    instancia: classifyInstancia("", classe),
    valorCausa: 0,
    vara: nomeOrgao,
    comarca: item.uf || ufFallback,
    orgaoJulgadorCodigo: "",
    nivelSigilo: 0,
    conteudo: cleanContent,
    tipo_documento: tipoComunicacao || null,
    nome_orgao: nomeOrgao || null,
    data_disponibilizacao: dataDisp,
    fonte: "pje_comunica",
  };
}

// ============================================================================
// HANDLER
// ============================================================================
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders, status: 204 });

  try {
    const processKey = Deno.env.get("PROCESSO_API_KEY") || PUBLIC_DATAJUD_KEY;
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");

    // Bypass p/ chamadas servidor-a-servidor (robôs): service_role ou x-robot-secret.
    const robotSecret = req.headers.get("x-robot-secret");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const isRobot =
      (!!robotSecret && robotSecret === Deno.env.get("ROBOT_SECRET")) ||
      (!!serviceRole && authHeader === `Bearer ${serviceRole}`);

    const payload = await req.json();
    const { numeroProcesso, oab, uf } = payload;

    if (!isRobot) {
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Sessão não identificada. Por favor, faça login novamente." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        });
      }

      const supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? ""
      );

      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
      if (userError || !user) {
        return new Response(JSON.stringify({ error: "Falha na validação do usuário." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        });
      }

      // Autorização: paywall + rate-limit sempre; escopo de OAB só na busca por OAB.
      // No modo CNJ a OAB é apenas para enriquecer partes (vem do próprio perfil), sem forçar posse.
      const isOabSearch = !!oab && !!uf && !numeroProcesso;
      const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceRole);
      const { data: authz, error: authzErr } = await admin.rpc("authorize_process_search", {
        p_user_id: user.id,
        p_oab: isOabSearch ? String(oab) : null,
        p_uf: isOabSearch ? String(uf) : null,
        p_weight: isOabSearch ? 4 : 1,
      });
      if (authzErr) {
        console.error("[AUTHZ] erro:", authzErr.message);
        return new Response(JSON.stringify({ error: "Não foi possível validar seu acesso agora. Tente de novo." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500,
        });
      }
      const gate = (authz ?? {}) as { ok?: boolean; reason?: string };
      if (!gate.ok) {
        const MAP: Record<string, { status: number; error: string }> = {
          no_office:         { status: 403, error: "Seu usuário ainda não está vinculado a um escritório." },
          no_access:         { status: 402, error: "A consulta de processos faz parte do plano ativo. Renove a assinatura para voltar a usar." },
          oab_not_in_office: { status: 403, error: "Só dá para pesquisar OABs cadastradas no seu escritório. Cadastre a OAB no perfil do advogado antes de buscar." },
          rate_limited:      { status: 429, error: "Muitas consultas em pouco tempo. Aguarde um instante e tente de novo." },
        };
        const info = MAP[gate.reason ?? ""] ?? { status: 403, error: "Acesso negado para esta consulta." };
        return new Response(JSON.stringify({ error: info.error, reason: gate.reason }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }, status: info.status,
        });
      }
    }

    console.log(`[FETCH-PROCESSO] CNJ=${!!numeroProcesso} OAB=${!!oab} UF=${uf}`);

    // ========== BUSCA POR OAB+UF (sem CNJ) → modo lista híbrida ==========
    // Se vier CNJ junto, NÃO entra aqui; vai para o branch CNJ com OAB extra.
    if (oab && uf && !numeroProcesso) {
      const ufUpper = uf.toUpperCase();
      const tribunalSigla = UF_TO_TRIBUNAL[ufUpper] || `tj${uf.toLowerCase()}`;
      let allResults: any[] = [];

      // 1. DATAJUD
      try {
        const queryString = `partes.advogados.oab: "${oab}" AND partes.advogados.uf: "${ufUpper}"`;
        const r = await fetch(`https://api-publica.datajud.cnj.jus.br/api_publica_${tribunalSigla}/_search`, {
          method: "POST",
          headers: { "Authorization": `APIKey ${processKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            query: { query_string: { query: queryString, default_operator: "AND" } },
            size: 100,
          }),
        });
        if (r.ok) {
          const data = await r.json();
          const mapped = (data.hits?.hits || []).map((h: any) => mapDatajudHit(h, tribunalSigla)).filter(Boolean);
          allResults = allResults.concat(mapped);
          console.log(`[DATAJUD] ${tribunalSigla}: ${mapped.length} processos`);
        }
      } catch (e) {
        console.error("[DATAJUD] erro:", e);
      }

      // 2. COMUNICA PJE
      try {
        const r = await fetch(`https://comunicaapi.pje.jus.br/api/v1/comunicacao?numeroOab=${oab}&ufOab=${ufUpper}`);
        if (r.ok) {
          const data = await r.json();
          const items = data.items || [];
          const existing = new Set(allResults.map((p) => p.numeroProcesso));
          for (const it of items) {
            const mapped = mapPjeItem(it, ufUpper);
            if (mapped && !existing.has(mapped.numeroProcesso)) {
              allResults.push(mapped);
              existing.add(mapped.numeroProcesso);
            }
          }
          console.log(`[PJE] total após merge: ${allResults.length}`);
        }
      } catch (e) {
        console.error("[PJE] erro:", e);
      }

      return new Response(JSON.stringify({ status: "ok", items: allResults }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // ========== BUSCA INDIVIDUAL POR CNJ ==========
    if (numeroProcesso) {
      const cleanNumber = numeroProcesso.replace(/[.-]/g, "");
      if (cleanNumber.length < 14) throw new Error("Número CNJ incompleto");

      const tribunalSigla = tribunalFromCNJ(cleanNumber) || "tjsp";
      console.log(`[CNJ] ${cleanNumber} (${tribunalSigla})`);

      // Estratégia PJE: a API só filtra confiavelmente por numeroOab+ufOab.
      // Tentamos primeiro com OAB (se veio) — pega muito texto rico.
      // Se não veio OAB, tentamos numeroProcesso (alguns endpoints aceitam).
      const pjeUrl = oab && uf
        ? `https://comunicaapi.pje.jus.br/api/v1/comunicacao?numeroOab=${oab}&ufOab=${uf.toUpperCase()}&itensPorPagina=100&pagina=0`
        : `https://comunicaapi.pje.jus.br/api/v1/comunicacao?numeroProcesso=${cleanNumber}&itensPorPagina=100&pagina=0`;
      console.log(`[PJE-URL] ${pjeUrl}`);

      // Dispara DataJud + PJE-Comunica em paralelo (igual fetch-by-oab faz)
      const [datajudRes, pjeRes] = await Promise.all([
        fetch(`https://api-publica.datajud.cnj.jus.br/api_publica_${tribunalSigla}/_search`, {
          method: "POST",
          headers: { "Authorization": `APIKey ${processKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ query: { match: { numeroProcesso: cleanNumber } }, size: 1 }),
        }).catch((e) => { console.error("[DATAJUD] erro:", e); return null; }),
        fetch(pjeUrl).catch((e) => { console.error("[PJE] erro:", e); return null; }),
      ]);

      if (!datajudRes?.ok && !pjeRes?.ok) {
        return new Response(JSON.stringify({
          error: `Tribunal ${tribunalSigla.toUpperCase()} e PJE-Comunica indisponíveis. Tente novamente em instantes.`,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 503,
        });
      }

      // Mapeia DataJud (se ok)
      let baseProcesso: any = null;
      if (datajudRes?.ok) {
        const buf = await datajudRes.arrayBuffer();
        let text: string;
        try {
          text = new TextDecoder("utf-8", { fatal: true }).decode(buf);
        } catch {
          text = new TextDecoder("iso-8859-1").decode(buf);
        }
        const data = JSON.parse(text);
        const hits = data.hits?.hits || [];
        if (hits.length > 0) {
          baseProcesso = mapDatajudHit(hits[0], tribunalSigla);
        }
      }

      // Mapeia PJE-Comunica (se ok) — só para extrair partes
      let pjeFallback: any = null;
      let pjeBestPartes: { autor: string; reu: string } | null = null;
      if (pjeRes?.ok) {
        const pjeData = await pjeRes.json();
        const pjeItems = (pjeData.items || []).filter((it: any) => {
          const num = (it.numero_processo || it.numeroProcesso || "").replace(/\D/g, "");
          return num === cleanNumber;
        });
        console.log(`[PJE] ${pjeItems.length} comunicações para ${cleanNumber}`);

        // PJE Comunica = publicações, NÃO andamentos. Usamos só para extrair partes.
        for (const it of pjeItems) {
          const rawContent = it.texto_comunicacao || it.texto || it.textoComunicacao || it.conteudo || "";
          const cleanContent = decodeHtmlEntities(rawContent.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();

          // Tenta extrair partes do texto da comunicação (pega o melhor match dos N)
          if (cleanContent && (!pjeBestPartes || (!pjeBestPartes.autor || !pjeBestPartes.reu))) {
            const ext = extractPartes(cleanContent);
            if (!pjeBestPartes) {
              pjeBestPartes = ext;
            } else {
              pjeBestPartes = {
                autor: pjeBestPartes.autor || ext.autor,
                reu: pjeBestPartes.reu || ext.reu,
              };
            }
          }
        }

        // Sempre monta pjeFallback se houver items, mesmo com DataJud OK —
        // pra poder mergear partes/título quando DataJud não traz partes.
        if (pjeItems.length > 0) {
          pjeFallback = mapPjeItem(pjeItems[0], "");
          // Sobrescreve autor/reu do pjeFallback com a melhor extração de TODAS as comunicações
          if (pjeBestPartes) {
            pjeFallback.autor = pjeBestPartes.autor || pjeFallback.autor;
            pjeFallback.reu = pjeBestPartes.reu || pjeFallback.reu;
          }
        }
        console.log(`[PJE] partes extraídas: autor="${pjeBestPartes?.autor || ''}" reu="${pjeBestPartes?.reu || ''}"`);
      }

      // Se nada veio
      if (!baseProcesso && !pjeFallback) {
        return new Response(JSON.stringify({
          error: "Processo não encontrado. Verifique o número e o tribunal.",
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 404,
        });
      }

      // MERGE: usa baseProcesso (DataJud) como base; complementa com PJE quando faltar
      const merged = baseProcesso || pjeFallback;

      // Se DataJud não trouxe partes (autor/reu = "Não identificado"), tenta extrair do PJE
      if (baseProcesso && pjeFallback) {
        if (baseProcesso.autor === "Não identificado" && pjeFallback.autor) {
          merged.autor = pjeFallback.autor;
        }
        if (baseProcesso.reu === "Não identificado" && pjeFallback.reu) {
          merged.reu = pjeFallback.reu;
        }
        // Re-monta título se passou a ter partes. Mesmo cuidado: só junta os dois
        // nomes quando os DOIS foram identificados (senão ficava "Fulano x Não identificado").
        if (merged.autor !== "Não identificado" && merged.reu !== "Não identificado") {
          merged.titulo = `${merged.autor} x ${merged.reu}`;
          merged.partes = merged.titulo;
        } else if (merged.autor !== "Não identificado") {
          merged.titulo = merged.autor;
        } else if (merged.reu !== "Não identificado") {
          merged.titulo = merged.reu;
        }
        // Vara/comarca: prioriza DataJud, fallback PJE
        merged.vara = baseProcesso.vara || pjeFallback.vara;
        merged.comarca = baseProcesso.comarca || pjeFallback.comarca;
        // Preserva o conteúdo (teor original da publicação) se vier do PJE
        if (pjeFallback.conteudo) {
          merged.conteudo = pjeFallback.conteudo;
          merged.fonte = "pje_comunica";
        }
      }

      // PJE Comunica são publicações, não andamentos — não mergear na timeline

      // Resolve código IBGE da comarca para nome legível (ex: "5300108" -> "Brasília/DF")
      if (merged.comarca && /^\d+$/.test(merged.comarca)) {
        merged.comarca = await resolveMunicipio(merged.comarca);
      }

      console.log(`[CNJ] retornando: ${merged.numeroProcesso} | ${merged.andamentos?.length || 0} mov | titulo="${merged.titulo}"`);

      return new Response(JSON.stringify(merged), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    throw new Error("Informe o número CNJ ou OAB para realizar a busca.");
  } catch (error: any) {
    console.error(`[FETCH-PROCESSO-ERROR] ${error.message}`);
    return new Response(JSON.stringify({
      error: error.message,
      details: "Tente novamente ou cadastre o processo manualmente se o tribunal estiver fora do ar.",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: error.status || 500,
    });
  }
});
