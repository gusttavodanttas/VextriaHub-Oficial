/**
 * prazos_cpc.ts — Cálculo determinístico de prazos processuais.
 *
 * Regras implementadas:
 *   CPC (Lei 13.105/2015):
 *     Art. 219  — contam apenas dias úteis (segunda a sexta, excluídos feriados)
 *     Art. 224  — exclui o dia do início, inclui o dia do vencimento
 *     Art. 231 I — intimação pelo DJe considera-se realizada no 1º dia útil
 *                  seguinte à data de disponibilização
 *
 *   Juizado Especial Cível (Lei 9.099/95):
 *     Art. 41   — recurso inominado: 10 dias corridos
 *     Art. 49   — embargos de declaração: 5 dias corridos
 *     Demais    — prazos contados em dias corridos (não úteis)
 *
 *   Juizado Especial Federal (Lei 10.259/2001):
 *     Art. 5    — prazos em dias corridos
 *
 * IMPORTANTE: Art. 220 CPC (suspensão em recesso de janeiro e julho) NÃO está
 * implementado — cada tribunal define datas exatas. Verifique manualmente se a
 * publicação ocorreu próxima de um recesso.
 */

export interface PrazoResult {
  data_intimacao: string;       // YYYY-MM-DD — 1º dia útil após publicação (Art. 231 I)
  data_fim_prazo: string | null; // YYYY-MM-DD — último dia do prazo (null se indeterminado)
  dias_uteis: number | null;    // quantidade de dias do prazo
  base_legal: string;           // dispositivo legal aplicado
  prazo_no_texto: number | null; // dias mencionados no texto (null se não encontrado)
  eh_juizado: boolean;
  dias_corridos: boolean;
}

// ---------------------------------------------------------------------------
// Feriados nacionais fixos [mês, dia]
// ---------------------------------------------------------------------------
const FERIADOS_FIXOS: Array<[number, number]> = [
  [1,  1],   // Confraternização Universal
  [4,  21],  // Tiradentes
  [5,  1],   // Dia do Trabalho
  [9,  7],   // Independência do Brasil
  [10, 12],  // Nossa Senhora Aparecida
  [11, 2],   // Finados
  [11, 15],  // Proclamação da República
  [11, 20],  // Consciência Negra (Lei 14.759/2023)
  [12, 25],  // Natal
];

function pascoa(ano: number): Date {
  const a = ano % 19;
  const b = ano % 4;
  const c = ano % 7;
  const d = (19 * a + 24) % 30;
  const e = (2 * b + 4 * c + 6 * d + 5) % 7;
  let dia = 22 + d + e;
  let mes = 3;
  if (dia > 31) {
    dia -= 31;
    mes = 4;
    if (d === 29 && e === 6) dia = 19;
    else if (d === 28 && e === 6 && a > 10) dia = 18;
  }
  return new Date(ano, mes - 1, dia);
}

function feriadosMoveis(ano: number): Set<string> {
  const p = pascoa(ano);
  const sextaSanta = new Date(p); sextaSanta.setDate(p.getDate() - 2);
  const corpus = new Date(p); corpus.setDate(p.getDate() + 60);
  return new Set([toISO(sextaSanta), toISO(corpus)]);
}

function toISO(d: Date): string {
  return d.toISOString().split('T')[0];
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function ehFeriado(d: Date): boolean {
  const m = d.getMonth() + 1;
  const dia = d.getDate();
  if (FERIADOS_FIXOS.some(([fm, fd]) => fm === m && fd === dia)) return true;
  return feriadosMoveis(d.getFullYear()).has(toISO(d));
}

function ehDiaUtil(d: Date): boolean {
  if (d.getDay() === 0 || d.getDay() === 6) return false;
  return !ehFeriado(d);
}

function proximoDiaUtil(d: Date): Date {
  let r = addDays(d, 1);
  while (!ehDiaUtil(r)) r = addDays(r, 1);
  return r;
}

function adicionarDiasUteis(dataInicio: Date, dias: number): Date {
  let d = new Date(dataInicio);
  let contados = 0;
  while (contados < dias) {
    d = addDays(d, 1);
    if (ehDiaUtil(d)) contados++;
  }
  return d;
}

// ---------------------------------------------------------------------------
// Detecção de Juizado Especial
// ---------------------------------------------------------------------------
function ehJuizado(nomeOrgao: string | null | undefined): boolean {
  return (nomeOrgao ?? '').toUpperCase().includes('JUIZADO');
}

// ---------------------------------------------------------------------------
// Tabelas de prazos
// ---------------------------------------------------------------------------
const PRAZOS_CPC: Record<string, [number | null, string]> = {
  'Sentença':  [15, 'Apelação — Art. 1.003 c/c Art. 1.009 CPC'],
  'Acórdão':   [15, 'Recurso — Art. 1.003 CPC'],
  'Decisão':   [15, 'Agravo de instrumento ou manifestação — Art. 1.003 CPC'],
  'Despacho':  [5,  'Manifestação — Art. 218 §3 CPC'],
  'Certidão':  [5,  'Manifestação — Art. 218 §3 CPC'],
  'Edital':    [null, 'Prazo especificado no edital — verificar manualmente'],
};
const PRAZO_PADRAO_CPC: [number, string] = [15, 'Manifestação — Art. 218 §3 CPC'];

const PRAZOS_JUIZADO: Record<string, [number | null, string]> = {
  'Sentença': [10, 'Recurso inominado — Art. 41 Lei 9.099/95 (dias corridos)'],
  'Acórdão':  [10, 'Recurso — Art. 41 Lei 9.099/95 (dias corridos)'],
  'Decisão':  [10, 'Recurso — Art. 41 Lei 9.099/95 (dias corridos)'],
  'Despacho': [5,  'Embargos de declaração — Art. 49 Lei 9.099/95 (dias corridos)'],
  'Certidão': [5,  'Manifestação — Art. 49 Lei 9.099/95 (dias corridos)'],
  'Edital':   [null, 'Prazo especificado no edital — verificar manualmente'],
};
const PRAZO_PADRAO_JUIZADO: [number, string] = [10, 'Manifestação — Art. 41 Lei 9.099/95 (dias corridos)'];

// ---------------------------------------------------------------------------
// Extração de prazo mencionado no texto
// ---------------------------------------------------------------------------
const RE_PRAZO = /(?:prazo\s+de\s+|no\s+prazo\s+de\s+|fixo\s+o\s+prazo\s+de\s+)(\d+)\s*(?:\([^)]+\)\s*)?\s*dias?/i;

function extrairPrazoTexto(texto: string | null | undefined): number | null {
  if (!texto) return null;
  const m = RE_PRAZO.exec(texto);
  return m ? parseInt(m[1], 10) : null;
}

// ---------------------------------------------------------------------------
// Função principal exportada
// ---------------------------------------------------------------------------
export function calcularPrazo(
  dataDisponibilizacao: string,   // YYYY-MM-DD
  tipoDocumento: string | null | undefined,
  nomeOrgao?: string | null,
  texto?: string | null,
): PrazoResult {
  const dataBase = new Date(dataDisponibilizacao + 'T12:00:00');
  const juizado = ehJuizado(nomeOrgao);
  const prazoNoTexto = extrairPrazoTexto(texto);
  const dataIntimacao = proximoDiaUtil(dataBase);

  const tabela = juizado ? PRAZOS_JUIZADO : PRAZOS_CPC;
  const padrao = juizado ? PRAZO_PADRAO_JUIZADO : PRAZO_PADRAO_CPC;
  const tipo = tipoDocumento ?? '';

  let [dias, baseLegal] = tabela[tipo] ?? padrao;

  if (prazoNoTexto !== null) {
    dias = prazoNoTexto;
    baseLegal = `Prazo de ${dias} dias mencionado no texto — verificar base legal`;
  }

  if (dias === null) {
    return {
      data_intimacao: toISO(dataIntimacao),
      data_fim_prazo: null,
      dias_uteis: null,
      base_legal: baseLegal,
      prazo_no_texto: prazoNoTexto,
      eh_juizado: juizado,
      dias_corridos: juizado,
    };
  }

  const dataFim = juizado
    ? addDays(dataIntimacao, dias)
    : adicionarDiasUteis(dataIntimacao, dias);

  return {
    data_intimacao: toISO(dataIntimacao),
    data_fim_prazo: toISO(dataFim),
    dias_uteis: dias,
    base_legal: baseLegal,
    prazo_no_texto: prazoNoTexto,
    eh_juizado: juizado,
    dias_corridos: juizado,
  };
}
