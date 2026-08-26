import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/lib/errors';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// process_shares ainda não está no types.ts gerado (a regeneração depende da conta
// contato@ — ver memória prospect-wizard-types-regen). Mesmo padrão do useTimesheetTimer.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export type SharePermission = 'ver' | 'editar';

export interface ProcessShareRow {
  id: string;
  processo_id: string;
  owner_office_id: string;
  shared_office_id: string;
  owner_office_name: string | null;
  shared_office_name: string | null;
  permission: SharePermission;
  created_at: string;
}

export interface SharedInInfo {
  shareId: string;
  ownerOfficeName: string;
  permission: SharePermission;
}

/**
 * Processos que OUTRO escritório compartilhou COM o meu (visão do parceiro).
 * Usado para marcar os cards e abrir o processo em modo leitura/edição no drawer.
 * A RLS de process_shares já restringe ao meu escritório; filtramos por segurança.
 */
export function useProcessShares() {
  const { user } = useAuth();

  const { data: sharedInList = [], isLoading } = useQuery({
    queryKey: ['process-shares-in', user?.office_id],
    queryFn: async (): Promise<ProcessShareRow[]> => {
      if (!user?.office_id) return [];
      const { data, error } = await sb
        .from('process_shares')
        .select('id, processo_id, owner_office_id, shared_office_id, owner_office_name, shared_office_name, permission, created_at')
        .eq('shared_office_id', user.office_id);
      if (error) throw error;
      return (data || []) as ProcessShareRow[];
    },
    enabled: !!user?.office_id,
    staleTime: 30_000,
  });

  const sharedInMap = useMemo(() => {
    const m = new Map<string, SharedInInfo>();
    for (const s of sharedInList) {
      m.set(s.processo_id, {
        shareId: s.id,
        ownerOfficeName: s.owner_office_name || 'Escritório parceiro',
        permission: (s.permission === 'editar' ? 'editar' : 'ver'),
      });
    }
    return m;
  }, [sharedInList]);

  return { sharedInMap, sharedInList, loading: isLoading };
}

/**
 * Gerência dos compartilhamentos de UM processo (visão do dono/admin):
 * lista quem já tem acesso, adiciona por e-mail (via RPC) e revoga.
 */
export function useProcessoShareManager(processoId: string | undefined, enabled = true) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: shares = [], isLoading, refetch } = useQuery({
    queryKey: ['process-shares-of', processoId],
    queryFn: async (): Promise<ProcessShareRow[]> => {
      if (!processoId) return [];
      const { data, error } = await sb
        .from('process_shares')
        .select('id, processo_id, owner_office_id, shared_office_id, owner_office_name, shared_office_name, permission, created_at')
        .eq('processo_id', processoId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as ProcessShareRow[];
    },
    enabled: enabled && !!processoId,
    staleTime: 15_000,
  });

  const shareMutation = useMutation({
    mutationFn: async ({ email, permission }: { email: string; permission: SharePermission }) => {
      if (!processoId) throw new Error('Processo inválido');
      const { data, error } = await sb.rpc('share_processo_with_office', {
        p_processo_id: processoId,
        p_email: email.trim(),
        p_permission: permission,
      });
      if (error) throw error;
      return data as { ok: boolean; office_name: string; permission: SharePermission };
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['process-shares-of', processoId] });
      queryClient.invalidateQueries({ queryKey: ['process-shares-in'] });
      toast({
        title: 'Processo compartilhado',
        description: `${res?.office_name || 'Escritório parceiro'} agora ${res?.permission === 'editar' ? 'pode ver e editar' : 'pode ver'} este processo.`,
      });
    },
    onError: (err: unknown) => {
      toast({ title: 'Não foi possível compartilhar', description: getErrorMessage(err), variant: 'destructive' });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (shareId: string) => {
      const { error } = await sb.from('process_shares').delete().eq('id', shareId);
      if (error) throw error;
      return shareId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['process-shares-of', processoId] });
      queryClient.invalidateQueries({ queryKey: ['process-shares-in'] });
      toast({ title: 'Compartilhamento removido', description: 'O escritório parceiro perdeu o acesso a este processo.' });
    },
    onError: (err: unknown) => {
      toast({ title: 'Erro ao remover', description: getErrorMessage(err), variant: 'destructive' });
    },
  });

  return {
    shares,
    loading: isLoading,
    refetch,
    shareByEmail: (email: string, permission: SharePermission) => shareMutation.mutateAsync({ email, permission }),
    revokeShare: revokeMutation.mutateAsync,
    sharing: shareMutation.isPending,
    revoking: revokeMutation.isPending,
  };
}
