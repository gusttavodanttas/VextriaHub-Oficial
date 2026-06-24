import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Processo, NovoProcesso } from '@/types/database';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useProcessosV2() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Helper: Map database row -> frontend Processo
  const mapDatabaseToProcesso = (dbRecord: any): Processo => {
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
      faseProcessual: (dbRecord.fase_processual && dbRecord.fase_processual !== 'Inicial') ? dbRecord.fase_processual : undefined,
      classeJudicial: dbRecord.classe_judicial || undefined,
      assuntoPrincipal: dbRecord.assunto_principal || undefined,
      instancia: dbRecord.instancia || undefined,
      responsavelId: dbRecord.user_id,
      responsavelNome: undefined,
      ultimaMovimentacao: dbRecord.data_ultima_atualizacao || dbRecord.updated_at?.split('T')[0],
      tribunal: dbRecord.tribunal,
      vara: dbRecord.vara,
      comarca: dbRecord.comarca,
      parteAutora: dbRecord.parte_autora || undefined,
      requerido: dbRecord.requerido,
      segredoJustica: dbRecord.segredo_justica || false,
      justicaGratuita: dbRecord.justica_gratuita || false,
      observacoes: dbRecord.observacoes,
      fonteSincronizacao: dbRecord.fonte_sincronizacao || undefined,
      sincronizadoEm: dbRecord.sincronizado_em || undefined,
    };
  };

  const { data = [], isLoading: loading, error, refetch: refresh } = useQuery({
    queryKey: ['processos', user?.id, user?.office_id],
    queryFn: async () => {
      if (!user?.id) return [];

      const officeId = user.office_id;
      const userId = user.id;

      console.log('📋 useProcessos: iniciando query', { officeId, userId });

      try {
        // Sem filtro manual de office_id ou user_id: confiamos na RLS para
        // retornar tudo que o usuário pode ver (processos do(s) office(s) que
        // ele é membro ativo + processos que ele criou). Isso evita ficar
        // com lista vazia quando user.office_id no AuthContext está dessincronizado
        // com o office_id real dos processos.
        const { data: result, error: fetchError } = await supabase
          .from('processos')
          .select('*, cliente:clientes!cliente_id(nome)')
          .eq('deletado', false)
          .order('created_at', { ascending: false });

        if (fetchError) {
          console.error('❌ useProcessos: erro na query', {
            message: fetchError.message,
            code: fetchError.code,
            details: fetchError.details,
            hint: fetchError.hint,
          });
          throw fetchError;
        }

        console.log(`📋 useProcessos: ${result?.length ?? 0} processos retornados pela RLS`);
        return (result || []).map(mapDatabaseToProcesso);
      } catch (e: any) {
        console.error('❌ useProcessos: exceção capturada', {
          error: e,
          message: e?.message,
          stack: e?.stack,
        });
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

      const r = newRecord as any;
      const ultimoAndamento = r.ultimoAndamento || null;
      const andamentos: any[] = Array.isArray(r.andamentos) ? r.andamentos : [];

      const dataUltimaAtualizacao =
        ultimoAndamento?.data
          ? String(ultimoAndamento.data).split('T')[0]
          : (andamentos[0]?.data ? String(andamentos[0].data).split('T')[0] : null);

      const dataAjuizamentoRaw = r.dataAjuizamento || r.dataInicio || r.data_inicio;
      const dataAjuizamento = dataAjuizamentoRaw ? String(dataAjuizamentoRaw).split('T')[0] : null;

      const fonteSincronizacao = andamentos.length > 0 || ultimoAndamento ? 'datajud' : (r.fonteSincronizacao || 'manual');

      const insertPayload: Record<string, any> = {
        user_id: user.id,
        office_id: user.office_id,
        titulo: r.titulo,
        numero_processo: (r.numeroProcesso || r.numero_processo || '').replace(/\D/g, ''),
        status: (r.status === 'Em andamento' || r.status === 'ativo') ? 'ativo' : r.status,
        tipo_processo: r.tipoProcesso || r.tipo_processo || r.classe || null,
        classe_judicial: r.classe || r.classeJudicial || null,
        assunto_principal: r.assunto || r.assuntoPrincipal || null,
        fase_processual: r.faseProcessual || r.fase_processual || null,
        instancia: r.instancia || null,
        tribunal: r.tribunal,
        vara: r.vara,
        comarca: r.comarca,
        orgao_julgador_codigo: r.orgaoJulgadorCodigo || r.orgao_julgador_codigo || null,
        nivel_sigilo: r.nivelSigilo ?? r.nivel_sigilo ?? 0,
        valor_causa: r.valorCausa || r.valor_causa,
        proximo_prazo: r.proximoPrazo || r.proximo_prazo,
        observacoes: r.descricao || r.observacoes || '',
        parte_autora: r.autor || r.parteAutora || null,
        requerido: r.reu || r.requerido || '',
        segredo_justica: r.segredoJustica || r.segredo_justica || false,
        justica_gratuita: r.justicaGratuita || r.justica_gratuita || false,
        data_inicio: dataAjuizamento,
        data_distribuicao: dataAjuizamento,
        data_ultima_atualizacao: dataUltimaAtualizacao,
        fonte_sincronizacao: fonteSincronizacao,
        sincronizado_em: new Date().toISOString(),
      };

      if (r.clienteId || r.cliente_id) {
        insertPayload.cliente_id = r.clienteId || r.cliente_id;
      }

      const { data: result, error } = await supabase
        .from('processos')
        .upsert(insertPayload, {
          onConflict: 'office_id, numero_processo',
          ignoreDuplicates: false,
        })
        .select('*, cliente:clientes(nome)')
        .single();

      if (error) throw error;

      if (andamentos.length > 0) {
        await persistAndamentos(result.id, user.office_id, andamentos);
      }

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

  // Gera hash determinístico (não criptográfico) usado como UNIQUE em movimentacoes.hash
  // Normaliza data e texto pra evitar duplicatas geradas por diferenças cosméticas
  // (ms, timezone, espaços, capitalização, complementos em ordem distinta).
  const buildMovHash = (processoId: string, data: string, texto: string): string => {
    let dataNorm = data || '';
    try {
      // Reduz a YYYY-MM-DDTHH:mm:ss UTC (sem ms, sem timezone offset)
      dataNorm = new Date(data).toISOString().slice(0, 19);
    } catch (_e) {
      dataNorm = String(data).slice(0, 19);
    }
    const textoNorm = (texto || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
      .slice(0, 240);
    return `${processoId}|${dataNorm}|${textoNorm}`;
  };

  // Persiste em batch as movimentações de um processo, fazendo dedup via SELECT prévio.
  const persistAndamentos = async (
    processoId: string,
    officeId: string | undefined,
    andamentos: Array<{ data?: string | null; resumo?: string; descricao?: string; fase?: string }>,
    fonte: string = 'datajud',
  ): Promise<number> => {
    if (!andamentos?.length) {
      console.log('[persistAndamentos] sem andamentos — skip');
      return 0;
    }
    if (!officeId) {
      console.error('[persistAndamentos] officeId vazio! O insert vai falhar por NOT NULL. user.office_id:', officeId);
      return 0;
    }

    const candidates = andamentos
      .map((a) => {
        const texto = a.descricao || a.resumo || '';
        if (!texto) return null;
        const data = a.data || new Date().toISOString();
        return {
          processo_id: processoId,
          office_id: officeId,
          descricao: texto,
          data_movimentacao: data,
          tipo: a.fase || null,
          metadata: { fase: a.fase || null, fonte },
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));

    if (!candidates.length) return 0;

    console.log(`[persistAndamentos] tentando inserir ${candidates.length} movs em movimentacoes_processo (processo=${processoId}, office=${officeId})`);

    // Busca movimentações existentes para deduplicar em memória
    const { data: existingMovs, error: fetchError } = await supabase
      .from('movimentacoes_processo')
      .select('data_movimentacao, descricao')
      .eq('processo_id', processoId);

    if (fetchError) {
      console.error('[persistAndamentos] erro ao buscar existentes:', fetchError);
      return 0;
    }

    const buildDedupeKey = (data: string, desc: string) => {
      let dataNorm = data || '';
      try {
        dataNorm = new Date(data).toISOString().slice(0, 19);
      } catch (_e) {
        dataNorm = String(data).slice(0, 19);
      }
      const descNorm = (desc || '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase()
        .slice(0, 240);
      return `${dataNorm}|${descNorm}`;
    };

    const existingKeys = new Set(
      existingMovs?.map(m => buildDedupeKey(m.data_movimentacao, m.descricao)) || []
    );

    const newCandidates = candidates.filter(
      c => !existingKeys.has(buildDedupeKey(c.data_movimentacao, c.descricao))
    );

    if (!newCandidates.length) {
      console.log('[persistAndamentos] todos andamentos já existem — skip');
      return 0;
    }

    const { data, error, status, statusText } = await supabase
      .from('movimentacoes_processo')
      .insert(newCandidates)
      .select('id');

    if (error) {
      console.error('[persistAndamentos] ❌ erro no insert:', {
        message: error.message,
        code: (error as any).code,
        details: (error as any).details,
        hint: (error as any).hint,
        status,
        statusText,
      });
      toast({
        title: 'Falha ao salvar movimentações',
        description: `${error.message} ${(error as any).hint ? '— ' + (error as any).hint : ''}`,
        variant: 'destructive',
      });
      return 0;
    }

    const inseridos = data?.length || 0;
    console.log(`[persistAndamentos] ✅ ${inseridos}/${candidates.length} novos andamentos persistidos (resto eram duplicatas)`);
    return inseridos;
  };

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
      if ((updates as any).faseProcessual !== undefined) updatePayload.fase_processual = (updates as any).faseProcessual;
      if ((updates as any).classeJudicial !== undefined) updatePayload.classe_judicial = (updates as any).classeJudicial;
      if ((updates as any).assuntoPrincipal !== undefined) updatePayload.assunto_principal = (updates as any).assuntoPrincipal;
      if ((updates as any).instancia !== undefined) updatePayload.instancia = (updates as any).instancia;
      if (updates.tribunal !== undefined) updatePayload.tribunal = updates.tribunal;
      if (updates.vara !== undefined) updatePayload.vara = updates.vara;
      if (updates.comarca !== undefined) updatePayload.comarca = updates.comarca;
      if (updates.valorCausa !== undefined) updatePayload.valor_causa = updates.valorCausa;
      if (updates.proximoPrazo !== undefined) updatePayload.proximo_prazo = updates.proximoPrazo;
      if ((updates as any).parteAutora !== undefined) updatePayload.parte_autora = (updates as any).parteAutora;
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

      console.log('🗑️ [delete] iniciando hard delete do processo:', id);

      const { data, error } = await supabase
        .from('processos')
        .delete()
        .eq('id', id)
        .select('id');

      if (error) {
        console.error('🗑️ [delete] erro Supabase:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        throw error;
      }

      if (!data || data.length === 0) {
        console.error('🗑️ [delete] delete retornou 0 linhas — provável bloqueio de RLS', { id });
        throw new Error('Não foi possível excluir este processo. Verifique sua permissão (RLS).');
      }

      console.log('🗑️ [delete] sucesso, linhas removidas:', data.length);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['processos'] });
      toast({ title: 'Processo excluído', description: 'O registro foi removido permanentemente.' });
    },
    onError: (err: any) => {
      console.error('🗑️ [delete] mutation onError:', err);
      toast({
        title: 'Erro ao excluir processo',
        description: err?.message || 'Falha desconhecida. Veja o console para detalhes.',
        variant: 'destructive',
      });
    },
  });

  const addMovimentacao = async (processoId: string, movData: any) => {
    if (!user) return null;
    try {
      const targetDate = movData.data || new Date().toISOString();
      const texto: string = movData.descricao || movData.texto || '';
      if (!texto) return null;

      // Deduplicar manualmente
      const { data: existing } = await supabase
        .from('movimentacoes_processo')
        .select('id')
        .eq('processo_id', processoId)
        .eq('data_movimentacao', targetDate)
        .eq('descricao', texto)
        .maybeSingle();

      if (existing) {
        return existing;
      }

      const { data: result, error: movError } = await supabase
        .from('movimentacoes_processo')
        .insert([{
          processo_id: processoId,
          office_id: user.office_id,
          data_movimentacao: targetDate,
          descricao: texto,
          tipo: movData.tipo || null,
          metadata: { fase: movData.fase || movData.tipo || null, fonte: movData.fonte || 'manual' },
        }])
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
    persistAndamentos,
    isEmpty: data.length === 0 && !loading,
  };
}