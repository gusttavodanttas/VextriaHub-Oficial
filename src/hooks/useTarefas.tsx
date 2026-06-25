import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

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
  cliente_nome?: string | null;
  updated_at?: string | null;
}

export interface TarefaInput {
  titulo: string;
  descricao: string | null;
  data_vencimento: string | null;
  prioridade: string;
  cliente_id: string | null;
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
        cliente_nome: t.clientes?.nome || null,
        updated_at: t.updated_at,
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
        ...input, office_id: officeId, user_id: user.id, concluida: false, deletado: false,
      }]);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Tarefa criada", description: "A tarefa foi adicionada com sucesso." }); },
    onError: (e: any) => toast({ title: "Erro ao criar", description: e.message, variant: "destructive" }),
  });

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Partial<TarefaInput> }) => {
      const { error } = await supabase.from("tarefas").update(input).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Tarefa atualizada", description: "As alterações foram salvas." }); },
    onError: (e: any) => toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" }),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, concluida }: { id: string; concluida: boolean }) => {
      const { error } = await supabase.from("tarefas").update({ concluida }).eq("id", id);
      if (error) throw error;
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

  return { tarefas, isLoading, create, update, toggle, remove };
}
