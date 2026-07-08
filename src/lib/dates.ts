// Utilitários centrais de data. Duas classes de bug que eles eliminam:
//
// 1) FUSO: `new Date("2026-07-03")` é interpretado como UTC e, em UTC-3,
//    vira 2 de julho às 21h — todas as datas "só dia" caíam um dia para trás.
//    parseLocalDate ancora datas YYYY-MM-DD ao meio-dia LOCAL.
//
// 2) CRASH: `format(new Date(x))` lança RangeError com data inválida; dentro
//    de um setState/useMemo isso aborta o render inteiro (form de edição em
//    branco, página derrubada). fmtDate/fmtSafe nunca lançam.

import { format } from "date-fns";
import type { Locale } from "date-fns";

/** Converte string de data em Date LOCAL. Date-only (YYYY-MM-DD) vira meio-dia
 *  local (imune ao fuso); timestamps ISO são parseados normalmente.
 *  Retorna null para vazio/inválido — nunca lança. */
export function parseLocalDate(s?: string | null): Date | null {
  if (!s) return null;
  const str = String(s).trim();
  if (!str) return null;
  const d = new Date(str.length <= 10 ? `${str}T12:00:00` : str);
  return isNaN(d.getTime()) ? null : d;
}

/** Alias com o nome já usado em telas antigas (parse defensivo de ISO). */
export const safeParseISO = parseLocalDate;

/** format() que nunca lança: data inválida/vazia → fallback (padrão ""). */
export function fmtDate(
  s: string | null | undefined,
  pattern: string,
  opts?: { locale?: Locale; fallback?: string },
): string {
  const d = parseLocalDate(s);
  if (!d) return opts?.fallback ?? "";
  return format(d, pattern, opts?.locale ? { locale: opts.locale } : undefined);
}

/** Alias compatível com o helper local que existia em Atendimentos. */
export const fmtSafe = (s: string | null | undefined, pattern: string, fallback = "") =>
  fmtDate(s, pattern, { fallback });

/** dd/MM/yyyy pt-BR sem risco de exceção. */
export function fmtDataBR(s?: string | null): string {
  const d = parseLocalDate(s);
  return d ? d.toLocaleDateString("pt-BR") : "";
}

/** YYYY-MM-DD do ponto de vista LOCAL (não use toISOString para isso). */
export function localYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
