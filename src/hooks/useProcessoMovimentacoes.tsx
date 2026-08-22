import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useProcessosV2 } from '@/hooks/useProcessosV2';
import { useQueryClient } from '@tanstack/react-query';
import { Processo } from '@/types/processo';

export interface Movimentacao {
  id: string;
  data: string;
  texto: string;
  tipo?: string | null;
  fonte?: string;
  metadata?: Record<string, unknown>;
}

// A confirmação vem da API externa (fetch-processo) — shape dinâmico, mantido flexível.
interface AndamentoConfirmState { all: any[]; novos: any[]; meta: any; processoId: string; }

/**
 * Movimentações/andamentos de um processo: busca, exclusão, sincronização com a
 * fonte (DataJud/PJe) e confirmação dos andamentos novos. Extraído do
 * ProcessoDetailsDrawer para enxugá-lo (mesmo padrão de useProcessoSubData).
 */
export function useProcessoMovimentacoes(processo: Processo | null, open: boolean) {
  const { user, profile } = useAuth();
  const { persistAndamentos } = useProcessosV2();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [movements, setMovements] = useState<Movimentacao[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(false);
  const [confirmDelMov, setConfirmDelMov] = useState<string | null>(null);
  const [delMovLoading, setDelMovLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [andamentoConfirm, setAndamentoConfirm] = useState<AndamentoConfirmState | null>(null);
  const [lastSyncedProcessoId, setLastSyncedProcessoId] = useState<string | null>(null);

  const fetchMovements = useCallback(async () => {
    if (!processo?.id) return;
    setLoadingMovements(true);
    const { data, error } = await supabase
      .from('movimentacoes_processo')
      .select('id, data:data_movimentacao, texto:descricao, tipo, metadata')
      .eq('processo_id', processo.id)
      .order('data_movimentacao', { ascending: false });
    if (!error && data) setMovements(data as unknown as Movimentacao[]);
    setLoadingMovements(false);
  }, [processo?.id]);

  // Exclui um andamento (movimentação) específico — usado para remover andamentos errados
  const handleDeleteMovement = useCallback(async (id: string) => {
    setDelMovLoading(true);
    const { error } = await supabase.from('movimentacoes_processo').delete().eq('id', id);
    setDelMovLoading(false);
    if (error) { toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' }); return; }
    setMovements(prev => prev.filter(m => m.id !== id));
    setConfirmDelMov(null);
    toast({ title: 'Andamento excluído' });
  }, [toast]);

  const syncFromOrigin = useCallback(async () => {
    if (!processo?.id || !processo.numeroProcesso || syncing) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-processo', {
        body: { numeroProcesso: processo.numeroProcesso, oab: (profile as any)?.oab, uf: (profile as any)?.oab_uf },
      });
      if (error || !data || data.error) {
        toast({ title: 'Sem dados disponíveis', description: 'Não foi possível buscar andamentos no momento.', variant: 'destructive' });
        return;
      }
      const andamentos = Array.isArray(data.andamentos) ? data.andamentos : [];
      // Detecta apenas os andamentos NOVOS (não pede pra adicionar o que já existe).
      // Busca os existentes direto do banco DESTE processo (não do estado, que é limpo ao trocar).
      const keyOf = (dt: any, tx: any) => `${String(dt || '').slice(0, 10)}|${String(tx || '').toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 60)}`;
      const { data: existingRows } = await supabase
        .from('movimentacoes_processo')
        .select('data_movimentacao, descricao')
        .eq('processo_id', processo.id);
      const existing = new Set((existingRows || []).map((m: any) => keyOf(m.data_movimentacao, m.descricao)));
      const novos = andamentos.filter((a: any) => !existing.has(keyOf(a.data, a.descricao || a.resumo)));
      if (novos.length === 0) {
        toast({ title: 'Já atualizado', description: 'Nenhum andamento novo encontrado.' });
      } else {
        // Não salva automático: abre confirmação com os novos andamentos (amarrada ao processo atual)
        setAndamentoConfirm({ all: andamentos, novos, meta: data, processoId: processo.id });
      }
      await fetchMovements();
    } catch (err) {
      console.error(err);
      toast({ title: 'Erro ao sincronizar', description: 'Não foi possível buscar os andamentos agora. Tente de novo.', variant: 'destructive' });
    }
    finally { setSyncing(false); }
  }, [processo?.id, processo?.numeroProcesso, syncing, user?.office_id, profile, toast, fetchMovements]);

  // Confirma e persiste os andamentos novos
  const confirmAndamentos = useCallback(async () => {
    if (!andamentoConfirm || !processo?.id) return;
    // Segurança: só persiste se a confirmação for DESTE processo (evita salvar andamentos de outro)
    if (andamentoConfirm.processoId !== processo.id) { setAndamentoConfirm(null); return; }
    setSyncing(true);
    try {
      const data = andamentoConfirm.meta;
      const inseridos = await persistAndamentos(processo.id, user?.office_id ?? undefined, andamentoConfirm.all, 'datajud');
      const updatePayload: any = { sincronizado_em: new Date().toISOString() };
      if (data.titulo && data.titulo !== 'Processo' && (!processo.titulo || processo.titulo.includes('(Auto)'))) updatePayload.titulo = data.titulo;
      if (data.autor && data.autor !== 'Não identificado' && !processo.parteAutora) updatePayload.parte_autora = data.autor;
      if (data.reu && data.reu !== 'Não identificado' && !processo.requerido) updatePayload.requerido = data.reu;
      await supabase.from('processos').update(updatePayload).eq('id', processo.id);
      queryClient.invalidateQueries({ queryKey: ['processos'] });
      await fetchMovements();
      toast({ title: 'Histórico atualizado', description: `${inseridos} movimentação(ões) adicionada(s).` });
    } finally {
      setSyncing(false);
      setAndamentoConfirm(null);
    }
  }, [andamentoConfirm, processo, user?.office_id, persistAndamentos, queryClient, fetchMovements, toast]);

  // Zera ao TROCAR de processo ou fechar (evita andamentos de um processo vazarem pro próximo).
  useEffect(() => {
    setMovements([]);
    setAndamentoConfirm(null);
    setConfirmDelMov(null);
    setLastSyncedProcessoId(null);
  }, [processo?.id, open]);

  // Busca ao abrir.
  useEffect(() => {
    if (!processo?.id || !open) return;
    fetchMovements();
  }, [processo?.id, open, fetchMovements]);

  return {
    movements, loadingMovements, confirmDelMov, setConfirmDelMov, delMovLoading,
    syncing, andamentoConfirm, setAndamentoConfirm, lastSyncedProcessoId, setLastSyncedProcessoId,
    fetchMovements, handleDeleteMovement, syncFromOrigin, confirmAndamentos,
  };
}
