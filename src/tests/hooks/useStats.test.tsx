// useStats (KPIs do dashboard): soma dos 7 resultados, erro de qualquer um deles
// exposto mesmo com cache no localStorage, e cache gravado após sucesso.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { enfileirar, chamadasCom, resetSupabaseMock } from '../helpers/supabaseMock';
import { wrapper } from './_setup';

vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabase } = await import('../helpers/supabaseMock');
  return { supabase: mockSupabase };
});
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', office_id: 'o1' } }) }));

import { useStats } from '@/hooks/useStats';

describe('useStats', () => {
  beforeEach(() => { resetSupabaseMock(); localStorage.clear(); });

  it('monta os KPIs a partir das 7 consultas e grava o cache', async () => {
    enfileirar('processos', { count: 12 });
    enfileirar('clientes', { count: 30 });
    enfileirar('tarefas', { data: [{ concluida: true }, { concluida: false }, { concluida: false }] });
    enfileirar('audiencias', { count: 2 });
    enfileirar('prazos', { count: 5 });
    enfileirar('financeiro', { data: [{ tipo: 'receita', valor: 1000 }, { tipo: 'receita', valor: '250' }, { tipo: 'despesa', valor: 300 }] });
    enfileirar('office_users', { count: 4 });
    const { result } = renderHook(() => useStats(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.stats).toEqual({
      processosAtivos: 12, clientes: 30, tarefasPendentes: 2, tarefasConcluidas: 1,
      audienciasProximas: 2, prazosVencendo: 5, receitaMensal: 1250, despesaMensal: 300, colaboradores: 4,
    });
    expect(result.current.isError).toBe(false);
    expect(JSON.parse(localStorage.getItem('stats:o1')!)).toMatchObject({ processosAtivos: 12 });
    const fin = chamadasCom('financeiro', 'select')[0];
    expect(fin.ops).toContainEqual(['or', ['status.is.null,status.neq.cancelado']]);
  });

  it('com cache no localStorage, mostra os números antigos e expõe o erro do refetch', async () => {
    localStorage.setItem('stats:o1', JSON.stringify({ processosAtivos: 9, clientes: 1, tarefasPendentes: 0, tarefasConcluidas: 0, audienciasProximas: 0, prazosVencendo: 0, receitaMensal: 0, despesaMensal: 0, colaboradores: 1 }));
    enfileirar('processos', { error: { message: 'rls' } });
    const { result } = renderHook(() => useStats(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe('rls');
    expect(result.current.stats.processosAtivos).toBe(9);
  });
});
