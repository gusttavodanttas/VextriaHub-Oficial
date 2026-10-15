// useCorrespondentes: listas filtradas por escritório, estatísticas derivadas das
// diligências, erro exposto e mutations com linhas afetadas.
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

import { useCorrespondentes } from '@/hooks/useCorrespondentes';

describe('useCorrespondentes', () => {
  beforeEach(() => { resetSupabaseMock(); mockToast.mockClear(); });

  it('lista correspondentes e diligências (ativas + histórico paginado) e deriva as estatísticas', async () => {
    enfileirar('correspondentes', { data: [{ id: 'c1', nome: 'Ana' }] });
    enfileirar('diligencias', { data: [   // ativas: abertas + realizadas não pagas
      { id: 'd1', correspondente_id: 'c1', status: 'realizada', pago: false, valor: 150, avaliacao: 4 },
      { id: 'd3', correspondente_id: 'c1', status: 'solicitada' },
    ] });
    enfileirar('diligencias', { data: [   // histórico (1ª página): pagas + canceladas
      { id: 'd2', correspondente_id: 'c1', status: 'realizada', pago: true, valor: 100, avaliacao: 2 },
      { id: 'd4', correspondente_id: 'c1', status: 'cancelada' },
    ], count: 12 });
    const { result } = renderHook(() => useCorrespondentes(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.correspondentes).toHaveLength(1);
    expect(result.current.statsByCorrespondente.get('c1')).toEqual({ total: 4, realizadas: 2, canceladas: 1, abertas: 1, avgRating: 3, aPagarCount: 1, aPagarValor: 150 });
    expect(result.current.historicoRestantes).toBe(10);
    const corr = chamadasCom('correspondentes', 'select')[0];
    expect(corr.ops).toEqual(expect.arrayContaining([['eq', ['office_id', 'o1']], ['eq', ['deletado', false]]]));
    const dils = chamadasCom('diligencias', 'select');
    expect(dils.some(s => s.ops.some(([m]) => m === 'limit'))).toBe(false);
    const ativas = dils[0];
    expect(String(ativas.ops.find(([m]) => m === 'or')![1][0])).toBe('status.not.in.(realizada,cancelada),and(status.eq.realizada,pago.not.is.true)');
    const hist = dils.find(s => s.ops.some(([m]) => m === 'range'))!;
    expect(hist.ops).toEqual(expect.arrayContaining([['eq', ['office_id', 'o1']], ['range', [0, 199]]]));
    expect(hist.ops.find(([m]) => m === 'select')![1][1]).toEqual({ count: 'exact' });
  });

  it('erro em qualquer uma das listas é exposto', async () => {
    enfileirar('correspondentes', { data: [] });
    enfileirar('diligencias', { error: { message: 'boom' } });
    const { result } = renderHook(() => useCorrespondentes(), { wrapper });
    await waitFor(() => expect(result.current.error).toBe('boom'));
  });

  it('atualizar correspondente e remover diligência barrados pela RLS rejeitam com toast', async () => {
    enfileirar('correspondentes', { data: [] });
    enfileirar('diligencias', { data: [] });
    const { result } = renderHook(() => useCorrespondentes(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    enfileirar('correspondentes', { data: [] });
    await act(async () => { await result.current.saveCorrespondente('c1', { nome: 'Novo' }).catch(() => undefined); });
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Erro ao salvar correspondente', description: PERMISSAO_NEGADA }));

    enfileirar('diligencias', { data: [] });
    await act(async () => { await result.current.deleteDiligencia('d1').catch(() => undefined); });
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Erro ao remover', description: PERMISSAO_NEGADA }));
    const upd = chamadasCom('diligencias', 'update').at(-1)!;
    expect(upd.ops.find(([m]) => m === 'update')![1][0]).toMatchObject({ deletado: true });
  });
});
