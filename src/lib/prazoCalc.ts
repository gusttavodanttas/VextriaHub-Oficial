// Cálculo de prazos processuais (dias úteis + feriados forenses) — extraído
// verbatim de NovoPrazoStandaloneDialog.tsx para poder ser testado.
//
// Base legal embutida:
//   • Dias úteis: CPC art. 219 (exclui sábado, domingo e feriado)
//   • Feriados forenses: fixos nacionais + móveis (Carnaval, Sexta-feira Santa,
//     Corpus Christi) derivados da Páscoa (Meeus/Butcher)
//   • Recesso forense: 20/12 a 20/01 inclusive (CPC art. 220) — prazos suspensos
//   • Juizado Especial: contagem em dias CORRIDOS (Lei 9.099/95)
// As versões *With aceitam feriados do escritório (anuais MM-DD e datas YYYY-MM-DD).
import { parseISO } from "date-fns";

const FERIADOS_FIXOS = new Set([
  '01-01','04-21','05-01','09-07','10-12','11-02','11-15','11-20','12-25',
]);

const _mmddOf = (d: Date) => `${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const _addDaysLocal = (base: Date, n: number) => { const d = new Date(base); d.setDate(d.getDate() + n); return d; };

// Domingo de Páscoa (algoritmo de Meeus/Butcher)
export function easterSunday(year: number): Date {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

// Feriados forenses móveis por ano (Carnaval seg/ter, Sexta-feira Santa, Corpus Christi)
const _movableCache: Record<number, Set<string>> = {};
export function movableFeriados(year: number): Set<string> {
  if (_movableCache[year]) return _movableCache[year];
  const pascoa = easterSunday(year);
  const set = new Set<string>([
    _mmddOf(_addDaysLocal(pascoa, -48)), // Carnaval (segunda)
    _mmddOf(_addDaysLocal(pascoa, -47)), // Carnaval (terça)
    _mmddOf(_addDaysLocal(pascoa, -2)),  // Sexta-feira Santa
    _mmddOf(_addDaysLocal(pascoa, 60)),  // Corpus Christi
  ]);
  _movableCache[year] = set;
  return set;
}

// Recesso forense: 20/12 a 20/01 inclusive (CPC art. 220) — prazos suspensos
export function isRecesso(d: Date) {
  const mo = d.getMonth() + 1, day = d.getDate();
  return (mo === 12 && day >= 20) || (mo === 1 && day <= 20);
}

export function isFeriado(d: Date) {
  const mmdd = _mmddOf(d);
  return FERIADOS_FIXOS.has(mmdd) || movableFeriados(d.getFullYear()).has(mmdd);
}
export function isUtil(d: Date) { const w = d.getDay(); return w !== 0 && w !== 6 && !isFeriado(d) && !isRecesso(d); }

// Versões que consideram feriados do escritório (anuais MM-DD + específicos YYYY-MM-DD)
const _ymdOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export function isUtilWith(d: Date, extraAnual: Set<string>, extraData: Set<string>) {
  const w = d.getDay();
  return w !== 0 && w !== 6 && !isFeriado(d) && !isRecesso(d) && !extraAnual.has(_mmddOf(d)) && !extraData.has(_ymdOf(d));
}
export function addDiasUteisWith(from: Date, n: number, extraAnual: Set<string>, extraData: Set<string>): Date {
  const d = new Date(from); let c = 0;
  while (c < n) { d.setDate(d.getDate() + 1); if (isUtilWith(d, extraAnual, extraData)) c++; }
  return d;
}
export function addDiasUteis(from: Date, n: number): Date {
  const d = new Date(from); let c = 0;
  while (c < n) { d.setDate(d.getDate()+1); if (isUtil(d)) c++; }
  return d;
}
export function addDiasCorridos(from: Date, n: number): Date {
  const d = new Date(from); d.setDate(d.getDate()+n); return d;
}
export function toISO(d: Date) { return d.toISOString().split('T')[0]; }
export function fromISO(s: string) { return parseISO(s); }
