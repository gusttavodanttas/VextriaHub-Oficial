// Rótulos e regras do acervo de jurisprudência/normas (espelha o JurisKit).
// Regra de ouro: só pode ser citado o que o PRÓPRIO advogado marcou como CONFERIDO.
// Ato normativo e metadado processual NUNCA são precedente.

export interface JurisDoc {
  doc_id: string;
  source_id: string;
  court: string | null;
  document_type: string;
  organ: string | null;
  case_number: string | null;
  decision_number: string | null;
  class_name: string | null;
  rapporteur: string | null;
  judgment_date: string | null;
  publication_date: string | null;
  title: string | null;
  summary: string | null;
  full_text?: string | null;
  official_url: string;
  metadata: Record<string, unknown> | null;
  captured_at?: string | null;
  content_sha256?: string | null;
  snippet?: string | null;
  rank?: number | null;
  my_status?: 'VERIFIED' | 'BLOCKED' | null;
  my_reviewed_at?: string | null;
}

export const SOURCE_LABEL: Record<string, string> = {
  stj_dadosabertos: 'STJ · espelhos',
  stj_integras: 'STJ · inteiro teor',
  tjdft_jurisdf: 'TJDFT',
  inlabs_dou: 'Diário Oficial (DOU)',
  cfo_atos: 'CFO',
  ans_publicacoes: 'ANS',
  cnj_datajud: 'DataJud (metadados)',
};

export const TIPO_LABEL: Record<string, string> = {
  acordao: 'Acórdão',
  decisao_monocratica: 'Decisão monocrática',
  sumula: 'Súmula',
  ato_normativo: 'Ato normativo',
  metadado_processual: 'Metadado processual',
};

export const NAO_PRECEDENTE = new Set(['ato_normativo', 'metadado_processual']);

export function isPrecedente(d: Pick<JurisDoc, 'document_type'>): boolean {
  return !NAO_PRECEDENTE.has(d.document_type);
}

export function sourceLabel(id: string): string {
  return SOURCE_LABEL[id] || id;
}

export function tipoLabel(t: string): string {
  return TIPO_LABEL[t] || t;
}

export function docTitulo(d: JurisDoc): string {
  return d.case_number || d.decision_number || d.title || d.doc_id;
}

export function docData(d: JurisDoc): string | null {
  return d.judgment_date || d.publication_date || null;
}

export function fmtData(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

/** Normaliza URL para comparação (mesma regra do kit: espaços e barra final não contam). */
export function urlIgual(a: string, b: string): boolean {
  const n = (s: string) => s.trim().replace(/\/+$/, '');
  return n(a) === n(b);
}

/** Citação pronta para colar na peça (só faz sentido para registro CONFERIDO). */
export function citacao(d: JurisDoc): string {
  if (!isPrecedente(d)) {
    return `${d.title || docTitulo(d)}${d.organ ? ` (${d.organ})` : ''}${d.publication_date ? `, publicado em ${fmtData(d.publication_date)}` : ''}. Disponível em: ${d.official_url}.`;
  }
  const partes = [
    d.court || '',
    docTitulo(d),
    d.rapporteur ? `Rel. ${d.rapporteur}` : '',
    d.organ || '',
    d.judgment_date ? `julgado em ${fmtData(d.judgment_date)}` : '',
    d.publication_date ? `publicado em ${fmtData(d.publication_date)}` : '',
  ].filter(Boolean);
  return `${partes.join(', ')}. Disponível em: ${d.official_url}.`;
}

/** Transforma o snippet do banco ("[termo]") em segmentos para destaque. */
export function splitSnippet(s: string | null | undefined): Array<{ t: string; hit: boolean }> {
  if (!s) return [];
  const out: Array<{ t: string; hit: boolean }> = [];
  const re = /\[([^\]]+)\]/g;
  let last = 0; let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push({ t: s.slice(last, m.index), hit: false });
    out.push({ t: m[1], hit: true });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ t: s.slice(last), hit: false });
  return out;
}

/** Sugere termos de busca a partir de uma publicação/consultivo (palavras longas, sem ruído). */
export function sugerirTermos(texto: string, max = 6): string {
  const stop = new Set(['processo', 'autos', 'parte', 'partes', 'intimacao', 'intimação', 'despacho', 'decisao', 'decisão', 'sentenca', 'sentença',
    'publicacao', 'publicação', 'tribunal', 'justica', 'justiça', 'vara', 'juizo', 'juízo', 'comarca', 'advogado', 'advogados', 'oab',
    'numero', 'número', 'prazo', 'dias', 'fica', 'ficam', 'para', 'sobre', 'conforme', 'nos', 'termos', 'artigo', 'arts', 'art', 'lei']);
  const freq = new Map<string, number>();
  for (const w of (texto || '').toLowerCase().replace(/[^\p{L}\s-]/gu, ' ').split(/\s+/)) {
    if (w.length < 6 || stop.has(w)) continue;
    freq.set(w, (freq.get(w) || 0) + 1);
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([w]) => w).join(' ');
}
