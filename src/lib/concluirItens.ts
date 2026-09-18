// Lógica de "concluir" compartilhada entre a tela de Tarefas (useTarefas.tsx),
// a tela de Prazos (usePrazosData.tsx) e o dialog de item do Dashboard/Agenda
// (AgendaItemDialog.tsx). Antes cada um tinha sua própria cópia do update +
// fallback (colunas de auditoria podem não existir em ambientes antigos) — as
// cópias já haviam divergido: a de AgendaItemDialog gerava a próxima ocorrência
// de uma tarefa recorrente sem propagar avisos_dias, ao contrário da de
// useTarefas.tsx. Centralizado aqui pra uma correção valer nos três lugares.
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { continueOccurrences, type RecRule } from "@/lib/recorrencia";

export async function concluirPrazoDb(id: string, userId?: string | null) {
  const now = new Date().toISOString();
  let { data, error } = await supabase
    .from("prazos")
    .update({ status: "concluido", concluido_em: now, concluido_por: userId ?? null })
    .eq("id", id)
    .select("id");
  if (error) ({ data, error } = await supabase.from("prazos").update({ status: "concluido" }).eq("id", id).select("id"));
  return { data, error };
}

export async function concluirPrazosBulkDb(ids: string[], userId?: string | null) {
  const now = new Date().toISOString();
  let { data, error } = await supabase
    .from("prazos")
    .update({ status: "concluido", concluido_em: now, concluido_por: userId ?? null })
    .in("id", ids)
    .select("id");
  if (error) ({ data, error } = await supabase.from("prazos").update({ status: "concluido" }).in("id", ids).select("id"));
  return { data, error };
}

export function tarefaConcluidaFields(userId?: string | null) {
  return {
    concluida: true,
    status: "concluida",
    concluida_em: new Date().toISOString(),
    concluida_por: userId ?? null,
    recorrencia_restantes: 0,
  };
}

export async function concluirTarefaDb(id: string, userId?: string | null) {
  let { data, error } = await supabase.from("tarefas").update(tarefaConcluidaFields(userId)).eq("id", id).select("id");
  if (error) ({ data, error } = await supabase.from("tarefas").update({ concluida: true }).eq("id", id).select("id"));
  return { data, error };
}

export interface TarefaRecInfo {
  titulo: string;
  descricao?: string | null;
  prioridade?: string | null;
  cliente_id?: string | null;
  processo_id?: string | null;
  atendimento_id?: string | null;
  responsavel_id?: string | null;
  recorrencia_grupo?: string | null;
  recorrencia_regra?: string | null;
  recorrencia_restantes?: number | null;
  data_vencimento?: string | null;
  avisos_dias?: number[] | null;
}

// Gera a PRÓXIMA ocorrência de uma tarefa recorrente ao concluir a atual
// (best-effort, não bloqueia a conclusão se o insert falhar).
export async function gerarProximaOcorrenciaTarefa(tarefa: TarefaRecInfo, officeId: string, userId: string) {
  if (!(tarefa.recorrencia_regra && (tarefa.recorrencia_restantes ?? 0) > 0 && tarefa.data_vencimento)) return;
  const base = new Date(`${tarefa.data_vencimento}T12:00:00`);
  const next = continueOccurrences(base, tarefa.recorrencia_regra as RecRule, 1)[0];
  const row: any = {
    titulo: tarefa.titulo,
    descricao: tarefa.descricao ?? null,
    prioridade: tarefa.prioridade ?? "media",
    cliente_id: tarefa.cliente_id ?? null,
    processo_id: tarefa.processo_id ?? null,
    atendimento_id: tarefa.atendimento_id ?? null,
    responsavel_id: tarefa.responsavel_id ?? null,
    recorrencia_grupo: tarefa.recorrencia_grupo ?? null,
    recorrencia_regra: tarefa.recorrencia_regra,
    recorrencia_restantes: (tarefa.recorrencia_restantes ?? 0) - 1,
    data_vencimento: format(next, "yyyy-MM-dd"),
    office_id: officeId,
    user_id: userId,
    concluida: false,
    deletado: false,
    ...(Array.isArray(tarefa.avisos_dias) ? { avisos_dias: tarefa.avisos_dias } : {}),
  };
  await supabase.from("tarefas").insert([row]);
}
