import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { planQuotaMessage } from '@/lib/planQuotaError';
import { assertRowsAffected, getErrorMessage } from '@/lib/errors';
import { useQueryClient } from '@tanstack/react-query';
import { Cliente, NovoCliente, DatabaseHookResult, ClienteComProcessos } from '@/types/database';
import type { TablesInsert, TablesUpdate } from '@/integrations/supabase/rows';
import type { Json } from '@/integrations/supabase/types';

export function useClientes(): DatabaseHookResult<ClienteComProcessos, NovoCliente> {
  const [data, setData] = useState<ClienteComProcessos[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, isAdmin, isOfficeAdmin, isSuperAdmin } = useAuth();
  const permissions = usePermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  // A página de Clientes lê a lista paginada e as contagens via TanStack Query
  // (chaves ["clientes", ...]); este hook é useState — sem invalidar, a tela seguia
  // mostrando o cliente excluído/antigo e os cards com o número velho.
  const invalidarListas = () => queryClient.invalidateQueries({ queryKey: ['clientes'] });

  // Snapshot dos registros para a solicitação de exclusão. Busca no banco o que não
  // estiver na lista em memória (limitada a 1000): antes, cliente fora dela ficava
  // com deletado_pendente=true SEM solicitação — sumia sem o admin ter o que aprovar.
  const snapshotsParaExclusao = async (ids: string[], officeId: string) => {
    const emMemoria = data.filter(item => ids.includes(item.id));
    const faltando = ids.filter(id => !emMemoria.some(r => r.id === id));
    if (!faltando.length) return emMemoria;
    const { data: extra, error } = await supabase.from('clientes').select('*').in('id', faltando).eq('office_id', officeId);
    if (error) throw error;
    return [...emMemoria, ...((extra || []) as unknown as ClienteComProcessos[])];
  };

  // Pedido de exclusão que não conseguiu registrar a solicitação: desfaz o
  // deletado_pendente para o cliente não sumir sem nada para o admin aprovar.
  const reverterPendente = async (ids: string[], officeId: string) => {
    const { error } = await supabase.from('clientes').update({ deletado_pendente: false }).in('id', ids).eq('office_id', officeId);
    if (error) throw new Error(`A solicitação não foi registrada e os clientes ficaram ocultos — peça ao administrador para restaurá-los na Lixeira. (${getErrorMessage(error)})`);
  };

  const fetchData = async () => {
    if (!user || !user.office_id) {
      setData([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data: result, error } = await supabase
        .from('clientes')
        .select('*, processos!processos_cliente_id_fkey(count)')
        .eq('office_id', user.office_id)
        .eq('deletado', false)
        .eq('deletado_pendente', false)
        // NÃO filtrar 'lead' aqui: este hook é COMPARTILHADO com o CRM (Crm.tsx),
        // que PRECISA dos leads pro funil. Filtrar aqui zerava o funil (regressão v11).
        // A exclusão de lead é só na PÁGINA de Clientes (Clientes.tsx). (v12)
        // Cap de segurança: sem paginação real ainda, mas sem isto um escritório
        // com base grande carregaria a tabela inteira pro navegador de uma vez.
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) throw error;
      
      setData(result || []);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err, 'Erro desconhecido'));
      toast({
        title: 'Erro ao carregar clientes',
        description: getErrorMessage(err, 'Não foi possível carregar a lista de clientes.'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const create = async (newRecord: NovoCliente): Promise<Cliente | null> => {
    if (!user?.office_id) return null;
    const officeId = user.office_id;

    try {
      const payload: TablesInsert<'clientes'> = {
        ...newRecord,
        user_id: user.id,
        office_id: officeId,
      };

      // PostgreSQL rejeita string vazia em colunas de Data (gera erro 400)
      if (payload.data_aniversario === '') payload.data_aniversario = null;
      if (payload.endereco === '') payload.endereco = null;
      if (payload.origem === '') payload.origem = null;
      
      const { data: result, error } = await supabase
        .from('clientes')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;

      setData(prev => [result, ...prev]);
      invalidarListas();
      toast({
        title: 'Cliente criado',
        description: 'O cliente foi criado com sucesso.',
      });
      
      return result;
    } catch (err) {
      const quota = planQuotaMessage(err);
      toast({
        title: quota?.title ?? 'Erro ao criar cliente',
        description: quota?.description ?? getErrorMessage(err, 'Não foi possível criar o cliente.'),
        variant: 'destructive',
      });
      return null;
    }
  };

  const update = async (id: string, updates: Partial<Cliente>): Promise<Cliente | null> => {
    if (!user?.office_id) return null;
    const officeId = user.office_id;

    try {
      const payload: TablesUpdate<'clientes'> = { ...updates };
      if (payload.data_aniversario === '') payload.data_aniversario = null;

      const { data: result, error } = await supabase
        .from('clientes')
        .update(payload)
        .eq('id', id)
        .eq('office_id', officeId)
        .select();

      // Sem .single(): 0 linhas (RLS) vira a mensagem de permissão do helper, em vez
      // do PGRST116 genérico.
      assertRowsAffected(result, error, 1);
      const row = result![0];

      setData(prev => prev.map(item => 
        item.id === id ? { ...item, ...row } : item
      ));
      invalidarListas();

      toast({
        title: 'Cliente atualizado',
        description: 'O cliente foi atualizado com sucesso.',
      });
      
      return row;
    } catch (err) {
      toast({
        title: 'Erro ao atualizar cliente',
        description: getErrorMessage(err, 'Não foi possível atualizar o cliente.'),
        variant: 'destructive',
      });
      return null;
    }
  };

  const requestDelete = async (id: string, motivo?: string): Promise<boolean> => {
    // canDeleteClients cobre tanto a exclusão direta (admin) quanto a solicitação
    // pendente (usuário comum) — sem essa checagem, qualquer usuário sempre
    // conseguia pelo menos abrir uma solicitação de exclusão, mesmo com a
    // permissão desligada.
    if (!user?.office_id || !permissions.canDeleteClients) return false;
    const officeId = user.office_id;

    try {
      const [recordToDelete] = await snapshotsParaExclusao([id], officeId);
      if (!recordToDelete) throw new Error('Cliente não encontrado.');

      const hasAdminRights = isAdmin || isOfficeAdmin || isSuperAdmin;

      if (hasAdminRights) {
        // Direct Deletion
        const { data: updated, error: updateError } = await supabase
          .from('clientes')
          .update({ deletado: true })
          .eq('id', id)
          .eq('office_id', officeId)
          .select('id');

        assertRowsAffected(updated, updateError, 1);

        setData(prev => prev.filter(item => item.id !== id));

        toast({
          title: 'Cliente excluído',
          description: 'O cliente foi excluído com sucesso.',
        });
      } else {
        // Pending Deletion
        const { data: updated, error: updateError } = await supabase
          .from('clientes')
          .update({ deletado_pendente: true })
          .eq('id', id)
          .eq('office_id', officeId)
          .select('id');

        assertRowsAffected(updated, updateError, 1);

        const { error: exclusionError } = await supabase
          .from('exclusoes_pendentes')
          .insert([
            {
              user_id: user.id,
              tabela: 'clientes',
              registro_id: id,
              dados_registro: recordToDelete as unknown as Json,
              motivo: motivo,
            }
          ]);

        if (exclusionError) {
          await reverterPendente([id], officeId);
          throw exclusionError;
        }

        setData(prev => prev.filter(item => item.id !== id));

        toast({
          title: 'Solicitação de exclusão enviada',
          description: 'Sua solicitação foi enviada para aprovação do administrador.',
        });
      }
      invalidarListas();
      return true;
    } catch (err) {
      toast({
        title: 'Erro ao solicitar exclusão',
        description: getErrorMessage(err, 'Não foi possível processar a solicitação de exclusão.'),
        variant: 'destructive',
      });
      return false;
    }
  };

  const requestMultipleDelete = async (ids: string[], motivo?: string): Promise<boolean> => {
    if (!user?.office_id || !permissions.canDeleteClients) return false;
    const officeId = user.office_id;

    try {
      const hasAdminRights = isAdmin || isOfficeAdmin || isSuperAdmin;

      if (hasAdminRights) {
        // Direct Deletion (Software Delete)
        const { data: updated, error: updateError } = await supabase
          .from('clientes')
          .update({ deletado: true })
          .in('id', ids)
          .eq('office_id', officeId)
          .select('id');

        assertRowsAffected(updated, updateError, ids.length);

        setData(prev => prev.filter(item => !ids.includes(item.id)));

        toast({
          title: 'Clientes excluídos',
          description: `${ids.length} cliente(s) foram excluídos com sucesso.`,
        });
      } else {
        // Pending Deletion for non-admins
        const recordsToDelete = await snapshotsParaExclusao(ids, officeId);
        const { data: updated, error: updateError } = await supabase
          .from('clientes')
          .update({ deletado_pendente: true })
          .in('id', ids)
          .eq('office_id', officeId)
          .select('id');

        assertRowsAffected(updated, updateError, ids.length);

        const exclusionRecords = recordsToDelete.map(record => ({
          user_id: user.id,
          tabela: 'clientes',
          registro_id: record.id,
          dados_registro: record as unknown as Json,
          motivo: motivo,
        }));

        const { error: exclusionError } = await supabase
          .from('exclusoes_pendentes')
          .insert(exclusionRecords);

        if (exclusionError) {
          await reverterPendente(ids, officeId);
          throw exclusionError;
        }

        setData(prev => prev.filter(item => !ids.includes(item.id)));

        toast({
          title: 'Solicitações de exclusão enviadas',
          description: `${ids.length} solicitação(ões) enviadas para aprovação do administrador.`,
        });
      }
      invalidarListas();
      return true;
    } catch (err) {
      toast({
        title: 'Erro ao solicitar exclusões',
        description: getErrorMessage(err, 'Não foi possível processar as solicitações de exclusão.'),
        variant: 'destructive',
      });
      return false;
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  return {
    data,
    loading,
    error,
    refresh: fetchData,
    create,
    update,
    requestDelete,
    requestMultipleDelete,
    isEmpty: data.length === 0 && !loading,
  };
}