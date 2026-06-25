import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { Cliente, NovoCliente, DatabaseHookResult, ClienteComProcessos } from '@/types/database';

export function useClientes(): DatabaseHookResult<ClienteComProcessos, NovoCliente> {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const officeId = user?.office_id;

  const { data = [], isLoading: loading, error: queryError } = useQuery({
    queryKey: ['clientes', officeId],
    queryFn: async () => {
      if (!officeId) return [];
      const { data: result, error } = await supabase
        .from('clientes')
        .select('*, processos!processos_cliente_id_fkey(count)')
        .eq('office_id', officeId)
        .eq('deletado', false)
        .eq('deletado_pendente', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return result || [];
    },
    enabled: !!officeId,
  });

  const error = queryError ? (queryError instanceof Error ? queryError.message : 'Erro desconhecido') : null;

  const createMutation = useMutation({
    mutationFn: async (newRecord: NovoCliente): Promise<Cliente | null> => {
      if (!user?.office_id) return null;

      const payload = {
        ...newRecord,
        user_id: user.id,
        office_id: user.office_id,
      } as any;  // TODO Fase 2: improve typing for insert
      
      if (payload.data_aniversario === '') payload.data_aniversario = null;
      if (payload.endereco === '') payload.endereco = null;
      if (payload.origem === '') payload.origem = null;
      
      const { data: result, error } = await supabase
        .from('clientes')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (result) => {
      if (result) {
        queryClient.setQueryData(['clientes', officeId], (old: ClienteComProcessos[] = []) => [result, ...old]);
        toast({ title: 'Cliente criado', description: 'O cliente foi criado com sucesso.' });
      }
    },
    onError: (err: any) => {
      console.error('Erro ao criar cliente:', err);
      toast({ title: 'Erro ao criar cliente', description: 'Não foi possível criar o cliente.', variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Cliente> }): Promise<Cliente | null> => {
      if (!user?.office_id) return null;

      const payload = { ...updates } as any;  // TODO Fase 2: improve typing
      if (payload.data_aniversario === '') payload.data_aniversario = null;
      
      const { data: result, error } = await supabase
        .from('clientes')
        .update(payload)
        .eq('id', id)
        .eq('office_id', user.office_id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (result) => {
      if (result) {
        queryClient.setQueryData(['clientes', officeId], (old: ClienteComProcessos[] = []) => 
          old.map((item: ClienteComProcessos) => item.id === result.id ? result : item)
        );
        toast({ title: 'Cliente atualizado', description: 'O cliente foi atualizado com sucesso.' });
      }
    },
    onError: (err: any) => {
      console.error('Erro ao atualizar cliente:', err);
      toast({ title: 'Erro ao atualizar cliente', description: 'Não foi possível atualizar o cliente.', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo?: string }): Promise<boolean> => {
      if (!user?.office_id) return false;

      const { error } = await supabase
        .from('clientes')
        .update({ deletado: true })
        .eq('id', id)
        .eq('office_id', user.office_id);

      if (error) throw error;
      return true;
    },
    onSuccess: (_, { id }) => {
      queryClient.setQueryData(['clientes', officeId], (old: ClienteComProcessos[] = []) => old.filter((item: ClienteComProcessos) => item.id !== id));
      toast({ title: 'Cliente excluído', description: 'O cliente foi excluído com sucesso.' });
    },
    onError: (err: any) => {
      console.error('Erro ao excluir cliente:', err);
      toast({ title: 'Erro ao excluir cliente', description: 'Não foi possível excluir o cliente.', variant: 'destructive' });
    },
  });

  const multipleDeleteMutation = useMutation({
    mutationFn: async ({ ids, motivo }: { ids: string[]; motivo?: string }): Promise<boolean> => {
      if (!user?.office_id || ids.length === 0) return false;

      const { error } = await supabase
        .from('clientes')
        .update({ deletado: true })
        .in('id', ids)
        .eq('office_id', user.office_id);

      if (error) throw error;
      return true;
    },
    onSuccess: (_, { ids }) => {
      queryClient.setQueryData(['clientes', officeId], (old: ClienteComProcessos[] = []) => old.filter((item: ClienteComProcessos) => !ids.includes(item.id)));
      toast({ title: 'Clientes excluídos', description: `${ids.length} cliente(s) foram excluídos com sucesso.` });
    },
    onError: (err: any) => {
      console.error('Erro ao excluir clientes:', err);
      toast({ title: 'Erro ao excluir clientes', description: 'Não foi possível excluir os clientes.', variant: 'destructive' });
    },
  });

  return {
    data,
    loading,
    error,
    refresh: () => queryClient.invalidateQueries({ queryKey: ['clientes', officeId] }),
    create: createMutation.mutateAsync,
    update: (id: string, updates: Partial<Cliente>) => updateMutation.mutateAsync({ id, updates }),
    requestDelete: (id: string, motivo?: string) => deleteMutation.mutateAsync({ id, motivo }),
    requestMultipleDelete: (ids: string[], motivo?: string) => multipleDeleteMutation.mutateAsync({ ids, motivo }),
    isEmpty: data.length === 0 && !loading,
  };
}