import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { continueOccurrences, RecRule } from "@/lib/recorrencia";
import { planQuotaMessage } from "@/lib/planQuotaError";
import { assertRowsAffected } from "@/lib/errors";
import type { TablesUpdate } from "@/integrations/supabase/rows";

export interface Tarefa {
  id: string;
  titulo: string;
  descricao: string | null;
  data_vencimento: string | null;
  prioridade: string | null;
  concluida: boolean;
  status: string | null;
  cliente_id: string | null;
  processo_id: string | null;
  atendimento_id: string | null;
  recorrencia_grupo: string | null;
  recorrencia_regra: string | null;
  recorrencia_restantes?: number | null;
  cliente_nome?: string | null;
  updated_at?: string | null;
  responsavel_id?: string | null;
  concluida_em?: string | null;
  concluida_por?: string | null;
  avisos_dias?: number[] | null;
}

export interface TarefaInput {
  titulo: string;
  descricao: string | null;
  data_vencimento: string | null;
  prioridade: string;
  cliente_id: string | null;
  processo_id?: string | null;
  atendimento_id?: string | null;
  recorrencia_grupo?: string | null;
  recorrencia_regra?: string | null;
  recorrencia_restantes?: number | null;
  responsavel_id?: string | null;
  avisos_dias?: number[] | null;
}

// Coloca null onde chega string vazia numa coluna uuid — senão o Postgres rejeita
// com "invalid input syntax for type uuid: \"\"". `?? null` NÃO pega "" (só null/
// undefined), então "" de qualquer chamador (inclusive bundle antigo em cache)
// quebrava o salvar. Aqui é o gargalo único de todo write de tarefa. (v11)
const uuidOrNull = (v: unknown) => (v === "" || v == null ? null : (v as string));

// Monta o payload de insert/update incluindo atendimento_id só quando há valor
// (evita erro caso a coluna ainda não tenha sido criada via SQL).
function buildPayload(input: Partial<TarefaInput>) {
  const p: TablesUpdate<"tarefas"> = {};
  if (input.titulo !== undefined) p.titulo = input.titulo;
  if (input.descricao !== undefined) p.descricao = input.descricao;
  if (input.data_vencimento !== undefined) p.data_vencimento = input.data_vencimento || null;
  if (input.prioridade !== undefined) p.prioridade = input.prioridade;
  if (input.cliente_id !== undefined) p.cliente_id = uuidOrNull(input.cliente_id);
  if (input.processo_id !== undefined) p.processo_id = uuidOrNull(input.processo_id);
  if (input.atendimento_id) p.atendimento_id = input.atendimento_id;
  // Recorrência: usa "in" para permitir limpar (null) ao editar a série.
  if ("recorrencia_grupo" in input) p.recorrencia_grupo = uuidOrNull(input.recorrencia_grupo);
  if ("recorrencia_regra" in input) p.recorrencia_regra = input.recorrencia_regra ?? null;
  if ("recorrencia_restantes" in input) p.recorrencia_restantes = input.recorrencia_restantes ?? null;
  if (input.responsavel_id !== undefined) p.responsavel_id = uuidOrNull(input.responsavel_id);
  if (input.avisos_dias !== undefined) p.avisos_dias = input.avisos_dias;
  return p;
}

export function useTarefas() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const officeId = user?.office_id;

  const { data: tarefas = [], isLoading } = useQuery<Tarefa[]>({
    queryKey: ["tarefas", officeId],
    queryFn: async () => {
      if (!officeId) return [];
      const { data, error } = await supabase
        .from("tarefas")
        .select("*, clientes!cliente_id(nome)")
        .eq("office_id", officeId)
        .eq("deletado", false)
        .order("data_vencimento", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data || []).map((t: any) => ({
        id: t.id,
        titulo: t.titulo,
        descricao: t.descricao,
        data_vencimento: t.data_vencimento,
        prioridade: t.prioridade,
        concluida: !!t.concluida,
        status: t.status,
        cliente_id: t.cliente_id,
        processo_id: t.processo_id,
        atendimento_id: t.atendimento_id ?? null,
        recorrencia_grupo: t.recorrencia_grupo ?? null,
        recorrencia_regra: t.recorrencia_regra ?? null,
        recorrencia_restantes: t.recorrencia_restantes ?? null,
        cliente_nome: t.clientes?.nome || null,
        updated_at: t.updated_at,
        responsavel_id: t.responsavel_id ?? null,
        concluida_em: t.concluida_em ?? null,
        concluida_por: t.concluida_por ?? null,
        avisos_dias: t.avisos_dias ?? null,
      }));
    },
    enabled: !!officeId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["tarefas"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-tarefas"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
  };

  const create = useMutation({
    mutationFn: async (input: TarefaInput) => {
      if (!officeId || !user?.id) throw new Error("Sem escritório/usuário");
      const { error } = await supabase.from("tarefas").insert([{
        ...buildPayload(input), titulo: input.titulo, office_id: officeId, user_id: user.id, concluida: false, deletado: false,
      }]);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Tarefa criada", description: "A tarefa foi adicionada com sucesso." }); },
    onError: (e) => {
      const quota = planQuotaMessage(e);
      toast({ title: quota?.title ?? "Erro ao criar", description: quota?.description ?? e.message, variant: "destructive" });
    },
  });

  const createMany = useMutation({
    mutationFn: async (inputs: TarefaInput[]) => {
      if (!officeId || !user?.id) throw new Error("Sem escritório/usuário");
      const rows = inputs.map(input => ({
        ...buildPayload(input), titulo: input.titulo, office_id: officeId, user_id: user.id, concluida: false, deletado: false,
      }));
      let { error } = await supabase.from("tarefas").insert(rows);
      // Fallback: colunas de série ainda não criadas → recria sem elas
      if (error && /recorrencia_grupo|recorrencia_regra/.test(error.message || "")) {
        const stripped = rows.map(({ recorrencia_grupo, recorrencia_regra, ...r }: any) => r);
        ({ error } = await supabase.from("tarefas").insert(stripped));
      }
      if (error) throw error;
    },
    onSuccess: (_d, inputs) => { invalidate(); toast({ title: "Tarefas criadas", description: `${inputs.length} ocorrências adicionadas.` }); },
    onError: (e) => toast({ title: "Erro ao criar", description: e.message, variant: "destructive" }),
  });

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Partial<TarefaInput> }) => {
      const { data, error } = await supabase.from("tarefas").update(buildPayload(input)).eq("id", id).select("id");
      assertRowsAffected(data, error, 1);
    },
    onSuccess: () => { invalidate(); toast({ title: "Tarefa atualizada", description: "As alterações foram salvas." }); },
    onError: (e) => toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" }),
  });

  // Adia o vencimento para o dia seguinte (1 clique, sem abrir o formulário).
  // Nunca puxa pra trás: parte do MAIOR entre hoje e o vencimento atual, +1 dia —
  // então tarefa vencida/de hoje vai pra amanhã e tarefa futura anda 1 dia. (v11)
  const adiar = useMutation({
    mutationFn: async (tarefa: Tarefa) => {
      const hoje = new Date(); hoje.setHours(12, 0, 0, 0);
      const due = tarefa.data_vencimento ? new Date(`${tarefa.data_vencimento}T12:00:00`) : hoje;
      const base = due > hoje ? due : hoje;
      base.setDate(base.getDate() + 1);
      const { data, error } = await supabase.from("tarefas").update({ data_vencimento: format(base, "yyyy-MM-dd") }).eq("id", tarefa.id).select("id");
      assertRowsAffected(data, error, 1);
    },
    onSuccess: () => { invalidate(); toast({ title: "Tarefa adiada", description: "Vencimento movido para o dia seguinte." }); },
    onError: (e) => toast({ title: "Erro ao adiar", description: e.message, variant: "destructive" }),
  });

  // Gera a PRÓXIMA ocorrência de uma tarefa recorrente concluída (best-effort). Usado
  // tanto na conclusão individual quanto EM MASSA (antes o bulk encerrava a série).
  const gerarProximaOcorrencia = async (tarefa: Tarefa) => {
    if (!(tarefa.recorrencia_regra && (tarefa.recorrencia_restantes ?? 0) > 0 && tarefa.data_vencimento && officeId && user?.id)) return;
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
      office_id: officeId, user_id: user.id, concluida: false, deletado: false,
      ...(Array.isArray(tarefa.avisos_dias) ? { avisos_dias: tarefa.avisos_dias } : {}),
    };
    await supabase.from("tarefas").insert([row]);
  };

  const toggle = useMutation({
    mutationFn: async ({ id, concluida, tarefa }: { id: string; concluida: boolean; tarefa?: Tarefa }) => {
      const now = new Date().toISOString();
      // 1) marca concluída/reaberta com auditoria (data/autor); fallback se as colunas não existirem
      // Seta status junto de concluida — antes ficava 'pendente' com concluida=true,
      // e qualquer relatório que filtre por status contava errado. (v12)
      const full: any = concluida
        ? { concluida: true, status: 'concluida', concluida_em: now, concluida_por: user?.id, recorrencia_restantes: 0 }
        : { concluida: false, status: 'pendente', concluida_em: null, concluida_por: null };
      let { data, error } = await supabase.from("tarefas").update(full).eq("id", id).select("id");
      if (error) ({ data, error } = await supabase.from("tarefas").update({ concluida }).eq("id", id).select("id"));
      assertRowsAffected(data, error, 1);

      // 2) recorrência encadeada: ao concluir, gera a PRÓXIMA ocorrência
      if (concluida && tarefa) await gerarProximaOcorrencia(tarefa);
    },
    onSuccess: () => invalidate(),
    onError: (e) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (ids: string[]) => {
      const { data, error } = await supabase.from("tarefas").update({ deletado: true }).in("id", ids).select("id");
      assertRowsAffected(data, error, ids.length);
    },
    onSuccess: (_d, ids) => { invalidate(); toast({ title: "Tarefa(s) excluída(s)", description: `${ids.length} tarefa(s) movida(s) para a lixeira.` }); },
    onError: (e) => toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" }),
  });

  // Ações em lote (concluir/reabrir, prioridade, responsável, prazo)
  const bulkPatch = useMutation({
    mutationFn: async ({ ids, patch, concluir }: { ids: string[]; patch?: Record<string, any>; concluir?: boolean }) => {
      const now = new Date().toISOString();
      // Snapshot ANTES do update: captura as recorrentes com ocorrências restantes
      // (o update zera recorrencia_restantes, então precisa ser antes).
      let recorrentes: Tarefa[] = [];
      if (concluir === true) {
        const { data } = await supabase.from("tarefas").select("*").in("id", ids);
        recorrentes = ((data || []) as Tarefa[]).filter((t) => t.recorrencia_regra && (t.recorrencia_restantes ?? 0) > 0 && t.data_vencimento);
      }
      const payload: Record<string, any> = { ...(patch || {}) };
      if (concluir === true) Object.assign(payload, { concluida: true, status: 'concluida', concluida_em: now, concluida_por: user?.id ?? null, recorrencia_restantes: 0 });
      if (concluir === false) Object.assign(payload, { concluida: false, status: 'pendente', concluida_em: null, concluida_por: null });
      const { data, error } = await supabase.from("tarefas").update(payload).in("id", ids).select("id");
      assertRowsAffected(data, error, ids.length);
      // Gera a próxima ocorrência de cada recorrente concluída (não deixa a série morrer no bulk).
      for (const t of recorrentes) await gerarProximaOcorrencia(t);
    },
    onSuccess: () => { invalidate(); toast({ title: "Tarefas atualizadas" }); },
    onError: (e) => toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" }),
  });

  return { tarefas, isLoading, create, createMany, update, adiar, toggle, remove, bulkPatch };
}
