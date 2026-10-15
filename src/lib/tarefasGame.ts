// Gamificação da aba de Tarefas (dados reais) — função pura, extraída de
// pages/Tarefas.tsx sem mudança de comportamento. Usa a data de conclusão
// auditada (concluida_em); cai para updated_at só em tarefas antigas.
import { format, parseISO, startOfWeek, subDays } from "date-fns";

type TarefaGame = { concluida: boolean; concluida_em?: string | null; updated_at?: string | null };

export function calcularGame(tarefas: TarefaGame[]) {
  const compTs = (t: TarefaGame) => t.concluida_em || t.updated_at || null;
  const concluidas = tarefas.filter(t => t.concluida && compTs(t));
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const concluidasSemana = concluidas.filter(t => parseISO(compTs(t)!) >= weekStart).length;
  const totalConcluidas = tarefas.filter(t => t.concluida).length;
  const pontos = totalConcluidas * 10;
  const nivel = Math.floor(pontos / 100) + 1;
  // Sequência (streak): dias consecutivos com ao menos 1 tarefa concluída
  const dias = new Set(concluidas.map(t => format(parseISO(compTs(t)!), "yyyy-MM-dd")));
  let streak = 0;
  let cursor = new Date();
  if (!dias.has(format(cursor, "yyyy-MM-dd"))) cursor = subDays(cursor, 1);
  while (dias.has(format(cursor, "yyyy-MM-dd"))) { streak++; cursor = subDays(cursor, 1); }
  const metaSemanal = 10;
  return { concluidasSemana, pontos, nivel, streak, metaSemanal, progresso: Math.min(100, Math.round((concluidasSemana / metaSemanal) * 100)) };
}

export type Game = ReturnType<typeof calcularGame>;
