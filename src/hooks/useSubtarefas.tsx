import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface Subtarefa {
  id: string;
  tarefa_id: string;
  office_id: string;
  titulo: string;
  concluida: boolean;
  ordem: number;
  created_at: string;
}

export function useSubtarefas(tarefaId: string | null | undefined) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const officeId = user?.office_id;

  const query = useQuery<Subtarefa[]>({
    queryKey: ["subtarefas", tarefaId],
    enabled: !!tarefaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tarefa_subtarefas")
        .select("*")
        .eq("tarefa_id", tarefaId!)
        .eq("deletado", false)
        .order("ordem", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) return []; // tabela ainda não criada
      return (data || []) as Subtarefa[];
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["subtarefas", tarefaId] });
    queryClient.invalidateQueries({ queryKey: ["subtarefa-counts"] });
  };

  const add = useMutation({
    mutationFn: async (titulo: string) => {
      if (!tarefaId || !officeId) throw new Error("Sem tarefa/escritório");
      const ordem = (query.data?.length ?? 0);
      const { error } = await supabase.from("tarefa_subtarefas").insert({
        tarefa_id: tarefaId, office_id: officeId, titulo: titulo.trim(), ordem,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast({ title: "Erro ao adicionar item", description: e.message, variant: "destructive" }),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, concluida }: { id: string; concluida: boolean }) => {
      const { error } = await supabase.from("tarefa_subtarefas").update({ concluida }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tarefa_subtarefas").update({ deletado: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" }),
  });

  return { subtarefas: query.data || [], isLoading: query.isLoading, add, toggle, remove };
}
