import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { ExclusaoPendente } from '@/types/database';

export const useExclusoesPendentes = () => {
  const { user, isSuperAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data = [], isLoading: loading, error: queryError } = useQuery({
    queryKey: ['exclusoes_pendentes', user?.id, isSuperAdmin],
    queryFn: async () => {
      if (!user || !isSuperAdmin) return [];
      const { data: result, error } = await supabase
        .from('exclusoes_pendentes')
        .select(`
          *,
          user:profiles(full_name, email)
        `)
        .eq('status', 'pendente')
        .order('solicitado_em', { ascending: false });

      if (error) throw error;
      return result || [];
    },
    enabled: !!user && isSuperAdmin,
  });

  const error = queryError ? (queryError instanceof Error ? queryError.message : 'Erro desconhecido') : null;

  const aprovarMutation = useMutation({
    mutationFn: async (exclusaoId: string) => {
      if (!user || !isSuperAdmin) return false;
      const exclusao = data.find((e: any) => e.id === exclusaoId) as Record<string, any>; // dynamic tabela + join fields from DB
      if (!exclusao) return false;

      const { error: deleteError } = await supabase
        .from(exclusao.tabela as string)
        .update({ deletado: true, deletado_pendente: false })
        .eq('id', exclusao.registro_id);
      if (deleteError) throw deleteError;

      const { error: updateError } = await supabase
        .from('exclusoes_pendentes')
        .update({ status: 'aprovado', aprovado_por: user.id, aprovado_em: new Date().toISOString() })
        .eq('id', exclusaoId);
      if (updateError) throw updateError;

      return true;
    },
    onSuccess: (_, exclusaoId) => {
      queryClient.setQueryData(['exclusoes_pendentes', user?.id, isSuperAdmin], (old: Record<string, any>[] = []) => 
        old.filter((item) => item.id !== exclusaoId)
      );
      toast({ title: 'Exclusão aprovada', description: 'O registro foi excluído com sucesso.' });
    },
    onError: () => toast({ title: 'Erro ao aprovar exclusão', description: 'Não foi possível processar a aprovação.', variant: 'destructive' }),
  });

  const rejeitarMutation = useMutation({
    mutationFn: async (exclusaoId: string) => {
      if (!user || !isSuperAdmin) return false;
      const exclusao = data.find((e: any) => e.id === exclusaoId) as Record<string, any>;
      if (!exclusao) return false;

      const { error: revertError } = await supabase
        .from(exclusao.tabela as string)
        .update({ deletado_pendente: false })
        .eq('id', exclusao.registro_id);
      if (revertError) throw revertError;

      const { error: updateError } = await supabase
        .from('exclusoes_pendentes')
        .update({ status: 'rejeitado', aprovado_por: user.id, aprovado_em: new Date().toISOString() })
        .eq('id', exclusaoId);
      if (updateError) throw updateError;

      return true;
    },
    onSuccess: (_, exclusaoId) => {
      queryClient.setQueryData(['exclusoes_pendentes', user?.id, isSuperAdmin], (old: Record<string, any>[] = []) => 
        old.filter((item) => item.id !== exclusaoId)
      );
      toast({ title: 'Exclusão rejeitada', description: 'A solicitação de exclusão foi rejeitada.' });
    },
    onError: () => toast({ title: 'Erro ao rejeitar exclusão', description: 'Não foi possível processar a rejeição.', variant: 'destructive' }),
  });

  const aprovarMultiplasMutation = useMutation({
    mutationFn: async (exclusaoIds: string[]) => {
      if (!user || !isSuperAdmin || exclusaoIds.length === 0) return false;
      const exclusoes = data.filter((e: any) => exclusaoIds.includes(e.id));
      for (const exclusao of exclusoes) {
        const ex = exclusao as Record<string, any>;
        const { error: deleteError } = await supabase
          .from(ex.tabela as string)
          .update({ deletado: true, deletado_pendente: false })
          .eq('id', ex.registro_id);
        if (deleteError) throw deleteError;
        const { error: updateError } = await supabase
          .from('exclusoes_pendentes')
          .update({ status: 'aprovado', aprovado_por: user.id, aprovado_em: new Date().toISOString() })
          .eq('id', exclusao.id);
        if (updateError) throw updateError;
      }
      return true;
    },
    onSuccess: (_, exclusaoIds) => {
      queryClient.setQueryData(['exclusoes_pendentes', user?.id, isSuperAdmin], (old: Record<string, any>[] = []) => 
        old.filter((item) => !exclusaoIds.includes(item.id))
      );
      toast({ title: 'Exclusões aprovadas', description: `${exclusaoIds.length} solicitação(ões) processada(s) com sucesso.` });
    },
    onError: () => toast({ title: 'Erro ao aprovar exclusões', description: 'Não foi possível processar as aprovações.', variant: 'destructive' }),
  });

  return {
    data,
    loading,
    error,
    refresh: () => queryClient.invalidateQueries({ queryKey: ['exclusoes_pendentes', user?.id, isSuperAdmin] }),
    aprovarExclusao: aprovarMutation.mutateAsync,
    rejeitarExclusao: rejeitarMutation.mutateAsync,
    aprovarMultiplasExclusoes: aprovarMultiplasMutation.mutateAsync,
    isSuperAdmin,
  };
}