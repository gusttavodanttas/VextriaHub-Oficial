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
// MAPEAMENTO DE TRIBUNAIS POR UF (vários tribunais por UF — TJ+TRF+TRT — já
// que aqui só temos a OAB, não um CNJ que já indica o tribunal exato)
// ============================================================================
const UF_TO_TRIBUNAIS: Record<string, string[]> = {
  "AC": ["tjac", "trf1", "trt14"], "AL": ["tjal", "trf5", "trt19"],
  "AM": ["tjam", "trf1", "trt11"], "AP": ["tjap", "trf1", "trt8"],
  "BA": ["tjba", "trf1", "trt5"], "CE": ["tjce", "trf5", "trt7"],
  "DF": ["tjdft", "trf1", "trt10"], "ES": ["tjes", "trf2", "trt17"],
  "GO": ["tjgo", "trf1", "trt18"], "MA": ["tjma", "trf1", "trt16"],
  "MG": ["tjmg", "trf6", "trt3"], "MS": ["tjms", "trf3", "trt24"],
  "MT": ["tjmt", "trf1", "trt23"], "PA": ["tjpa", "trf1", "trt8"],
  "PB": ["tjpb", "trf5", "trt13"], "PE": ["tjpe", "trf5", "trt6"],
  "PI": ["tjpi", "trf1", "trt22"], "PR": ["tjpr", "trf4", "trt9"],
  "RJ": ["tjrj", "trf2", "trt1"], "RN": ["tjrn", "trf5", "trt21"],
  "RO": ["tjro", "trf1", "trt14"], "RR": ["tjrr", "trf1", "trt11"],
  "RS": ["tjrs", "trf4", "trt4"], "SC": ["tjsc", "trf4", "trt12"],
  "SE": ["tjse", "trf5", "trt20"], "SP": ["tjsp", "trf3", "trt2", "trt15"],
  "TO": ["tjto", "trf1", "trt10"],
};

// Enriquece texto da movimentação com complementos do DataJud
function enrichMovText(a: any): string {
  const base = a?.descricao ?? a?.titulo ?? a?.nome ?? a?.texto ?? "";

  // Complementos tabelados (ex: "designada", "Juiz(a)")
  const compls: any[] = Array.isArray(a?.complementosTabelados) ? a.complementosTabelados : [];
  const tabelados = compls.map((c) => c?.nome || c?.descricao).filter(Boolean).join(", ");

  // Complementos de texto livre (ex: data/hora de audiência, detalhes do despacho)
  const textoLivre: string[] = [];
  const complTexto = a?.complemento ?? a?.textoComplemento ?? "";
  if (complTexto && typeof complTexto === "string" && complTexto.length > 2) {
    textoLivre.push(complTexto.replace(/\s+/g, " ").trim());
  }
  // Alguns tribunais retornam array de complementos com campo "valor"
  const complArr: any[] = Array.isArray(a?.complementos) ? a.complementos : [];
  for (const c of complArr) {
    const val = c?.valor ?? c?.descricao ?? c?.texto ?? "";
    if (val && typeof val === "string" && val.length > 2) {
      textoLivre.push(val.replace(/\s+/g, " ").trim());
    }
  }

  const partes: string[] = [base];
  if (tabelados) partes.push(`(${tabelados})`);
  if (textoLivre.length > 0) partes.push(`— ${textoLivre.join("; ")}`);

  return partes.join(" ");
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
// MAPEAMENTO PADRONIZADO DE PROCESSO (DataJud + PJE)
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
    vara: (source.orgaoJulgador?.nome || "").trim(),
    comarca: source.orgaoJulgador?.codigoMunicipioIBGE != null ? String(source.orgaoJulgador.codigoMunicipioIBGE) : "",
    orgaoJulgadorCodigo: source.orgaoJulgador?.codigo != null ? String(source.orgaoJulgador.codigo) : "",
    nivelSigilo: Number(source.nivelSigilo) || 0,
    // conteudo = teor do último andamento (mais recente) — não o histórico completo
    conteudo: andamentos[0]?.descricao || "",
    // histórico completo separado para exibição na timeline do processo
    historico: andamentos
      .map((a) => `[${a.data ? new Date(a.data).toLocaleDateString("pt-BR") : "sem data"}] ${a.descricao}`)
      .join("\n\n"),
    tipo_documento: classe || (andamentos[0]?.fase ?? null),
    nome_orgao: (source.orgaoJulgador?.nome || "").trim() || null,
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

  // PJE: o conteúdo é a publicação inteira — não exibir como andamento na timeline
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
    titulo: (extAutor?.trim() && extReu?.trim()) ? `${extAutor.trim()} x ${extReu.trim()}`
      : extAutor?.trim() ? extAutor.trim()
      : extReu?.trim() ? extReu.trim()
      : (classe || tipoComunicacao || "Intimação"),
    partes: (extAutor?.trim() && extReu?.trim()) ? `${extAutor.trim()} x ${extReu.trim()}` : "",
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
    // Campos extras para cálculo de prazo
    tipo_documento: tipoComunicacao,
    nome_orgao: nomeOrgao,
    data_disponibilizacao: dataDisp,
    fonte: "pje_comunica",
  };
}

// ============================================================================
// HIDRATAÇÃO DE ANDAMENTOS VIA DATAJUD (corrige o "1 só andamento")
// ============================================================================
async function hydrateFromDatajud(numero: string, processKey: string): Promise<any[] | null> {
  const tribunal = tribunalFromCNJ(numero);
  if (!tribunal) return null;

  try {
    const r = await fetch(`https://api-publica.datajud.cnj.jus.br/api_publica_${tribunal}/_search`, {
      method: "POST",
      headers: { "Authorization": `APIKey ${processKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: { match: { numeroProcesso: numero.replace(/\D/g, "") } },
        size: 1,
      }),
    });
    if (!r.ok) return null;
    const data = await r.json();
    const hit = data.hits?.hits?.[0];
    if (!hit) return null;
    return extractMovs(hit._source);
  } catch (_e) {
    return null;
  }
}

async function hydrateAllPoorRecords(records: any[], processKey: string): Promise<any[]> {
  const CHUNK = 8;
  const poor = records.filter((p) => (p.andamentos?.length || 0) <= 1);
  console.log(`[HIDRATA] ${poor.length} processos com poucos andamentos — buscando histórico completo`);

  for (let i = 0; i < poor.length; i += CHUNK) {
    const slice = poor.slice(i, i + CHUNK);
    const results = await Promise.all(
      slice.map(async (p) => ({ p, movs: await hydrateFromDatajud(p.numeroProcesso, processKey) }))
    );
    for (const { p, movs } of results) {
      if (movs && movs.length > 0) {
        const ands = buildAndamentos(movs);
        if (ands.length > p.andamentos.length) {
          p.andamentos = ands;
          p.ultimoAndamento = ands[0] ? { descricao: ands[0].descricao, data: ands[0].data } : p.ultimoAndamento;
          p.faseProcessual = ands[0]?.fase || p.faseProcessual;
          if (p.fonte !== "pje_comunica") {
            p.conteudo = ands[0]?.descricao || p.conteudo;
            p.historico = ands
              .map((a) => `[${a.data ? new Date(a.data).toLocaleDateString("pt-BR") : "sem data"}] ${a.descricao}`)
              .join("\n\n");
          }
        }
      }
    }
  }
  return records;
}

// ============================================================================
// HANDLER
// ============================================================================
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders, status: 204 });

  try {
    const processKey = Deno.env.get("PROCESSO_API_KEY") || PUBLIC_DATAJUD_KEY;
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");

    // Bypass para o robô agendado (cron) — não tem sessão de usuário
    const robotSecret = req.headers.get("x-robot-secret");
    const isRobot = !!robotSecret && robotSecret === Deno.env.get("ROBOT_SECRET");

    const { oab, uf, days, nacional } = await req.json();
    if (!oab || !uf) throw new Error("OAB e UF são obrigatórios");

    if (!isRobot) {
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Sua sessão expirou. Por favor, faça login novamente." }), {
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
        return new Response(JSON.stringify({ error: "Falha na autenticação." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        });
      }

      // Autorização (paywall + OAB do próprio escritório + rate-limit) via RPC service-role.
      // O robô (isRobot) já é escopado por escritório/OAB cadastrada, então não passa por aqui.
      const admin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );
      const { data: authz, error: authzErr } = await admin.rpc("authorize_process_search", {
        p_user_id: user.id,
        p_oab: String(oab),
        p_uf: String(uf),
        p_weight: nacional ? 60 : 4,
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
          no_access:         { status: 402, error: "A busca de processos faz parte do plano ativo. Renove a assinatura para voltar a usar." },
          oab_not_in_office: { status: 403, error: "Só dá para pesquisar OABs cadastradas no seu escritório. Cadastre a OAB no perfil do advogado antes de buscar." },
          rate_limited:      { status: 429, error: "Muitas buscas em pouco tempo. Aguarde um instante e tente de novo." },
        };
        const info = MAP[gate.reason ?? ""] ?? { status: 403, error: "Acesso negado para esta busca." };
        return new Response(JSON.stringify({ error: info.error, reason: gate.reason }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }, status: info.status,
        });
      }
    }

    const ufUpper = uf.toUpperCase();
    // Nacional: varre TODOS os tribunais do país, mantendo o filtro da OAB/UF do advogado.
    const tribunaisParaBuscar = nacional
      ? Array.from(new Set(Object.values(UF_TO_TRIBUNAIS).flat()))
      : (UF_TO_TRIBUNAIS[ufUpper] || [`tj${uf.toLowerCase()}`]);

    console.log(`[OAB] OAB=${oab} UF=${ufUpper} dias=${days} nacional=${!!nacional} tribunais=${tribunaisParaBuscar.length}`);

    let allResults: any[] = [];
    const numeroOabPuro = oab.replace(/\D/g, "");
    const numeroOabComZero = numeroOabPuro.padStart(6, "0");

    // 1. DATAJUD: busca todos tribunais da UF em paralelo
    const datajudPromises = tribunaisParaBuscar.map(async (tribunal) => {
      try {
        const queryString = `(partes.advogados.oab: "${numeroOabPuro}" OR partes.advogados.oab: "${numeroOabComZero}" OR partes.advogados.oab: "${numeroOabPuro}${ufUpper}") AND partes.advogados.uf: "${ufUpper}"`;
        const searchBody = {
          query: { query_string: { query: queryString, default_operator: "AND" } },
          size: 150,
        };
        const r = await fetch(`https://api-publica.datajud.cnj.jus.br/api_publica_${tribunal}/_search`, {
          method: "POST",
          headers: { "Authorization": `APIKey ${processKey}`, "Content-Type": "application/json" },
          body: JSON.stringify(searchBody),
        });
        if (!r.ok) return [];
        const data = await r.json();
        const hits = data.hits?.hits || [];
        console.log(`[DATAJUD] ${tribunal}: ${hits.length} hits`);
        return hits.map((h: any) => mapDatajudHit(h, tribunal)).filter(Boolean);
      } catch (e) {
        console.error(`[DATAJUD] erro em ${tribunal}:`, e);
        return [];
      }
    });
    const datajudBatches = await Promise.all(datajudPromises);
    datajudBatches.forEach((b) => { allResults = allResults.concat(b); });

    // 2. COMUNICA PJE: complementa processos não indexados
    const searchDays = days || 365;
    const intervalDate = new Date();
    intervalDate.setDate(intervalDate.getDate() - searchDays);
    const dateStart = intervalDate.toISOString().split("T")[0];

    const pjePromises = [0, 1].map(async (page) => {
      try {
        const url = `https://comunicaapi.pje.jus.br/api/v1/comunicacao?numeroOab=${numeroOabPuro}&ufOab=${ufUpper}&itensPorPagina=100&pagina=${page}&dataDisponibilizacaoInicio=${dateStart}`;
        const r = await fetch(url);
        if (!r.ok) return [];
        const data = await r.json();
        const items = data.items || [];
        console.log(`[PJE] página ${page}: ${items.length} itens`);
        return items.map((it: any) => mapPjeItem(it, ufUpper)).filter(Boolean);
      } catch (e) {
        console.error(`[PJE] erro página ${page}:`, e);
        return [];
      }
    });
    const pjeBatches = await Promise.all(pjePromises);
    const existingMap = new Map(allResults.map((p) => [p.numeroProcesso, p]));
    for (const batch of pjeBatches) {
      for (const p of batch) {
        if (p) {
          const existing = existingMap.get(p.numeroProcesso);
          if (existing) {
            if (p.conteudo) {
              existing.conteudo = p.conteudo;
              existing.fonte = "pje_comunica";
            }
            if (existing.autor === "Não identificado" && p.autor) {
              existing.autor = p.autor;
            }
            if (existing.reu === "Não identificado" && p.reu) {
              existing.reu = p.reu;
            }
            // Mesmo cuidado: só junta os dois nomes quando os DOIS foram
            // identificados (senão o título ficava "Fulano x Não identificado").
            if (existing.autor !== "Não identificado" && existing.reu !== "Não identificado") {
              existing.titulo = `${existing.autor} x ${existing.reu}`;
              existing.partes = existing.titulo;
            } else if (existing.autor !== "Não identificado") {
              existing.titulo = existing.autor;
            } else if (existing.reu !== "Não identificado") {
              existing.titulo = existing.reu;
            }
            if (p.andamentos && p.andamentos.length > 0) {
              const dataJudAndamentos = existing.andamentos || [];
              const existingTexts = new Set(
                dataJudAndamentos.map((a: any) => (a.descricao || a.resumo || "").trim().toLowerCase().slice(0, 200))
              );
              const novos = p.andamentos.filter((a: any) => {
                const key = (a.descricao || "").trim().toLowerCase().slice(0, 200);
                return key && !existingTexts.has(key);
              });
              if (novos.length > 0) {
                existing.andamentos = [...novos, ...dataJudAndamentos].sort((a, b) => {
                  const da = a.data ? new Date(a.data).getTime() : 0;
                  const db = b.data ? new Date(b.data).getTime() : 0;
                  return db - da;
                });
                existing.ultimoAndamento = existing.andamentos[0]
                  ? { descricao: existing.andamentos[0].descricao, data: existing.andamentos[0].data }
                  : existing.ultimoAndamento;
              }
            }
          } else {
            allResults.push(p);
            existingMap.set(p.numeroProcesso, p);
          }
        }
      }
    }

    // 3. Dedup final
    const uniqueResults = Array.from(existingMap.values());

    console.log(`[OAB] retornando ${uniqueResults.length} processos`);

    return new Response(JSON.stringify({ status: "ok", items: uniqueResults }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error(`[OAB-ERROR] ${error.message}`);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
