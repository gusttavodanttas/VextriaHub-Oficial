import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const PUBLIC_DATAJUD_KEY = "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";

// ============================================================================
// MAPEAMENTOS DE TRIBUNAIS
// ============================================================================
const CNJ_TRIBUNAL_MAP: Record<string, string> = {
  "8.01": "tjac", "8.02": "tjal", "8.03": "tjam", "8.04": "tjap", "8.05": "tjba",
  "8.06": "tjce", "8.07": "tjdft", "8.08": "tjes", "8.09": "tjgo", "8.10": "tjma",
  "8.11": "tjmt", "8.12": "tjms", "8.13": "tjmg", "8.14": "tjpa", "8.15": "tjpb",
  "8.16": "tjpr", "8.17": "tjpe", "8.18": "tjpi", "8.19": "tjrj", "8.20": "tjrn",
  "8.21": "tjrs", "8.22": "tjro", "8.23": "tjrr", "8.24": "tjsc", "8.25": "tjse",
  "8.26": "tjsp", "8.27": "tjto",
  "4.01": "trf1", "4.02": "trf2", "4.03": "trf3", "4.04": "trf4", "4.05": "trf5", "4.06": "trf6",
  "5.01": "trt1", "5.02": "trt2", "5.03": "trt3", "5.04": "trt4", "5.05": "trt5",
  "5.06": "trt6", "5.07": "trt7", "5.08": "trt8", "5.09": "trt9", "5.10": "trt10",
  "5.11": "trt11", "5.12": "trt12", "5.13": "trt13", "5.14": "trt14", "5.15": "trt15",
  "5.16": "trt16", "5.17": "trt17", "5.18": "trt18", "5.19": "trt19", "5.20": "trt20",
  "5.21": "trt21", "5.22": "trt22", "5.23": "trt23", "5.24": "trt24",
  "1.00": "stf", "3.00": "stj"
};

const UF_TO_TRIBUNAL: Record<string, string> = {
  "AC": "tjac", "AL": "tjal", "AM": "tjam", "AP": "tjap", "BA": "tjba",
  "CE": "tjce", "DF": "tjdft", "ES": "tjes", "GO": "tjgo", "MA": "tjma",
  "MG": "tjmg", "MS": "tjms", "MT": "tjmt", "PA": "tjpa", "PB": "tjpb",
  "PE": "tjpe", "PI": "tjpi", "PR": "tjpr", "RJ": "tjrj", "RN": "tjrn",
  "RO": "tjro", "RR": "tjrr", "RS": "tjrs", "SC": "tjsc", "SE": "tjse",
  "SP": "tjsp", "TO": "tjto",
};

function tribunalFromCNJ(numero: string): string | null {
  const d = (numero || "").replace(/\D/g, "");
  if (d.length !== 20) return null;
  const code = `${d.substring(13, 14)}.${d.substring(14, 16)}`;
  return CNJ_TRIBUNAL_MAP[code] || null;
}

// ============================================================================
// EXTRAÇÃO DE PARTES (regex)
// ============================================================================
const ATIVO = [
  "REQUERENTE", "AUTOR", "AUTORA", "EXEQUENTE", "RECLAMANTE",
  "APELANTE", "AGRAVANTE", "EMBARGANTE", "RECORRENTE", "IMPETRANTE", "POLO ATIVO",
];
const PASSIVO = [
  "REQUERIDO", "REQUERIDA", "RÉU", "REU", "EXECUTADO", "RECLAMADO",
  "APELADO", "AGRAVADO", "EMBARGADO", "RECORRIDO", "IMPETRADO", "POLO PASSIVO",
];
const TERMINADORES = [
  ...ATIVO, ...PASSIVO,
  "ADVOGADO", "ADVOGADA", "ADVOGADO\\(A\\)", "CLASSE", "ASSUNTO",
  "SENTENÇA", "DECISÃO", "DESPACHO", "CERTIDÃO", "FINALIDADE",
  "DESTINAT", "OBSERVAÇÃO", "OBSERVACAO", "ATO ORDINATÓRIO", "EMENTA",
];

function makeRoleRegex(roles: string[]): RegExp {
  const terms = roles.join("|");
  const stops = TERMINADORES.join("|");
  return new RegExp(
    `(?:${terms})\\s*:?\\s+([^\\n\\r]{2,400}?)(?=\\s+(?:${stops})\\s*:|\\s+(?:${stops})\\b|\\s{2,}|$)`,
    "i",
  );
}
const RE_ATIVO   = makeRoleRegex(ATIVO);
const RE_PASSIVO = makeRoleRegex(PASSIVO);

function cleanName(raw: string | null | undefined): string {
  if (!raw) return "";
  let s = raw.replace(/\s+/g, " ").trim();
  s = s.replace(/\s*-\s*(OAB|CPF|CNPJ).*/i, "")
       .replace(/\s*\(.*?\)\s*/g, " ")
       .replace(/\s+e\s+outros\s*$/i, "")
       .replace(/[;,.\s]+$/g, "")
       .trim();
  if (s.split(" ").length > 12) return "";
  if (s.length < 2) return "";
  return s;
}

function extractPartes(text: string): { autor: string; reu: string } {
  if (!text) return { autor: "", reu: "" };
  const mA = text.match(RE_ATIVO);
  const mP = text.match(RE_PASSIVO);
  return { autor: cleanName(mA?.[1]), reu: cleanName(mP?.[1]) };
}

// ============================================================================
// CLASSIFICAÇÃO
// ============================================================================
const FASES: Array<[RegExp, string]> = [
  [/ARQUIVAD[OA]\b|BAIXA\s+DEFINITIVA/i, "Arquivado"],
  [/CUMPRIMENTO\s+DE\s+SENTEN[ÇC]A/i, "Cumprimento de sentença"],
  [/EXECU[ÇC][ÃA]O\s+FISCAL/i, "Execução fiscal"],
  [/EXECU[ÇC][ÃA]O/i, "Execução"],
  [/RECURSO\s+ESPECIAL|AGRAVO\s+EM\s+RECURSO\s+ESPECIAL/i, "Recurso especial"],
  [/RECURSO\s+EXTRAORDIN[ÁA]RIO/i, "Recurso extraordinário"],
  [/APELA[ÇC][ÃA]O/i, "Recurso (apelação)"],
  [/AGRAVO\s+DE\s+INSTRUMENTO/i, "Recurso (agravo)"],
  [/EMBARGOS\s+DE\s+DECLARA[ÇC][ÃA]O/i, "Embargos de declaração"],
  [/SENTEN[ÇC]A/i, "Sentenciado"],
  [/AUDI[ÊE]NCIA/i, "Audiência designada"],
  [/DESPACHO|DECIS[ÃA]O\s+INTERLOCUT[ÓO]RIA/i, "Em andamento (decisão)"],
  [/ATO\s+ORDINAT[ÓO]RIO|INTIMA[ÇC][ÃA]O/i, "Em andamento (intimação)"],
  [/CONCLUS[ÃA]O/i, "Concluso"],
  [/CITA[ÇC][ÃA]O/i, "Citação"],
];

function classifyFase(text: string): string {
  if (!text) return "Não identificada";
  for (const [re, label] of FASES) if (re.test(text)) return label;
  return "Em andamento";
}

function classifyInstancia(grau?: string | number, classeNome?: string): string {
  const g = String(grau || "").toUpperCase();
  if (g.includes("G1") || g === "1" || g.includes("PRIMEIRO")) return "1ª Instância";
  if (g.includes("G2") || g === "2" || g.includes("SEGUNDO")) return "2ª Instância";
  if (g.includes("SUPERIOR") || g.includes("STJ") || g.includes("STF")) return "Superior";
  if (classeNome && /APELA|AGRAVO|RECURSO/i.test(classeNome)) return "2ª Instância";
  return "1ª Instância";
}

function summarize(descricao: string, max = 3000): string {
  if (!descricao) return "";
  const clean = descricao.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max).replace(/\s\S*$/, "") + "…";
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

function extractMovs(source: any): any[] {
  const m = source?.movimentos ?? source?.movimentacoes ?? [];
  return Array.isArray(m) ? m : [];
}

function parseDataAjuizamento(raw: any): string | null {
  if (!raw) return null;
  const s = String(raw);
  if (/^\d{14}$/.test(s)) {
    return `${s.substring(0, 4)}-${s.substring(4, 6)}-${s.substring(6, 8)}T${s.substring(8, 10)}:${s.substring(10, 12)}:${s.substring(12, 14)}Z`;
  }
  if (/^\d{8}$/.test(s)) {
    return `${s.substring(0, 4)}-${s.substring(4, 6)}-${s.substring(6, 8)}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s;
  return null;
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
    titulo: (autor !== "Não identificado" || reu !== "Não identificado") ? `${autor} x ${reu}` : (classe || "Processo"),
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
    conteudo: andamentos
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
  const cleanContent = rawContent.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
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
    titulo: extAutor && extReu ? `${extAutor} x ${extReu}` : (tipoComunicacao || "Comunicação"),
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

    const payload = await req.json();
    const { numeroProcesso, oab, uf } = payload;

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
        const data = await datajudRes.json();
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
          const cleanContent = rawContent.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

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
        // Re-monta título se passou a ter partes
        if (merged.autor !== "Não identificado" || merged.reu !== "Não identificado") {
          merged.titulo = `${merged.autor} x ${merged.reu}`;
          merged.partes = merged.titulo;
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
