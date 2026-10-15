// Constantes e helpers puros da aba de Tarefas — extraídas de pages/Tarefas.tsx
// sem mudança de comportamento.
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import { ptBR } from "date-fns/locale";

export const prioMeta: Record<string, { label: string; cls: string; dot: string }> = {
  alta:  { label: "Alta",  cls: "border-rose-500/30 text-rose-600 dark:text-rose-400 bg-rose-500/10", dot: "bg-rose-500" },
  media: { label: "Média", cls: "border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10", dot: "bg-amber-500" },
  baixa: { label: "Baixa", cls: "border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10", dot: "bg-emerald-500" },
};

/** Rótulo e cor do vencimento relativo a hoje. */
export const dueLabel = (dateStr: string) => {
  const d = parseISO(dateStr);
  const diff = differenceInCalendarDays(d, new Date());
  if (diff === 0) return { label: "Hoje", cls: "text-orange-500 font-bold" };
  if (diff === 1) return { label: "Amanhã", cls: "text-amber-500 font-bold" };
  if (diff < 0) return { label: `${Math.abs(diff)}d atrasada`, cls: "text-rose-500 font-black" };
  return { label: format(d, "dd/MM", { locale: ptBR }), cls: "text-muted-foreground font-semibold" };
};
