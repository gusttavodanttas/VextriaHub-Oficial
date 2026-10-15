// Base do CRM: leads inteiros (sem cap), convertidos paginados com contagem exata
// e KPIs dos convertidos vindos do resumo (todos), não da página carregada.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { enfileirar, chamadasCom, resetSupabaseMock } from '../helpers/supabaseMock';
import { wrapper } from './_setup';

vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabase } = await import('../helpers/supabaseMock');
  return { supabase: mockSupabase };
});
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', office_id: 'o1' } }) }));

import { useCrmBase } from '@/hooks/useCrmBase';

describe('useCrmBase', () => {
  beforeEach(() => resetSupabaseMock());

  it('leads sem cap, convertidos paginados e resumo com todos os convertidos', async () => {
    enfileirar('clientes', { data: [{ id: 'l1', status: 'quente', valor_estimado: 1000 }] });            // leads
    enfileirar('clientes', { data: [{ id: 'c1', status: 'convertido', valor_estimado: 500 }], count: 3 }); // convertidos, 1ª página
    enfileirar('clientes', { data: [{ id: 'c1', valor_estimado: 500 }, { id: 'c2', valor_estimado: 700 }, { id: 'c3', valor_estimado: null }] }); // resumo
    const { result } = renderHook(() => useCrmBase(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await waitFor(() => expect(result.current.resumoConvertidos).not.toBeNull());

    expect(result.current.leads.map(l => l.id)).toEqual(['l1']);
    expect(result.current.convertidos.map(c => c.id)).toEqual(['c1']);
    expect(result.current.convertidosRestantes).toBe(2);
    expect(result.current.resumoConvertidos).toEqual({ total: 3, valorGanho: 1200 });
    expect(result.current.todos.map(c => c.id)).toEqual(['l1', 'c1']);

    const sels = chamadasCom('clientes', 'select');
    expect(sels.some(s => s.ops.some(([m]) => m === 'limit'))).toBe(false);
    const leads = sels[0];
    expect(leads.ops).toEqual(expect.arrayContaining([
      ['eq', ['office_id', 'o1']], ['eq', ['deletado', false]], ['eq', ['deletado_pendente', false]],
      ['in', ['status', ['lead', 'quente', 'morno', 'frio']]],
    ]));
    const conv = sels.find(s => s.ops.some(([m]) => m === 'range'))!;
    expect(conv.ops).toEqual(expect.arrayContaining([['eq', ['status', 'convertido']], ['range', [0, 199]]]));
    expect(conv.ops.find(([m]) => m === 'select')![1][1]).toEqual({ count: 'exact' });
  });

  it('erro em qualquer consulta vira error legível', async () => {
    enfileirar('clientes', { error: { message: 'RLS' } });
    const { result } = renderHook(() => useCrmBase(), { wrapper });
    await waitFor(() => expect(result.current.error).toBe('RLS'));
    expect(result.current.leads).toEqual([]);
  });
});
