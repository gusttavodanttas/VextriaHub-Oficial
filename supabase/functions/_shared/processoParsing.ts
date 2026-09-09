// Lógica de extração/classificação de processo compartilhada entre
// fetch-processo e fetch-by-oab. Era ~250 linhas duplicadas quase idênticas
// nos dois arquivos — foi assim que o bug de nomenclatura (parte 19) precisou
// de correção em dois lugares. Fonte única a partir de agora.
//
// O que NÃO está aqui, de propósito, porque diverge entre os dois:
// fixAccents/resolveMunicipio (só fetch-processo), enrichMovText/buildAndamentos
// (fetch-by-oab tem uma versão mais rica), mapa de tribunais por UF
// (fetch-processo sabe o tribunal exato pelo CNJ; fetch-by-oab varre vários por UF).

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

export function tribunalFromCNJ(numero: string): string | null {
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

export function cleanName(raw: string | null | undefined): string {
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

export function extractPartes(text: string): { autor: string; reu: string } {
  if (!text) return { autor: "", reu: "" };
  const mA = text.match(RE_ATIVO);
  const mP = text.match(RE_PASSIVO);
  return { autor: cleanName(mA?.[1]), reu: cleanName(mP?.[1]) };
}

// A comunicação do PJE vem em HTML; strippar as tags (feito no chamador) não
// decodifica as entidades (ex.: "Ju&iacute;za" ficava literal no título/nome
// extraído — parte 19b).
const HTML_ENTITIES: Record<string, string> = {
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
  aacute: "á", Aacute: "Á", eacute: "é", Eacute: "É", iacute: "í", Iacute: "Í",
  oacute: "ó", Oacute: "Ó", uacute: "ú", Uacute: "Ú",
  atilde: "ã", Atilde: "Ã", otilde: "õ", Otilde: "Õ",
  acirc: "â", Acirc: "Â", ecirc: "ê", Ecirc: "Ê", ocirc: "ô", Ocirc: "Ô",
  ccedil: "ç", Ccedil: "Ç", agrave: "à", Agrave: "À", ordm: "º", ordf: "ª", deg: "°",
};

export function decodeHtmlEntities(s: string): string {
  if (!s) return s;
  return s
    .replace(/&#(\d+);/g, (_m, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&([a-zA-Z]+);/g, (m, name) => HTML_ENTITIES[name] ?? m);
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

export function classifyFase(text: string): string {
  if (!text) return "Não identificada";
  for (const [re, label] of FASES) if (re.test(text)) return label;
  return "Em andamento";
}

export function classifyInstancia(grau?: string | number, classeNome?: string): string {
  const g = String(grau || "").toUpperCase();
  if (g.includes("G1") || g === "1" || g.includes("PRIMEIRO")) return "1ª Instância";
  if (g.includes("G2") || g === "2" || g.includes("SEGUNDO")) return "2ª Instância";
  if (g.includes("SUPERIOR") || g.includes("STJ") || g.includes("STF")) return "Superior";
  if (classeNome && /APELA|AGRAVO|RECURSO/i.test(classeNome)) return "2ª Instância";
  return "1ª Instância";
}

export function summarize(descricao: string, max = 3000): string {
  if (!descricao) return "";
  const clean = descricao.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max).replace(/\s\S*$/, "") + "…";
}

// Helper: o DataJud retorna o array como `movimentos`, mas algumas APIs
// derivadas (e o PJE-Comunica) usam `movimentacoes`. Preferimos `movimentos`.
export function extractMovs(source: any): any[] {
  const m = source?.movimentos ?? source?.movimentacoes ?? [];
  return Array.isArray(m) ? m : [];
}

// DataJud retorna dataAjuizamento como string "YYYYMMDDHHmmss".
// Convertemos pra ISO 8601 para que o frontend e o Postgres aceitem.
export function parseDataAjuizamento(raw: any): string | null {
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
