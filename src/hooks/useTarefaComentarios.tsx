import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface TarefaComentario {
  id: string;
  tarefa_id: string;
  office_id: string;
  user_id: string;
  texto: string;
  created_at: string;
}

export function useTarefaComentarios(tarefaId: string | null | undefined) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const officeId = user?.office_id;

  const query = useQuery<TarefaComentario[]>({
    queryKey: ["tarefa-comentarios", tarefaId],
    enabled: !!tarefaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tarefa_comentarios")
        .select("*")
        .eq("tarefa_id", tarefaId!)
        .eq("deletado", false)
        .order("created_at", { ascending: true });
      if (error) return []; // tabela ainda não criada → sem comentários
      return (data || []) as TarefaComentario[];
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["tarefa-comentarios", tarefaId] });
    queryClient.invalidateQueries({ queryKey: ["tarefa-coment-counts"] });
  };

  const add = useMutation({
    mutationFn: async (texto: string) => {
      if (!tarefaId || !officeId || !user?.id) throw new Error("Sem tarefa/escritório/usuário");
      const { error } = await supabase.from("tarefa_comentarios").insert({
        tarefa_id: tarefaId, office_id: officeId, user_id: user.id, texto: texto.trim(),
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast({ title: "Erro ao comentar", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tarefa_comentarios").update({ deletado: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" }),
  });

  return { comentarios: query.data || [], isLoading: query.isLoading, add, remove };
}
