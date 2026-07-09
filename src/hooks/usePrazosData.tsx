// Dados e mutações da aba de Prazos — extraído de pages/Prazos.tsx sem mudança
// de comportamento. Efeitos de UI (fechar dialog, limpar seleção) entram por
// callbacks opcionais para o hook não conhecer estado de tela.
import { useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  type Prazo, type ProcInfo, type PubInfo,
  onlyDigits, teorPrazo,
} from '@/components/Prazos/shared';

interface UiCallbacks {
  onDeleted?: () => void;      // ex.: fechar o confirm de exclusão
  onBulkDone?: () => void;     // ex.: limpar seleção múltipla
  onBulkDeleted?: () => void;  // ex.: limpar seleção + fechar confirm em massa
}

export function usePrazosData(ui: UiCallbacks = {}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: prazos = [], isLoading } = useQuery<Prazo[]>({
    queryKey: ['prazos', user?.office_id, user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const query = supabase
        .from('prazos')
        .select('*')
        .order('data_fim_prazo', { ascending: true, nullsFirst: false });
      if (user.office_id) {
        query.eq('office_id', user.office_id);
      } else {
        query.eq('responsavel_id', user.id);
      }
      const { data, error } = await query;
      if (error) throw error;
      // Filtra soft-deletados em JS (resiliente caso a coluna ainda não exista)
      return (data || []).filter((p: any) => !p.deletado) as Prazo[];
    },
    enabled: !!user?.id,
    refetchInterval: 60_000,
  });

  // Teor dos prazos capturados pelo robô: vem da publicação que os originou
  const pubIds = useMemo(
    () => Array.from(new Set(prazos.map(p => p.publicacao_id).filter(Boolean))) as string[],
    [prazos]
  );
  const { data: pubInfo = {} } = useQuery<Record<string, PubInfo>>({
    queryKey: ['prazos-publicacoes', pubIds],
    enabled: pubIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from('publicacoes')
        .select('id, titulo, conteudo')
        .in('id', pubIds);
      const map: Record<string, PubInfo> = {};
      (data || []).forEach((p: any) => { map[p.id] = { titulo: p.titulo ?? null, conteudo: p.conteudo ?? null }; });
      return map;
    },
  });

  // Teor já limpo por prazo (evita reprocessar HTML a cada tecla da busca)
  const teorMap = useMemo(() => {
    const m: Record<string, string> = {};
    prazos.forEach(p => { m[p.id] = teorPrazo(p, pubInfo); });
    return m;
  }, [prazos, pubInfo]);

  // Mapa processo → cliente. Indexado por id E por número, porque os prazos do
  // robô guardam apenas `numero_processo` (sem processo_id).
  const { data: processoInfo = { byId: {}, byNumero: {} } } = useQuery<{ byId: Record<string, ProcInfo>; byNumero: Record<string, ProcInfo> }>({
    queryKey: ['prazos-processos', user?.office_id],
    enabled: !!user?.office_id,
    queryFn: async () => {
      const { data } = await supabase.from('processos')
        .select('id, numero_processo, cliente_id, clientes(nome)')
        .eq('office_id', user!.office_id).eq('deletado', false);
      const byId: Record<string, ProcInfo> = {};
      const byNumero: Record<string, ProcInfo> = {};
      (data || []).forEach((p: any) => {
        const info: ProcInfo = { id: p.id, clienteId: p.cliente_id ?? null, clienteNome: p.clientes?.nome ?? null, numero: p.numero_processo ?? null };
        byId[p.id] = info;
        const nd = onlyDigits(p.numero_processo);
        if (nd) byNumero[nd] = info;
      });
      return { byId, byNumero };
    },
  });

  // Resolve o processo do prazo: pelo vínculo direto ou pelo número (prazos do robô)
  const procDoPrazo = (p: Prazo): ProcInfo | null => {
    if (p.processo_id && processoInfo.byId[p.processo_id]) return processoInfo.byId[p.processo_id];
    const nd = onlyDigits(p.numero_processo);
    return nd ? (processoInfo.byNumero[nd] ?? null) : null;
  };
  const clienteDoPrazo = (p: Prazo) => procDoPrazo(p)?.clienteId ?? null;
  const clienteNomeDoPrazo = (p: Prazo) => procDoPrazo(p)?.clienteNome ?? null;

  // Auto-vínculo: o robô grava o prazo só com `numero_processo`. Assim que o
  // processo correspondente existir, grava o `processo_id` de verdade — senão o
  // prazo nunca aparece dentro do processo nem nos filtros por cliente.
  const jaVinculados = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!user?.office_id || !Object.keys(processoInfo.byNumero).length) return;

    const alvos = prazos
      .filter(p => !p.processo_id && p.numero_processo && !jaVinculados.current.has(p.id))
      .map(p => ({ id: p.id, procId: processoInfo.byNumero[onlyDigits(p.numero_processo)]?.id }))
      .filter((x): x is { id: string; procId: string } => !!x.procId);

    if (!alvos.length) return;
    alvos.forEach(a => jaVinculados.current.add(a.id)); // não tenta de novo nesta sessão

    (async () => {
      const porProcesso = new Map<string, string[]>();
      alvos.forEach(({ id, procId }) => porProcesso.set(procId, [...(porProcesso.get(procId) || []), id]));

      let vinculados = 0;
      for (const [procId, ids] of porProcesso) {
        const { error } = await supabase.from('prazos').update({ processo_id: procId }).in('id', ids);
        if (!error) vinculados += ids.length;
      }
      if (vinculados) {
        queryClient.invalidateQueries({ queryKey: ['prazos'] });
        toast({ title: 'Prazos vinculados', description: `${vinculados} prazo(s) do robô foram vinculados ao processo correspondente.` });
      }
    })();
  }, [prazos, processoInfo, user?.office_id, queryClient, toast]);

  // Aceitar a sugestão do robô: o prazo deixa de ser sugestão e passa a ser acompanhado
  const aceitarMutation = useMutation({
    mutationFn: async (id: string) => {
      const agora = new Date().toISOString();
      let { error } = await supabase.from('prazos')
        .update({ confirmado_em: agora, confirmado_por: user?.id } as any)
        .eq('id', id);
      // se a coluna de autor não existir, grava só a data
      if (error) ({ error } = await supabase.from('prazos').update({ confirmado_em: agora } as any).eq('id', id));
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prazos'] });
      toast({ title: 'Sugestão aceita', description: 'O prazo foi confirmado e passa a ser acompanhado normalmente.' });
    },
    onError: (e: any) => toast({
      title: 'Não foi possível aceitar',
      description: `${e.message}. Se a coluna "confirmado_em" ainda não existe, rode a migration de confirmação de prazos.`,
      variant: 'destructive',
    }),
  });

  const concludeMutation = useMutation({
    mutationFn: async (id: string) => {
      // tenta gravar auditoria (data/autor); se as colunas não existirem, grava só o status
      let { error } = await supabase.from('prazos')
        .update({ status: 'concluido', concluido_em: new Date().toISOString(), concluido_por: user?.id } as any)
        .eq('id', id);
      if (error) ({ error } = await supabase.from('prazos').update({ status: 'concluido' }).eq('id', id));
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prazos'] });
      toast({ title: 'Prazo concluído', description: 'Marcado como concluído.' });
    },
  });

  const reopenMutation = useMutation({
    mutationFn: async (id: string) => {
      let { error } = await supabase.from('prazos')
        .update({ status: 'pendente', concluido_em: null, concluido_por: null } as any)
        .eq('id', id);
      if (error) ({ error } = await supabase.from('prazos').update({ status: 'pendente' }).eq('id', id));
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prazos'] });
      toast({ title: 'Prazo reaberto', description: 'Voltou para pendente.' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Soft delete → vai para a Lixeira (recuperável)
      const { error } = await supabase.from('prazos').update({ deletado: true }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prazos'] });
      toast({ title: 'Prazo excluído', description: 'Movido para a lixeira.' });
      ui.onDeleted?.();
    },
    onError: (e: any) => toast({ title: 'Erro ao excluir', description: e.message, variant: 'destructive' }),
  });

  const bulkConcludeMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      let { error } = await supabase.from('prazos')
        .update({ status: 'concluido', concluido_em: new Date().toISOString(), concluido_por: user?.id } as any)
        .in('id', ids);
      if (error) ({ error } = await supabase.from('prazos').update({ status: 'concluido' }).in('id', ids));
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['prazos'] }); ui.onBulkDone?.(); toast({ title: 'Prazos concluídos' }); },
    onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('prazos').update({ deletado: true }).in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['prazos'] }); ui.onBulkDeleted?.(); toast({ title: 'Prazos excluídos', description: 'Movidos para a lixeira.' }); },
    onError: (e: any) => toast({ title: 'Erro ao excluir', description: e.message, variant: 'destructive' }),
  });

  const bulkAssignMutation = useMutation({
    mutationFn: async ({ ids, responsavel_id }: { ids: string[]; responsavel_id: string }) => {
      const { error } = await supabase.from('prazos').update({ responsavel_id }).in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['prazos'] }); ui.onBulkDone?.(); toast({ title: 'Responsável atribuído' }); },
    onError: (e: any) => toast({ title: 'Erro ao atribuir', description: e.message, variant: 'destructive' }),
  });

  return {
    prazos, isLoading,
    pubInfo, teorMap, processoInfo,
    procDoPrazo, clienteDoPrazo, clienteNomeDoPrazo,
    aceitarMutation, concludeMutation, reopenMutation, deleteMutation,
    bulkConcludeMutation, bulkDeleteMutation, bulkAssignMutation,
  };
}
