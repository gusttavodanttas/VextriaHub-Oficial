// Status de prazo reutilizável (vencido / hoje / futuro) com rótulo e classe de cor.
export interface PrazoInfo {
  vencido: boolean;
  hoje: boolean;
  dias: number; // negativo = atrasado
  label: string;
  cls: string;
}

export function prazoStatus(dateStr?: string | null): PrazoInfo | null {
  if (!dateStr) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const d = new Date(`${String(dateStr).slice(0, 10)}T00:00:00`);
  if (isNaN(d.getTime())) return null;
  const dias = Math.round((d.getTime() - hoje.getTime()) / 86400000);
  const vencido = dias < 0;
  const ehHoje = dias === 0;
  let label: string;
  if (vencido) label = `Atrasado ${Math.abs(dias)}d`;
  else if (ehHoje) label = "Vence hoje";
  else if (dias === 1) label = "Vence amanhã";
  else label = `Em ${dias}d`;
  const cls = vencido
    ? "text-rose-600 dark:text-rose-400 font-black"
    : ehHoje
      ? "text-orange-600 dark:text-orange-400 font-bold"
      : "text-muted-foreground";
  return { vencido, hoje: ehHoje, dias, label, cls };
}
