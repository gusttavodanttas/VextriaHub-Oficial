import { addDays, addWeeks, addMonths } from "date-fns";

export type RecRule = "diaria" | "semanal" | "quinzenal" | "mensal" | "diasUteis";

export const RECORRENCIAS: { value: string; label: string }[] = [
  { value: "nenhuma", label: "Não repetir" },
  { value: "diaria", label: "Diária" },
  { value: "diasUteis", label: "Dias úteis (seg–sex)" },
  { value: "semanal", label: "Semanal" },
  { value: "quinzenal", label: "Quinzenal" },
  { value: "mensal", label: "Mensal" },
];

export const recorrenciaLabel = (v?: string | null) =>
  RECORRENCIAS.find(r => r.value === v)?.label ?? "Recorrência";

function step(base: Date, rule: RecRule, i: number): Date {
  switch (rule) {
    case "diaria": return addDays(base, i);
    case "semanal": return addWeeks(base, i);
    case "quinzenal": return addDays(base, i * 14);
    case "mensal": return addMonths(base, i);
    default: return base;
  }
}

const isWeekday = (d: Date) => d.getDay() !== 0 && d.getDay() !== 6;

/** Gera `count` datas a partir de `base` (inclusive). */
export function generateOccurrences(base: Date, rule: RecRule, count: number): Date[] {
  if (rule === "diasUteis") {
    const out: Date[] = [];
    let d = new Date(base);
    while (out.length < count) { if (isWeekday(d)) out.push(new Date(d)); d = addDays(d, 1); }
    return out;
  }
  return Array.from({ length: count }, (_, i) => step(base, rule, i));
}

/** Gera `count` datas após `after` (exclusivo) — usado para estender uma série. */
export function continueOccurrences(after: Date, rule: RecRule, count: number): Date[] {
  if (rule === "diasUteis") {
    const out: Date[] = [];
    let d = addDays(after, 1);
    while (out.length < count) { if (isWeekday(d)) out.push(new Date(d)); d = addDays(d, 1); }
    return out;
  }
  return Array.from({ length: count }, (_, i) => step(after, rule, i + 1));
}
