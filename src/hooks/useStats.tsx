import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Stats {
  processosAtivos: number;
  clientes: number;
  tarefasPendentes: number;
  tarefasConcluidas: number;
  audienciasProximas: number;
  prazosVencendo: number;
  receitaMensal: number;
  despesaMensal: number;
  colaboradores: number;
}

const ZEROS: Stats = {
  processosAtivos: 0, clientes: 0, tarefasPendentes: 0, tarefasConcluidas: 0,
  audienciasProximas: 0, prazosVencendo: 0, receitaMensal: 0, despesaMensal: 0, colaboradores: 0,
};

export function useStats() {
  const { user } = useAuth();
  const officeId = user?.office_id;

  const query = useQuery({
    queryKey: ['dashboard-stats', officeId],
    enabled: !!officeId,
    // Cache curto: ao voltar pro dashboard mostra os últimos números NA HORA e revalida
    // em segundo plano — some o "flash de carregando" que aparecia a cada visita.
    staleTime: 60_000,
    // Semeia com os últimos números salvos no localStorage → aparecem na hora mesmo após
    // um F5 (recarga total). initialDataUpdatedAt:0 marca como "velho" → revalida em bg.
    initialData: () => {
      if (!officeId) return undefined;
      try { const c = localStorage.getItem(`stats:${officeId}`); return c ? (JSON.parse(c) as Stats) : undefined; } catch { return undefined; }
    },
    initialDataUpdatedAt: 0,
    queryFn: async (): Promise<Stats> => {
      if (!officeId) return ZEROS;
      const [
        processosResult, clientesResult, tarefasResult, audienciasResult,
        prazosResult, financeiroResult, colaboradoresResult,
      ] = await Promise.all([
        supabase.from('processos').select('id', { count: 'exact' }).eq('office_id', officeId).eq('deletado', false).neq('status', 'encerrado'),
        supabase.from('clientes').select('id', { count: 'exact' }).eq('office_id', officeId).eq('deletado', false).eq('deletado_pendente', false).in('status', ['ativo', 'convertido']),
        supabase.from('tarefas').select('concluida', { count: 'exact' }).eq('office_id', officeId).eq('deletado', false),
        supabase.from('audiencias').select('id', { count: 'exact' }).eq('office_id', officeId).eq('deletado', false).gte('data_audiencia', new Date().toISOString()).lte('data_audiencia', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()),
        supabase.from('prazos').select('id', { count: 'exact' }).eq('office_id', officeId).gte('data_fim_prazo', new Date().toISOString().split('T')[0]).lte('data_fim_prazo', new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]),
        supabase.from('financeiro').select('tipo, valor').eq('office_id', officeId).eq('deletado', false).gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
        supabase.from('office_users').select('id', { count: 'exact' }).eq('office_id', officeId).eq('active', true),
      ]);

      const todasTarefas = tarefasResult.data || [];
      const receitas = financeiroResult.data?.filter((f) => f.tipo === 'receita') || [];
      const despesas = financeiroResult.data?.filter((f) => f.tipo === 'despesa') || [];

      const result: Stats = {
        processosAtivos: processosResult.count || 0,
        clientes: clientesResult.count || 0,
        tarefasPendentes: todasTarefas.filter((t) => !t.concluida).length,
        tarefasConcluidas: todasTarefas.filter((t) => t.concluida).length,
        audienciasProximas: audienciasResult.count || 0,
        prazosVencendo: prazosResult.count || 0,
        receitaMensal: receitas.reduce((s, r) => s + (Number(r.valor) || 0), 0),
        despesaMensal: despesas.reduce((s, d) => s + (Number(d.valor) || 0), 0),
        colaboradores: colaboradoresResult.count || 0,
      };
      try { localStorage.setItem(`stats:${officeId}`, JSON.stringify(result)); } catch { /* ignore */ }
      return result;
    },
  });

  return {
    stats: query.data ?? ZEROS,
    loading: query.isLoading,
    refresh: query.refetch,
    isEmpty: !query.data || Object.values(query.data).every((v) => v === 0),
  };
}
