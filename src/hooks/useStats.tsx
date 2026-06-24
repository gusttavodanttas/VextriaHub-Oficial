import { useState, useEffect } from 'react';
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

export function useStats() {
  const [stats, setStats] = useState<Stats>({
    processosAtivos: 0,
    clientes: 0,
    tarefasPendentes: 0,
    tarefasConcluidas: 0,
    audienciasProximas: 0,
    prazosVencendo: 0,
    receitaMensal: 0,
    despesaMensal: 0,
    colaboradores: 0,
  });
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchStats = async () => {
    if (!user?.office_id) {
      // Se não há office_id mas ainda estamos carregando o auth, não pare o loading do stats
      // Isso evita o flash de "0" antes do perfil carregar
      return;
    }

    try {
      setLoading(true);

      // Buscar estatísticas em paralelo usando office_id para multi-tenancy
      const [
        processosResult,
        clientesResult,
        tarefasResult,
        audienciasResult,
        prazosResult,
        financeiroResult,
        colaboradoresResult
      ] = await Promise.all([
        // Processos ativos do escritório
        supabase
          .from('processos')
          .select('id', { count: 'exact' })
          .eq('office_id', user.office_id)
          .eq('deletado', false)
          .neq('status', 'encerrado'),

        // Total de clientes reais do escritório (excluindo leads de prospecção)
        supabase
          .from('clientes')
          .select('id', { count: 'exact' })
          .eq('office_id', user.office_id)
          .eq('deletado', false)
          .eq('deletado_pendente', false)
          .in('status', ['ativo', 'convertido']),

        // Tarefas do escritório
        supabase
          .from('tarefas')
          .select('concluida', { count: 'exact' })
          .eq('office_id', user.office_id)
          .eq('deletado', false),

        // Audiências próximas (próximos 7 dias) no escritório
        supabase
          .from('audiencias')
          .select('id', { count: 'exact' })
          .eq('office_id', user.office_id)
          .eq('deletado', false)
          .gte('data_audiencia', new Date().toISOString())
          .lte('data_audiencia', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()),

        // Prazos vencendo (próximos 3 dias) no escritório
        supabase
          .from('prazos')
          .select('id', { count: 'exact' })
          .eq('office_id', user.office_id)
          .eq('deletado', false)
          .eq('status', 'pendente')
          .lte('data_vencimento', new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]),

        // Financeiro do mês atual do escritório
        supabase
          .from('financeiro')
          .select('tipo, valor')
          .eq('office_id', user.office_id)
          .eq('deletado', false)
          .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),

        // Total de colaboradores (usuários) do escritório
        supabase
          .from('office_users')
          .select('id', { count: 'exact' })
          .eq('office_id', user.office_id)
          .eq('active', true)
      ]);

      // Processar tarefas
      const todasTarefas = tarefasResult.data || [];
      const tarefasPendentes = todasTarefas.filter(t => !t.concluida).length || 0;
      const tarefasConcluidas = todasTarefas.filter(t => t.concluida).length || 0;

      // Processar financeiro
      const receitas = financeiroResult.data?.filter(f => f.tipo === 'receita') || [];
      const despesas = financeiroResult.data?.filter(f => f.tipo === 'despesa') || [];
      const receitaMensal = receitas.reduce((sum, r) => sum + (Number(r.valor) || 0), 0);
      const despesaMensal = despesas.reduce((sum, d) => sum + (Number(d.valor) || 0), 0);

      setStats({
        processosAtivos: processosResult.count || 0,
        clientes: clientesResult.count || 0,
        tarefasPendentes,
        tarefasConcluidas,
        audienciasProximas: audienciasResult.count || 0,
        prazosVencendo: prazosResult.count || 0,
        receitaMensal,
        despesaMensal,
        colaboradores: colaboradoresResult.count || 0,
      });

    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [user]);

  return {
    stats,
    loading,
    refresh: fetchStats,
    isEmpty: Object.values(stats).every(val => val === 0),
  };
}