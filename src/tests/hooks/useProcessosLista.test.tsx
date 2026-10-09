// useProcessosLista / useProcessosStatusCounts: paginação no servidor, filtro por
// aba de status, busca por título/número/cliente e contagens por status.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { enfileirar, chamadasCom, resetSupabaseMock } from '../helpers/supabaseMock';
import { wrapper } from './_setup';

vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabase } = await import('../helpers/supabaseMock');
  return { supabase: mockSupabase };
});
const auth = { user: { id: 'u1', office_id: 'o1' } as { id: string; office_id: string | null } | null };
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));

import { useProcessosLista, useProcessosStatusCounts, STATUS_TAB_TO_DB } from '@/hooks/useProcessosLista';

const dbRow = (over: Record<string, unknown> = {}) => ({
  id: 'p1', titulo: 'Ação X', status: 'ativo', cliente_id: 'c1', cliente: { nome: 'Maria' },
  numero_processo: '00012345620268260100', created_at: '2026-10-01T00:00:00Z', user_id: 'u1', ...over,
});

describe('useProcessosLista', () => {
  beforeEach(() => { resetSupabaseMock(); auth.user = { id: 'u1', office_id: 'o1' }; });

  it('página 2 da aba ativos: filtra status, exclui deletados, range correto e total do count', async () => {
    enfileirar('processos', { data: [dbRow()], count: 37 });
    const { result } = renderHook(() => useProcessosLista({ page: 2, pageSize: 10, statusTab: 'ativos' }), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.total).toBe(37);
    expect(result.current.data[0]).toMatchObject({ id: 'p1', cliente: 'Maria', status: 'Em andamento' });
    const sel = chamadasCom('processos', 'select')[0];
    expect(sel.ops).toEqual(expect.arrayContaining([
      ['eq', ['deletado', false]], ['eq', ['status', 'ativo']],
      ['order', ['created_at', { ascending: false }]], ['range', [10, 19]],
    ]));
    expect(sel.ops.some(([m]) => m === 'or')).toBe(false);
  });

  it('aba "todos" não filtra status; responsáveis viram .in', async () => {
    enfileirar('processos', { data: [], count: 0 });
    const { result } = renderHook(() => useProcessosLista({ page: 1, pageSize: 20, statusTab: 'todos', responsavelIds: ['u1', 'u2'] }), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    const sel = chamadasCom('processos', 'select')[0];
    expect(sel.ops.some(([m, a]) => m === 'eq' && a[0] === 'status')).toBe(false);
    expect(sel.ops).toEqual(expect.arrayContaining([['in', ['responsavel_id', ['u1', 'u2']]], ['range', [0, 19]]]));
  });

  it('busca: resolve clientes por nome e monta o .or com título, número limpo e ids de cliente', async () => {
    enfileirar('clientes', { data: [{ id: 'c1' }, { id: 'c2' }] });
    enfileirar('processos', { data: [], count: 0 });
    const { result } = renderHook(() => useProcessosLista({ page: 1, pageSize: 10, statusTab: 'todos', search: ' 123-45 (a,b) ' }), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    const busca = chamadasCom('clientes', 'select')[0];
    expect(busca.ops).toEqual(expect.arrayContaining([['ilike', ['nome', '%123-45 (a,b)%']]]));
    const sel = chamadasCom('processos', 'select')[0];
    const or = sel.ops.find(([m]) => m === 'or')![1][0];
    expect(or).toBe('titulo.ilike."%123-45 (a,b)%",numero_processo.ilike."%12345%",cliente_id.in.(c1,c2)');
  });

  it('filtro por cliente inexistente força resultado vazio em vez de ignorar o filtro', async () => {
    enfileirar('clientes', { data: [] });
    enfileirar('processos', { data: [], count: 0 });
    const { result } = renderHook(() => useProcessosLista({ page: 1, pageSize: 10, statusTab: 'todos', clienteNome: 'Fulano' }), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    const sel = chamadasCom('processos', 'select')[0];
    expect(sel.ops).toEqual(expect.arrayContaining([['in', ['cliente_id', ['00000000-0000-0000-0000-000000000000']]]]));
  });

  it('erro do banco vira `error`; sem usuário não consulta', async () => {
    enfileirar('processos', { error: { message: 'boom' } });
    const { result } = renderHook(() => useProcessosLista({ page: 1, pageSize: 10, statusTab: 'ativos' }), { wrapper });
    await waitFor(() => expect(result.current.error).toBe('boom'));
    expect(result.current.data).toEqual([]);

    resetSupabaseMock();
    auth.user = null;
    const { result: r2 } = renderHook(() => useProcessosLista({ page: 1, pageSize: 10, statusTab: 'ativos' }), { wrapper });
    expect(r2.current.data).toEqual([]);
    expect(chamadasCom('processos', 'select')).toHaveLength(0);
  });
});

describe('useProcessosStatusCounts', () => {
  beforeEach(() => { resetSupabaseMock(); auth.user = { id: 'u1', office_id: 'o1' }; });

  it('uma contagem head por aba, independente de busca/filtro', async () => {
    enfileirar('processos', { count: 5 }, { count: 2 }, { count: 1 }, { count: 8 });
    const { result } = renderHook(() => useProcessosStatusCounts(), { wrapper });
    await waitFor(() => expect(result.current.todos).toBe(8));
    expect(result.current).toEqual({ ativos: 5, concluidos: 2, suspensos: 1, todos: 8 });
    const sels = chamadasCom('processos', 'select');
    expect(sels).toHaveLength(Object.keys(STATUS_TAB_TO_DB).length);
    expect(sels[1].ops).toEqual(expect.arrayContaining([
      ['select', ['id', { count: 'exact', head: true }]], ['eq', ['deletado', false]], ['eq', ['status', 'Concluído']],
    ]));
    expect(sels[3].ops.some(([m, a]) => m === 'eq' && a[0] === 'status')).toBe(false);
  });

  it('antes de carregar devolve zeros', () => {
    auth.user = null;
    const { result } = renderHook(() => useProcessosStatusCounts(), { wrapper });
    expect(result.current).toEqual({ ativos: 0, concluidos: 0, suspensos: 0, todos: 0 });
  });
});
