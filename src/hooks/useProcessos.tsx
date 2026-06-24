import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Processo, NovoProcesso } from '@/types/database';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useProcessos() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Helper: Map database row -> frontend Processo
  const mapDatabaseToProcesso = (dbRecord: any): Processo => {
    // Extrair ano do CNJ como fallback para data_inicio se estiver nulo
    let inferredYear = '';
    if (!dbRecord.data_inicio && dbRecord.numero_processo?.length === 20) {
      inferredYear = dbRecord.numero_processo.substring(9, 13);
    }

    return {
      id: dbRecord.id,
      titulo: dbRecord.titulo,
      cliente: dbRecord.cliente?.nome || 'Cliente não vinculado',
      clienteId: dbRecord.cliente_id,
      status: dbRecord.status === 'ativo' ? 'Em andamento' : dbRecord.status,
      dataInicio: dbRecord.data_distribuicao || dbRecord.data_inicio || (inferredYear ? `${inferredYear}-01-01` : dbRecord.created_at?.split('T')[0]),
      proximoPrazo: dbRecord.proximo_prazo,
      descricao: dbRecord.observacoes,
      valorCausa: dbRecord.valor_causa ? Number(dbRecord.valor_causa) : undefined,
      numeroProcesso: dbRecord.numero_processo,
      tipoProcesso: dbRecord.tipo_processo,
      faseProcessual: dbRecord.tipo_processo,
      responsavelId: dbRecord.user_id,
      responsavelNome: undefined,
      ultimaMovimentacao: dbRecord.data_ultima_atualizacao || dbRecord.updated_at?.split('T')[0],
      tribunal: dbRecord.tribunal,
      vara: dbRecord.vara,
      comarca: dbRecord.comarca,
      requerido: dbRecord.requerido,
      segredoJustica: dbRecord.segredo_justica || false,
      justicaGratuita: dbRecord.justica_gratuita || false,
      observacoes: dbRecord.observacoes
    };
  };

  const { data = [], isLoading: loading, error, refetch: refresh } = useQuery({
    queryKey: ['processos', user?.id, user?.office_id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const officeId = user.office_id;
      const userId = user.id;
      
      console.log('📋 useProcessos: iniciando query (2026-04-24-11-40)', { officeId, userId });

      try {
        let query = supabase
          .from('processos')
          .select('*, cliente:clientes(nome)')
          .eq('deletado', false)
          .order('created_at', { ascending: false });

        if (officeId) {
          query = query.eq('office_id', officeId);
        } else {
          query = query.eq('user_id', userId);
        }

        const { data: result, error: fetchError } = await query;

        if (fetchError) {
          console.error('❌ useProcessos: erro na query', fetchError);
          throw fetchError;
        }

        console.log(`📋 useProcessos: ${result?.length ?? 0} processos encontrados`);
        return (result || []).map(mapDatabaseToProcesso);
      } catch (e) {
        console.error('❌ useProcessos: exceção capturada', e);
        throw e;
      }
    },
    enabled: !!user?.id,
    staleTime: 0,
    gcTime: 60000,
    retry: 1,
  });

  const createMutation = useMutation({
    mutationFn: async (newRecord: NovoProcesso) => {
      if (!user) throw new Error('Not authenticated');

      const insertPayload: Record<string, any> = {
        user_id: user.id,
        office_id: user.office_id,
        titulo: newRecord.titulo,
        numero_processo: ( (newRecord as any).numeroProcesso || (newRecord as any).numero_processo || '').replace(/\D/g, ''),
        status: ( (newRecord as any).status === 'Em andamento' || (newRecord as any).status === 'ativo') ? 'ativo' : (newRecord as any).status,
        tipo_processo: (newRecord as any).tipoProcesso || (newRecord as any).tipo_processo,
        tribunal: (newRecord as any).tribunal,
        vara: (newRecord as any).vara,
        comarca: (newRecord as any).comarca,
        valor_causa: (newRecord as any).valorCausa || (newRecord as any).valor_causa,
        proximo_prazo: (newRecord as any).proximoPrazo || (newRecord as any).proximo_prazo,
        observacoes: (newRecord as any).descricao || (newRecord as any).observacoes || '',
        requerido: (newRecord as any).requerido || '',
        segredo_justica: (newRecord as any).segredoJustica || (newRecord as any).segredo_justica || false,
        justica_gratuita: (newRecord as any).justicaGratuita || (newRecord as any).justica_gratuita || false,
        data_inicio: (newRecord as any).dataInicio || (newRecord as any).data_inicio,
        data_distribuicao: (newRecord as any).dataInicio || (newRecord as any).data_inicio,
      };

      if ((newRecord as any).clienteId || (newRecord as any).cliente_id) {
        insertPayload.cliente_id = (newRecord as any).clienteId || (newRecord as any).cliente_id;
      }

      // Upsert logic based on (office_id, numero_processo)
      // This requires the unique constraint we added in migration
      const { data: result, error } = await supabase
        .from('processos')
        .upsert(insertPayload, { 
          onConflict: 'office_id, numero_processo',
          ignoreDuplicates: false // We WANT to update existing ones with new sync data
        })
        .select('*, cliente:clientes(nome)')
        .single();

      if (error) throw error;
      return mapDatabaseToProcesso(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['processos'] });
    },
    onError: (err: any) => {
      console.error('Erro ao criar/sincronizar processo:', err);
      toast({
        title: 'Erro na sincronização',
        description: err.message || 'Não foi possível salvar os dados.',
        variant: 'destructive',
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string, updates: Partial<Processo> }) => {
      if (!user) throw new Error('Not authenticated');

      const updatePayload: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (updates.titulo !== undefined) updatePayload.titulo = updates.titulo;
      if (updates.clienteId !== undefined) updatePayload.cliente_id = updates.clienteId;
      if (updates.status !== undefined) updatePayload.status = updates.status === 'Em andamento' ? 'ativo' : updates.status;
      if (updates.numeroProcesso !== undefined) updatePayload.numero_processo = (updates.numeroProcesso || '').replace(/\D/g, '');
      if (updates.tipoProcesso !== undefined) updatePayload.tipo_processo = updates.tipoProcesso;
      if (updates.tribunal !== undefined) updatePayload.tribunal = updates.tribunal;
      if (updates.vara !== undefined) updatePayload.vara = updates.vara;
      if (updates.comarca !== undefined) updatePayload.comarca = updates.comarca;
      if (updates.valorCausa !== undefined) updatePayload.valor_causa = updates.valorCausa;
      if (updates.proximoPrazo !== undefined) updatePayload.proximo_prazo = updates.proximoPrazo;
      if (updates.requerido !== undefined) updatePayload.requerido = updates.requerido;
      if (updates.segredoJustica !== undefined) updatePayload.segredo_justica = updates.segredoJustica;
      if (updates.justicaGratuita !== undefined) updatePayload.justica_gratuita = updates.justicaGratuita;
      
      if (updates.descricao !== undefined || (updates as any).observacoes !== undefined) {
        updatePayload.observacoes = updates.descricao || (updates as any).observacoes;
      }

      const { data: result, error } = await supabase
        .from('processos')
        .update(updatePayload)
        .eq('id', id)
        .select('*, cliente:clientes(nome)')
        .single();

      if (error) throw error;
      return mapDatabaseToProcesso(result);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['processos'] });
      toast({ title: 'Processo atualizado', description: 'Dados salvos com sucesso.' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('processos')
        .update({ deletado: true, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['processos'] });
      toast({ title: 'Processo removido', description: 'O registro foi marcado como excluído.' });
    }
  });

  const addMovimentacao = async (processoId: string, movData: any) => {
    if (!user) return null;
    try {
      const data = movData.data || new Date().toISOString();
      const texto: string = movData.descricao || movData.texto || '';
      if (!texto) return null;
      let dataNorm = data;
      try { dataNorm = new Date(data).toISOString().slice(0, 19); } catch (_e) { /* keep raw */ }
      const textoNorm = texto.replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 240);
      const hash = `${processoId}|${dataNorm}|${textoNorm}`;

      const { data: result, error: movError } = await supabase
        .from('movimentacoes')
        .upsert([{
          processo_id: processoId,
          office_id: user.office_id,
          data,
          texto,
          hash,
          fonte: movData.fonte || 'manual',
          tipo: movData.tipo || null,
          metadata: { fase: movData.fase || movData.tipo || null },
        }], { onConflict: 'hash', ignoreDuplicates: false })
        .select('*')
        .single();

      if (movError) throw movError;
      return result;
    } catch (err) {
      console.error('Erro ao adicionar movimentação:', err);
      return null;
    }
  };

  return {
    data,
    loading,
    error: error ? (error as any).message : null,
    refresh,
    create: createMutation.mutateAsync,
    update: (id: string, updates: Partial<any>) => updateMutation.mutateAsync({ id, updates }),
    requestDelete: deleteMutation.mutateAsync,
    addMovimentacao,
    isEmpty: data.length === 0 && !loading,
  };
}