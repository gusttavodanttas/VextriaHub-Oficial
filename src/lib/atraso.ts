// Lógica pura de ATRASO. Um item pendente cuja data já passou está atrasado e
// precisa continuar aparecendo — hoje, e não no dia em que venceu.
//
// O bug que isto conserta: a Agenda (lista) e o painel do dashboard filtravam
// "a partir de hoje". Um prazo/tarefa de ontem que você não concluiu ficava
// parado na célula de ontem e sumia da tela — só reaparecia se você clicasse
// no dia anterior ou abrisse a aba do próprio módulo. Justamente o item mais
// urgente do escritório era o único invisível.
import { diasAte } from "./proximityAlert";

/** Item pendente com data no passado. Data vazia/inválida nunca está atrasada. */
export function estaAtrasado(dateStr?: string | null, hoje: Date = new Date()): boolean {
  if (!dateStr) return false;
  const d = new Date(String(dateStr).length <= 10 ? `${dateStr}T12:00:00` : dateStr);
  if (isNaN(d.getTime())) return false;
  return diasAte(String(dateStr), hoje) < 0;
}

/** Dias de calendário desde o vencimento. 0 quando não está atrasado. */
export function diasDeAtraso(dateStr?: string | null, hoje: Date = new Date()): number {
  if (!estaAtrasado(dateStr, hoje)) return 0;
  return Math.abs(diasAte(String(dateStr), hoje));
}

/** Rótulo humano: "venceu ontem" / "venceu há 5 dias". "" se estiver em dia. */
export function atrasoLabel(dateStr?: string | null, hoje: Date = new Date()): string {
  const d = diasDeAtraso(dateStr, hoje);
  if (d === 0) return "";
  return d === 1 ? "venceu ontem" : `venceu há ${d} dias`;
}

/** Data fatal do item da agenda, por tipo — a mesma regra usada nas queries.
 *  Prazo legado guarda a data só em data_vencimento; ignorá-la some com o item. */
export function dataFatalDoItem(item: {
  data_fim_prazo?: string | null;
  data_vencimento?: string | null;
  data_audiencia?: string | null;
  data_atendimento?: string | null;
  prazo?: string | null;
}): string | null {
  return (
    item.data_fim_prazo ||
    item.data_vencimento ||
    item.data_audiencia ||
    item.data_atendimento ||
    item.prazo ||
    null
  );
}
