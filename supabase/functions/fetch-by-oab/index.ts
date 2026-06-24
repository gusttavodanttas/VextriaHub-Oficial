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

// CNJ-NNNNNNN-DD.AAAA.J.TR.OOOO -> J.TR -> tribunal sigla
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
// CLASSIFICAÇÃO DE FASE / INSTÂNCIA
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

// Enriquece texto da movimentação com complementosTabelados do DataJud
function enrichMovText(a: any): string {
  const base = a?.descricao ?? a?.titulo ?? a?.nome ?? a?.texto ?? "";
  const compls: any[] = Array.isArray(a?.complementosTabelados) ? a.complementosTabelados : [];
  if (!compls.length) return base;
  const detalhes = compls
    .map((c) => c?.nome)
    .filter(Boolean)
    .join(", ");
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

// Helper: o DataJud retorna o array como `movimentos`, mas algumas APIs
// derivadas (e o PJE-Comunica) usam `movimentacoes`. Preferimos `movimentos`.
function extractMovs(source: any): any[] {
  const m = source?.movimentos ?? source?.movimentacoes ?? [];
  return Array.isArray(m) ? m : [];
}

// DataJud retorna dataAjuizamento como string "YYYYMMDDHHmmss".
// Convertemos pra ISO 8601 para que o frontend e o Postgres aceitem.
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
  const cleanContent = rawContent.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const { autor: extAutor, reu: extReu } = extractPartes(cleanContent);
  const dataDisp = item.data_disponibilizacao || item.dataDisponibilizacao || null;

  const andamentos = buildAndamentos([{ data: dataDisp, descricao: cleanContent }]);

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

    const { oab, uf, days } = await req.json();
    if (!oab || !uf) throw new Error("OAB e UF são obrigatórios");

    const ufUpper = uf.toUpperCase();
    const tribunaisParaBuscar = UF_TO_TRIBUNAIS[ufUpper] || [`tj${uf.toLowerCase()}`];

    console.log(`[OAB] OAB=${oab} UF=${ufUpper} dias=${days}`);

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
            if (existing.autor !== "Não identificado" || existing.reu !== "Não identificado") {
              existing.titulo = `${existing.autor} x ${existing.reu}`;
              existing.partes = existing.titulo;
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

    console.log(`[OAB] ${uniqueResults.length} processos únicos antes da hidratação`);

    // 4. HIDRATAÇÃO: corrige processos com 0 ou 1 andamento
    const hydrated = await hydrateAllPoorRecords(uniqueResults, processKey);

    console.log(`[OAB] retornando ${hydrated.length} processos`);

    return new Response(JSON.stringify({ status: "ok", items: hydrated }), {
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
