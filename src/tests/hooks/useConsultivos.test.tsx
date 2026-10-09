// useConsultivos: lista paginada com filtros no servidor, contagens por status e
// mutations com checagem de linhas afetadas.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { enfileirar, chamadasCom, resetSupabaseMock } from '../helpers/supabaseMock';
import { PERMISSAO_NEGADA } from '@/lib/errors';
import { wrapper } from './_setup';

vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabase } = await import('../helpers/supabaseMock');
  return { supabase: mockSupabase };
});
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', office_id: 'o1' } }) }));
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }));

import { useConsultivos, useConsultivosLista, useConsultivosStatusCounts } from '@/hooks/useConsultivos';

describe('useConsultivos', () => {
  beforeEach(() => { resetSupabaseMock(); mockToast.mockClear(); });

  it('lista: filtros viram cláusulas no servidor e a página vira range', async () => {
    enfileirar('consultivos', { data: [{ id: 'c1', titulo: 'Parecer' }], count: 31 });
    const { result } = renderHook(() => useConsultivosLista({ page: 2, pageSize: 10, status: 'pendente', categoria: 'all', prioridade: 'alta', clienteId: 'cli1', search: 'contrato' }), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.total).toBe(31);
    const sel = chamadasCom('consultivos', 'select')[0];
    expect(sel.ops).toEqual(expect.arrayContaining([
      ['eq', ['office_id', 'o1']], ['eq', ['deletado', false]], ['eq', ['status', 'pendente']],
      ['eq', ['prioridade', 'alta']], ['eq', ['cliente_id', 'cli1']], ['range', [10, 19]],
    ]));
    expect(sel.ops.some(([m]) => m === 'eq' && (sel.ops.find(([mm, a]) => mm === 'eq' && a[0] === 'categoria')))).toBe(false);
    const or = sel.ops.find(([m]) => m === 'or')![1][0] as string;
    expect(or).toContain('titulo.ilike.');
    expect(or).toContain('%contrato%');
  });

  it('lista: erro da busca é exposto em `error`', async () => {
    enfileirar('consultivos', { error: { message: 'boom' } });
    const { result } = renderHook(() => useConsultivosLista({ page: 1, pageSize: 24 }), { wrapper });
    await waitFor(() => expect(result.current.error).toBe('boom'));
    expect(result.current.data).toEqual([]);
  });

  it('contagens por status fazem 4 consultas head/count e devolvem os números', async () => {
    enfileirar('consultivos', { count: 9 }, { count: 4 }, { count: 3 }, { count: 2 });
    const { result } = renderHook(() => useConsultivosStatusCounts(), { wrapper });
    await waitFor(() => expect(result.current.total).toBe(9));
    expect(result.current).toEqual({ total: 9, pendente: 4, em_andamento: 3, concluido: 2 });
    expect(chamadasCom('consultivos', 'select')).toHaveLength(4);
  });

  it('update/remove barrados pela RLS devolvem false com toast; create grava office_id e user_id', async () => {
    const { result } = renderHook(() => useConsultivos(), { wrapper });
    enfileirar('consultivos', { data: [] });
    let ok: boolean | undefined;
    await act(async () => { ok = await result.current.update('c1', { titulo: 'x' }); });
    expect(ok).toBe(false);
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Erro ao atualizar', description: PERMISSAO_NEGADA }));

    enfileirar('consultivos', { data: [] });
    await act(async () => { ok = await result.current.remove('c1'); });
    expect(ok).toBe(false);
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Erro ao remover', description: PERMISSAO_NEGADA }));

    enfileirar('consultivos', { data: null });
    await act(async () => { ok = await result.current.create({ titulo: 'Novo', categoria: 'contratos' } as any); });
    expect(ok).toBe(true);
    const ins = chamadasCom('consultivos', 'insert').at(-1)!;
    expect(ins.ops.find(([m]) => m === 'insert')![1][0]).toMatchObject({ titulo: 'Novo', office_id: 'o1', user_id: 'u1' });
  });
});
