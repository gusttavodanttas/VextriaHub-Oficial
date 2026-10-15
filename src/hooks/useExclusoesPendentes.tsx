import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useUserRole } from '@/hooks/useUserRole';
import { assertRowsAffected, getErrorMessage } from '@/lib/errors';
import { ExclusaoPendente } from '@/types/database';
import { captureError } from '@/lib/monitoring';

export const useExclusoesPendentes = () => {
  const [data, setData] = useState<ExclusaoPendente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  // Admin do escritório também gerencia as exclusões do PRÓPRIO escritório (a RLS
  // excl_*_office_admin garante o escopo por office_id); super_admin vê tudo. (v11)
  // Delegado para useUserRole().canManageOffice (mesma fonte usada pelo resto do
  // app) em vez de recalcular isSuperAdmin/isOfficeAdmin aqui, para não divergir.
  const { canManageOffice: canManage } = useUserRole();

  const fetchData = useCallback(async () => {
    if (!user || !canManage) {
      setData([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data: rows, error } = await supabase
        .from('exclusoes_pendentes')
        .select('*')
        .eq('status', 'pendente')
        .order('solicitado_em', { ascending: false });

      if (error) throw error;

      // `exclusoes_pendentes.user_id` NÃO tem FK para `profiles` (só office_id→offices),
      // então o embed `user:profiles(...)` derrubava a query inteira (PostgREST PGRST200)
      // e o painel nunca carregava. Buscamos nome/e-mail do solicitante num 2º passo
      // e juntamos na mão (super-admin tem policy de SELECT em ambas as tabelas).
      const rowsList = rows ?? [];
      const userIds = Array.from(
        new Set(rowsList.map((r) => r.user_id).filter(Boolean))
      ) as string[];
      const profMap: Record<string, { full_name: string | null; email: string | null }> = {};
      if (userIds.length > 0) {
        const { data: profs, error: profsError } = await supabase
          .from('profiles')
          .select('user_id, full_name, email')
          .in('user_id', userIds);
        // Nome do solicitante é secundário: lista segue, sem nome, e o erro vai pro Sentry.
        if (profsError) captureError(profsError, { context: 'useExclusoesPendentes: perfis dos solicitantes' });
        for (const p of profs ?? []) {
          profMap[p.user_id] = { full_name: p.full_name, email: p.email };
        }
      }
      const enriched = rowsList.map((r) => ({ ...r, user: profMap[r.user_id] ?? null }));

      setData(enriched);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err, 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  }, [user, canManage, toast]);

  const aprovarExclusao = useCallback(async (exclusaoId: string) => {
    if (!user || !canManage) return false;

    try {
      const exclusao = data.find(e => e.id === exclusaoId);
      if (!exclusao) return false;

      // Atualizar o registro original para deletado = true. Postgres/PostgREST NÃO
      // lança erro quando a RLS bloqueia o UPDATE — só casa 0 linhas e devolve
      // sucesso, então sem conferir a contagem via .select() a exclusão aparecia
      // como "aprovada" mesmo com o registro intocado no banco.
      const { data: updated, error: deleteError } = await supabase
        .from(exclusao.tabela as any)
        .update({
          deletado: true,
          deletado_pendente: false
        })
        .eq('id', exclusao.registro_id)
        .select('id');

      assertRowsAffected(updated, deleteError, 1);

      // Atualizar status da exclusão pendente
      // Também conferido: sem isto, a solicitação continuava "pendente" no banco
      // (voltava no F5) com o registro já excluído — o admin aprovava de novo.
      const { data: statusRows, error: updateError } = await supabase
        .from('exclusoes_pendentes')
        .update({
          status: 'aprovado',
          aprovado_por: user.id,
          aprovado_em: new Date().toISOString(),
        })
        .eq('id', exclusaoId)
        .select('id');

      assertRowsAffected(statusRows, updateError, 1);

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
        description: getErrorMessage(err, 'Não foi possível processar a aprovação.'),
        variant: 'destructive',
      });
      return false;
    }
  }, [data, user, canManage, toast]);

  const rejeitarExclusao = useCallback(async (exclusaoId: string) => {
    if (!user || !canManage) return false;

    try {
      const exclusao = data.find(e => e.id === exclusaoId);
      if (!exclusao) return false;

      // Reverter o registro original (tirar o deletado_pendente) — mesma checagem
      // de contagem que aprovarExclusao, pelo mesmo motivo (RLS bloqueia em silêncio).
      const { data: updated, error: revertError } = await supabase
        .from(exclusao.tabela as any)
        .update({ deletado_pendente: false })
        .eq('id', exclusao.registro_id)
        .select('id');

      assertRowsAffected(updated, revertError, 1);

      // Atualizar status da exclusão pendente
      const { data: statusRows, error: updateError } = await supabase
        .from('exclusoes_pendentes')
        .update({
          status: 'rejeitado',
          aprovado_por: user.id,
          aprovado_em: new Date().toISOString(),
        })
        .eq('id', exclusaoId)
        .select('id');

      assertRowsAffected(statusRows, updateError, 1);

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
        description: getErrorMessage(err, 'Não foi possível processar a rejeição.'),
        variant: 'destructive',
      });
      return false;
    }
  }, [data, user, canManage, toast]);

  const aprovarMultiplasExclusoes = useCallback(async (exclusaoIds: string[]) => {
    if (!user || !canManage) return false;

    try {
      const exclusoes = data.filter(e => exclusaoIds.includes(e.id));

      // Aprovar cada exclusão, mas só marca como 'aprovado' quem o delete
      // realmente confirmou -- senão o log de auditoria mente sobre um
      // registro que continua existindo no banco. O `.select('id')` é o que
      // torna essa checagem real: sem ele, um update bloqueado pela RLS
      // devolve 0 linhas sem erro nenhum e contava como sucesso.
      const succeededIds: string[] = [];
      const failedIds: string[] = [];
      for (const exclusao of exclusoes) {
        const { data: updated, error: deleteError } = await supabase
          .from(exclusao.tabela as any)
          .update({
            deletado: true,
            deletado_pendente: false
          })
          .eq('id', exclusao.registro_id)
          .select('id');

        if (deleteError || !updated?.length) {
          failedIds.push(exclusao.id);
        } else {
          succeededIds.push(exclusao.id);
        }
      }

      if (succeededIds.length > 0) {
        const { data: statusRows, error: updateError } = await supabase
          .from('exclusoes_pendentes')
          .update({
            status: 'aprovado',
            aprovado_por: user.id,
            aprovado_em: new Date().toISOString(),
          })
          .in('id', succeededIds)
          .select('id');

        assertRowsAffected(statusRows, updateError, succeededIds.length);

        // Remover da lista local só quem foi de fato aprovado
        setData(prev => prev.filter(item => !succeededIds.includes(item.id)));
      }

      if (failedIds.length > 0) {
        toast({
          title: succeededIds.length > 0 ? 'Algumas exclusões falharam' : 'Erro ao aprovar exclusões',
          description: `${failedIds.length} de ${exclusaoIds.length} não puderam ser excluídas. Tente novamente.`,
          variant: 'destructive',
        });
        return false;
      }

      toast({
        title: 'Exclusões aprovadas',
        description: `${succeededIds.length} exclusão(ões) foram aprovadas.`,
      });

      return true;
    } catch (err) {
      toast({
        title: 'Erro ao aprovar exclusões',
        description: getErrorMessage(err, 'Não foi possível processar as aprovações.'),
        variant: 'destructive',
      });
      return false;
    }
  }, [data, user, canManage, toast]);

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
    canManage,
  }), [data, loading, error, fetchData, aprovarExclusao, rejeitarExclusao, aprovarMultiplasExclusoes, canManage]);
};