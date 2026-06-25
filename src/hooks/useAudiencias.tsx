import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface Audiencia {
  id: string;
  titulo: string;
  tipo: string | null;
  data_audiencia: string; // ISO com data + hora
  local: string | null;
  status: string | null;
  observacoes: string | null;
  cliente_id: string | null;
  processo_id: string | null;
  cliente_nome?: string | null;
}

export interface AudienciaInput {
  titulo: string;
  tipo: string | null;
  data_audiencia: string;
  local: string | null;
  status: string;
  observacoes: string | null;
  cliente_id: string | null;
}

export function useAudiencias() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const officeId = user?.office_id;

  const { data: audiencias = [], isLoading } = useQuery<Audiencia[]>({
    queryKey: ["audiencias", officeId],
    queryFn: async () => {
      if (!officeId) return [];
      const { data, error } = await supabase
        .from("audiencias")
        .select("*, clientes!cliente_id(nome)")
        .eq("office_id", officeId)
        .eq("deletado", false)
        .order("data_audiencia", { ascending: true });
      if (error) throw error;
      return (data || []).map((a: any) => ({
        id: a.id,
        titulo: a.titulo,
        tipo: a.tipo,
        data_audiencia: a.data_audiencia,
        local: a.local,
        status: a.status,
        observacoes: a.observacoes,
        cliente_id: a.cliente_id,
        processo_id: a.processo_id,
        cliente_nome: a.clientes?.nome || null,
      }));
    },
    enabled: !!officeId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["audiencias"] });
    queryClient.invalidateQueries({ queryKey: ["stats"] });
  };

  const create = useMutation({
    mutationFn: async (input: AudienciaInput) => {
      if (!officeId || !user?.id) throw new Error("Sem escritório/usuário");
      const { error } = await supabase.from("audiencias").insert([{
        ...input,
        office_id: officeId,
        user_id: user.id,
        deletado: false,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Audiência criada", description: "A audiência foi agendada com sucesso." });
    },
    onError: (e: any) => toast({ title: "Erro ao criar", description: e.message, variant: "destructive" }),
  });

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Partial<AudienciaInput> }) => {
      const { error } = await supabase.from("audiencias").update(input).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Audiência atualizada", description: "As alterações foram salvas." });
    },
    onError: (e: any) => toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" }),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("audiencias").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("audiencias").update({ deletado: true }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_d, ids) => {
      invalidate();
      toast({ title: "Audiência(s) excluída(s)", description: `${ids.length} audiência(s) movida(s) para a lixeira.` });
    },
    onError: (e: any) => toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" }),
  });

  return { audiencias, isLoading, create, update, updateStatus, remove };
}
