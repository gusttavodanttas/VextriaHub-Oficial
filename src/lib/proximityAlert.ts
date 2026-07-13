// Lógica pura do aviso de proximidade (o "sino" avisa prazo/audiência/tarefa/
// atendimento antes de vencer). Extraída de useProximityNotifications para ser
// testável — é a corrente que faz o escritório NÃO perder um prazo fatal.
import { differenceInCalendarDays, startOfDay } from "date-fns";

// Data-only (YYYY-MM-DD) é lida como meio-dia local, evitando o −1 dia de fuso.
const parse = (dateStr: string): Date =>
  startOfDay(new Date(dateStr.length <= 10 ? `${dateStr}T12:00:00` : dateStr));

/** Dias de calendário de `hoje` até `dateStr` (negativo = já passou). */
export function diasAte(dateStr: string, hoje: Date = new Date()): number {
  return differenceInCalendarDays(parse(dateStr), startOfDay(hoje));
}

/** Rótulo humano de proximidade: "hoje" / "amanhã" / "em N dias". */
export function proxLabel(dateStr: string, hoje: Date = new Date()): string {
  const diff = diasAte(dateStr, hoje);
  return diff <= 0 ? "hoje" : diff === 1 ? "amanhã" : `em ${diff} dias`;
}

/** Marcos de antecedência do item, em dias: o array `avisos_dias` (só > 0);
 *  senão o legado `aviso_dias`; senão o padrão global do usuário.
 *  Array vazio ou [0] = o usuário optou por NÃO ser avisado daquele item. */
export function marcosDe(
  it: { avisos_dias?: number[] | null; aviso_dias?: number | null },
  padrao: number,
): number[] {
  if (Array.isArray(it.avisos_dias)) return it.avisos_dias.filter((d) => d > 0);
  if (it.aviso_dias != null) return it.aviso_dias > 0 ? [it.aviso_dias] : [];
  return [padrao];
}

/** Deve disparar o aviso? Só na janela de hoje (0) até o marco D — nunca no
 *  passado (d < 0) nem antes de entrar na antecedência (d > D). */
export function deveAvisar(dias: number, marco: number): boolean {
  return dias >= 0 && dias <= marco;
}

/** Data fatal do prazo: `data_fim_prazo` (padrão atual) ou `data_vencimento`
 *  (legado). A query de alerta PRECISA olhar as duas — prazos antigos guardam
 *  a data só em data_vencimento e ficariam sem aviso se olhássemos só a nova. */
export function dataFatalPrazo(
  prazo: { data_fim_prazo?: string | null; data_vencimento?: string | null },
): string | null {
  return prazo.data_fim_prazo || prazo.data_vencimento || null;
}
