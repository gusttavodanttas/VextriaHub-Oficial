import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { ExclusaoPendente } from '@/types/database';

export const useExclusoesPendentes = () => {
  const [data, setData] = useState<ExclusaoPendente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, isSuperAdmin } = useAuth();
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    if (!user || !isSuperAdmin) {
      setData([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data: result, error } = await supabase
        .from('exclusoes_pendentes')
        .select(`
          *,
          user:profiles(full_name, email)
        `)
        .eq('status', 'pendente')
        .order('solicitado_em', { ascending: false });

      if (error) throw error;
      
      setData(result || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      console.error('❌ Hook useExclusoesPendentes failure:', err);
    } finally {
      setLoading(false);
    }
  }, [user, isSuperAdmin, toast]);

  const aprovarExclusao = useCallback(async (exclusaoId: string) => {
    if (!user || !isSuperAdmin) return false;

    try {
      const exclusao = data.find(e => e.id === exclusaoId);
      if (!exclusao) return false;

      // Atualizar o registro original para deletado = true
      const { error: deleteError } = await supabase
        .from(exclusao.tabela as any)
        .update({ 
          deletado: true, 
          deletado_pendente: false 
        })
        .eq('id', exclusao.registro_id);

      if (deleteError) throw deleteError;

      // Atualizar status da exclusão pendente
      const { error: updateError } = await supabase
        .from('exclusoes_pendentes')
        .update({
          status: 'aprovado',
          aprovado_por: user.id,
          aprovado_em: new Date().toISOString(),
        })
        .eq('id', exclusaoId);

      if (updateError) throw updateError;

      // Remover da lista local
      setData(prev => prev.filter(item => item.id !== exclusaoId));

      toast({
        title: 'Exclusão aprovada',
        description: 'O registro foi excluído com sucesso.',
      });

      return true;
    } catch (err) {
      toast({
        title: 'Erro ao aprovar exclusão',
        description: 'Não foi possível processar a aprovação.',
        variant: 'destructive',
      });
      return false;
    }
  }, [data, user, isSuperAdmin, toast]);

  const rejeitarExclusao = useCallback(async (exclusaoId: string) => {
    if (!user || !isSuperAdmin) return false;

    try {
      const exclusao = data.find(e => e.id === exclusaoId);
      if (!exclusao) return false;

      // Reverter o registro original (tirar o deletado_pendente)
      const { error: revertError } = await supabase
        .from(exclusao.tabela as any)
        .update({ deletado_pendente: false })
        .eq('id', exclusao.registro_id);

      if (revertError) throw revertError;

      // Atualizar status da exclusão pendente
      const { error: updateError } = await supabase
        .from('exclusoes_pendentes')
        .update({
          status: 'rejeitado',
          aprovado_por: user.id,
          aprovado_em: new Date().toISOString(),
        })
        .eq('id', exclusaoId);

      if (updateError) throw updateError;

      // Remover da lista local
      setData(prev => prev.filter(item => item.id !== exclusaoId));

      toast({
        title: 'Exclusão rejeitada',
        description: 'A solicitação de exclusão foi rejeitada.',
      });

      return true;
    } catch (err) {
      toast({
        title: 'Erro ao rejeitar exclusão',
        description: 'Não foi possível processar a rejeição.',
        variant: 'destructive',
      });
      return false;
    }
  }, [data, user, isSuperAdmin, toast]);

  const aprovarMultiplasExclusoes = useCallback(async (exclusaoIds: string[]) => {
    if (!user || !isSuperAdmin) return false;

    try {
      const exclusoes = data.filter(e => exclusaoIds.includes(e.id));
      
      // Aprovar todas as exclusões
      for (const exclusao of exclusoes) {
        // Atualizar o registro original
        await supabase
          .from(exclusao.tabela as any)
          .update({ 
            deletado: true, 
            deletado_pendente: false 
          })
          .eq('id', exclusao.registro_id);
      }

      // Atualizar status de todas as exclusões pendentes
      const { error: updateError } = await supabase
        .from('exclusoes_pendentes')
        .update({
          status: 'aprovado',
          aprovado_por: user.id,
          aprovado_em: new Date().toISOString(),
        })
        .in('id', exclusaoIds);

      if (updateError) throw updateError;

      // Remover da lista local
      setData(prev => prev.filter(item => !exclusaoIds.includes(item.id)));

      toast({
        title: 'Exclusões aprovadas',
        description: `${exclusaoIds.length} exclusão(ões) foram aprovadas.`,
      });

      return true;
    } catch (err) {
      toast({
        title: 'Erro ao aprovar exclusões',
        description: 'Não foi possível processar as aprovações.',
        variant: 'destructive',
      });
      return false;
    }
  }, [data, user, isSuperAdmin, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return useMemo(() => ({
    data,
    loading,
    error,
    refresh: fetchData,
    aprovarExclusao,
    rejeitarExclusao,
    aprovarMultiplasExclusoes,
    isEmpty: data.length === 0 && !loading,
    canManage: isSuperAdmin,
  }), [data, loading, error, fetchData, aprovarExclusao, rejeitarExclusao, aprovarMultiplasExclusoes, isSuperAdmin]);
};