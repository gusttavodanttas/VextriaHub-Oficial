// useProcessoMovimentacoes: busca ao abrir, zera ao trocar de processo, exclusão com
// RLS, sincronização detectando só andamentos novos e confirmação carimbando o processo.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { enfileirar, chamadasCom, resetSupabaseMock, mockSupabase } from '../helpers/supabaseMock';
import { wrapper } from './_setup';

vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabase } = await import('../helpers/supabaseMock');
  return { supabase: mockSupabase };
});
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', office_id: 'o1' }, profile: { oab: '123', oab_uf: 'DF' } }) }));
const perms = { canDeleteProcesses: true };
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => perms }));
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }));
const persistAndamentos = vi.fn(async () => 2);
vi.mock('@/hooks/useProcessosV2', () => ({ useProcessosV2: () => ({ persistAndamentos }) }));

import { useProcessoMovimentacoes } from '@/hooks/useProcessoMovimentacoes';
import type { Processo } from '@/types/processo';

const processo = (over: Partial<Processo> = {}) => ({ id: 'p1', numeroProcesso: '0001', titulo: 'Caso (Auto)', ...over }) as Processo;
const mov = { id: 'm1', data: '2026-10-01', texto: 'Juntada', tipo: null, metadata: null };

describe('useProcessoMovimentacoes', () => {
  beforeEach(() => {
    resetSupabaseMock(); mockToast.mockClear(); persistAndamentos.mockClear();
    mockSupabase.functions.invoke.mockReset(); perms.canDeleteProcesses = true;
  });

  it('busca ao abrir e zera ao trocar de processo', async () => {
    enfileirar('movimentacoes_processo', { data: [mov] });
    const { result, rerender } = renderHook(({ p, open }) => useProcessoMovimentacoes(p, open), { wrapper, initialProps: { p: processo(), open: true } });
    await waitFor(() => expect(result.current.movements).toEqual([mov]));
    expect(chamadasCom('movimentacoes_processo', 'select')[0].ops).toEqual(expect.arrayContaining([['eq', ['processo_id', 'p1']], ['order', ['data_movimentacao', { ascending: false }]]]));

    enfileirar('movimentacoes_processo', { data: [] });
    rerender({ p: processo({ id: 'p2' }), open: true });
    await waitFor(() => expect(result.current.movements).toEqual([]));

    resetSupabaseMock();
    rerender({ p: processo({ id: 'p2' }), open: false });
    expect(chamadasCom('movimentacoes_processo', 'select')).toHaveLength(0);
  });

  it('canDeleteMovement: nega em processo compartilhado ou sem permissão granular', () => {
    const { result } = renderHook(() => useProcessoMovimentacoes(processo({ sharedFrom: { shareId: 's', ownerOfficeName: 'X', permission: 'editar' } } as never), false), { wrapper });
    expect(result.current.canDeleteMovement).toBe(false);
    perms.canDeleteProcesses = false;
    const { result: r2 } = renderHook(() => useProcessoMovimentacoes(processo(), false), { wrapper });
    expect(r2.current.canDeleteMovement).toBe(false);
  });

  it('excluir andamento: RLS (0 linhas) → "Erro ao excluir" e lista intocada; 1 linha → remove', async () => {
    enfileirar('movimentacoes_processo', { data: [mov] });
    const { result } = renderHook(() => useProcessoMovimentacoes(processo(), true), { wrapper });
    await waitFor(() => expect(result.current.movements).toHaveLength(1));

    enfileirar('movimentacoes_processo', { data: [] });
    await act(async () => { await result.current.handleDeleteMovement('m1'); });
    expect(result.current.movements).toHaveLength(1);
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Erro ao excluir', variant: 'destructive' }));

    enfileirar('movimentacoes_processo', { data: [{ id: 'm1' }] });
    await act(async () => { await result.current.handleDeleteMovement('m1'); });
    expect(result.current.movements).toHaveLength(0);
    expect(mockToast).toHaveBeenLastCalledWith({ title: 'Andamento excluído' });
    expect(chamadasCom('movimentacoes_processo', 'delete')[1].ops).toEqual(expect.arrayContaining([['eq', ['id', 'm1']], ['select', ['id']]]));
  });

  it('sincronizar: só os andamentos novos vão pra confirmação; nada novo → "Já atualizado"', async () => {
    enfileirar('movimentacoes_processo', { data: [] });
    const { result } = renderHook(() => useProcessoMovimentacoes(processo(), true), { wrapper });
    await waitFor(() => expect(result.current.loadingMovements).toBe(false));

    mockSupabase.functions.invoke.mockResolvedValueOnce({ data: { andamentos: [
      { data: '2026-10-01T00:00:00', descricao: 'Juntada  de petição' }, { data: '2026-10-05', resumo: 'Sentença' },
    ] }, error: null });
    enfileirar('movimentacoes_processo', { data: [{ data_movimentacao: '2026-10-01', descricao: 'juntada de petição' }] }); // existentes
    enfileirar('movimentacoes_processo', { data: [] }); // refetch
    await act(async () => { await result.current.syncFromOrigin(); });
    expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('fetch-processo', { body: { numeroProcesso: '0001', oab: '123', uf: 'DF' } });
    expect(result.current.andamentoConfirm?.novos).toEqual([{ data: '2026-10-05', resumo: 'Sentença' }]);
    expect(result.current.andamentoConfirm?.processoId).toBe('p1');

    mockSupabase.functions.invoke.mockResolvedValueOnce({ data: { andamentos: [] }, error: null });
    enfileirar('movimentacoes_processo', { data: [] });
    enfileirar('movimentacoes_processo', { data: [] });
    await act(async () => { result.current.setAndamentoConfirm(null); });
    await act(async () => { await result.current.syncFromOrigin(); });
    expect(result.current.andamentoConfirm).toBeNull();
    expect(mockToast).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Já atualizado' }));

    mockSupabase.functions.invoke.mockResolvedValueOnce({ data: null, error: { message: '500' } });
    await act(async () => { await result.current.syncFromOrigin(); });
    expect(mockToast).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Sem dados disponíveis' }));
  });

  it('confirmar: persiste andamentos e carimba o processo; RLS no carimbo → toast específico', async () => {
    enfileirar('movimentacoes_processo', { data: [] });
    const { result } = renderHook(() => useProcessoMovimentacoes(processo(), true), { wrapper });
    await waitFor(() => expect(result.current.loadingMovements).toBe(false));
    const meta = { titulo: 'Ação de Cobrança', autor: 'Maria', reu: 'Não identificado', andamentos: [] };
    act(() => { result.current.setAndamentoConfirm({ all: [{ a: 1 }], novos: [{ a: 1 }], meta, processoId: 'p1' }); });

    enfileirar('processos', { data: [{ id: 'p1' }] });
    enfileirar('movimentacoes_processo', { data: [mov] });
    await act(async () => { await result.current.confirmAndamentos(); });
    expect(persistAndamentos).toHaveBeenCalledWith('p1', 'o1', [{ a: 1 }], 'datajud');
    const up = chamadasCom('processos', 'update')[0];
    const payload = up.ops[0][1][0] as Record<string, unknown>;
    expect(payload).toMatchObject({ titulo: 'Ação de Cobrança', parte_autora: 'Maria' });
    expect(payload.requerido).toBeUndefined();
    expect(typeof payload.sincronizado_em).toBe('string');
    expect(up.ops).toEqual(expect.arrayContaining([['eq', ['id', 'p1']], ['select', ['id']]]));
    expect(mockToast).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Histórico atualizado', description: '2 movimentação(ões) adicionada(s).' }));
    expect(result.current.andamentoConfirm).toBeNull();
    expect(result.current.movements).toEqual([mov]);

    act(() => { result.current.setAndamentoConfirm({ all: [], novos: [], meta: {}, processoId: 'p1' }); });
    enfileirar('processos', { data: [] });
    enfileirar('movimentacoes_processo', { data: [mov] });
    await act(async () => { await result.current.confirmAndamentos(); });
    expect(mockToast).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Andamentos salvos, mas o processo não foi atualizado', variant: 'destructive' }));

    // confirmação de OUTRO processo é descartada sem persistir
    persistAndamentos.mockClear();
    act(() => { result.current.setAndamentoConfirm({ all: [], novos: [], meta: {}, processoId: 'p9' }); });
    await act(async () => { await result.current.confirmAndamentos(); });
    expect(persistAndamentos).not.toHaveBeenCalled();
    expect(result.current.andamentoConfirm).toBeNull();
  });
});
