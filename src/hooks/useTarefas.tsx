import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { continueOccurrences, RecRule } from "@/lib/recorrencia";

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

// Monta o payload de insert/update incluindo atendimento_id só quando há valor
// (evita erro caso a coluna ainda não tenha sido criada via SQL).
function buildPayload(input: Partial<TarefaInput>) {
  const p: any = {};
  if (input.titulo !== undefined) p.titulo = input.titulo;
  if (input.descricao !== undefined) p.descricao = input.descricao;
  if (input.data_vencimento !== undefined) p.data_vencimento = input.data_vencimento;
  if (input.prioridade !== undefined) p.prioridade = input.prioridade;
  if (input.cliente_id !== undefined) p.cliente_id = input.cliente_id;
  if (input.processo_id !== undefined) p.processo_id = input.processo_id;
  if (input.atendimento_id) p.atendimento_id = input.atendimento_id;
  if (input.recorrencia_grupo) p.recorrencia_grupo = input.recorrencia_grupo;
  if (input.recorrencia_regra) p.recorrencia_regra = input.recorrencia_regra;
  if (input.recorrencia_restantes !== undefined && input.recorrencia_restantes !== null) p.recorrencia_restantes = input.recorrencia_restantes;
  if (input.responsavel_id !== undefined) p.responsavel_id = input.responsavel_id;
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
    queryClient.invalidateQueries({ queryKey: ["stats"] });
  };

  const create = useMutation({
    mutationFn: async (input: TarefaInput) => {
      if (!officeId || !user?.id) throw new Error("Sem escritório/usuário");
      const { error } = await supabase.from("tarefas").insert([{
        ...buildPayload(input), office_id: officeId, user_id: user.id, concluida: false, deletado: false,
      }]);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Tarefa criada", description: "A tarefa foi adicionada com sucesso." }); },
    onError: (e: any) => toast({ title: "Erro ao criar", description: e.message, variant: "destructive" }),
  });

  const createMany = useMutation({
    mutationFn: async (inputs: TarefaInput[]) => {
      if (!officeId || !user?.id) throw new Error("Sem escritório/usuário");
      const rows = inputs.map(input => ({
        ...buildPayload(input), office_id: officeId, user_id: user.id, concluida: false, deletado: false,
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
    onError: (e: any) => toast({ title: "Erro ao criar", description: e.message, variant: "destructive" }),
  });

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Partial<TarefaInput> }) => {
      const { error } = await supabase.from("tarefas").update(buildPayload(input)).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Tarefa atualizada", description: "As alterações foram salvas." }); },
    onError: (e: any) => toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" }),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, concluida, tarefa }: { id: string; concluida: boolean; tarefa?: Tarefa }) => {
      const now = new Date().toISOString();
      // 1) marca concluída/reaberta com auditoria (data/autor); fallback se as colunas não existirem
      const full: any = concluida
        ? { concluida: true, concluida_em: now, concluida_por: user?.id, recorrencia_restantes: 0 }
        : { concluida: false, concluida_em: null, concluida_por: null };
      let { error } = await supabase.from("tarefas").update(full).eq("id", id);
      if (error) ({ error } = await supabase.from("tarefas").update({ concluida }).eq("id", id));
      if (error) throw error;

      // 2) recorrência encadeada: ao concluir, gera a PRÓXIMA ocorrência
      if (concluida && tarefa?.recorrencia_regra && (tarefa.recorrencia_restantes ?? 0) > 0 && tarefa.data_vencimento && officeId && user?.id) {
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
        await supabase.from("tarefas").insert([row]); // best-effort (não bloqueia a conclusão)
      }
    },
    onSuccess: () => invalidate(),
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("tarefas").update({ deletado: true }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_d, ids) => { invalidate(); toast({ title: "Tarefa(s) excluída(s)", description: `${ids.length} tarefa(s) movida(s) para a lixeira.` }); },
    onError: (e: any) => toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" }),
  });

  return { tarefas, isLoading, create, createMany, update, toggle, remove };
}
