// Hook de Atendimentos: ativos + histórico, erro visível, recorrência e RLS.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { enfileirar, chamadasCom, resetSupabaseMock } from '../helpers/supabaseMock';
import { PERMISSAO_NEGADA } from '@/lib/errors';

vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabase } = await import('../helpers/supabaseMock');
  return { supabase: mockSupabase };
});
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }));

import { useAtendimentos } from '@/hooks/useAtendimentos';

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
};
const at = (over: Record<string, unknown> = {}) => ({
  id: 'at1', office_id: 'o1', user_id: 'u1', tipo_atendimento: 'reuniao', data_atendimento: '2026-10-20T10:00:00',
  status: 'agendado', deletado: false, cliente_id: 'c1', processo_id: null, observacoes: null,
  recorrencia_regra: null, recorrencia_restantes: 0, ...over,
});

describe('useAtendimentos', () => {
  beforeEach(() => { resetSupabaseMock(); mockToast.mockClear(); });

  it('junta ativos e histórico (histórico paginado com contagem exata, sem cap silencioso)', async () => {
    enfileirar('atendimentos', { data: [at()] });              // ativos
    enfileirar('atendimentos', { data: [at({ id: 'at2', status: 'realizado' })], count: 350 }); // histórico, 1ª página
    const { result } = renderHook(() => useAtendimentos('o1'), { wrapper });
    await waitFor(() => expect(result.current.query.isLoading).toBe(false));
    expect(result.current.query.data.map(a => a.id).sort()).toEqual(['at1', 'at2']);
    const sels = chamadasCom('atendimentos', 'select');
    // ativos + histórico + 3 contagens (head) — nenhuma com `.limit()`
    expect(sels).toHaveLength(5);
    expect(sels.some(s => s.ops.some(([m]) => m === 'limit'))).toBe(false);
    const hist = sels.find(s => s.ops.some(([m, a]) => m === 'in' && a[0] === 'status'))!;
    expect(hist.ops).toEqual(expect.arrayContaining([['range', [0, 199]]]));
    expect(hist.ops.find(([m]) => m === 'select')![1][1]).toEqual({ count: 'exact' });
    // 350 no servidor, 1 carregado → a tela sabe que faltam 349
    expect(result.current.query.historicoRestantes).toBe(349);
  });

  it('carregar mais histórico pede a página seguinte e acumula', async () => {
    enfileirar('atendimentos', { data: [] });
    enfileirar('atendimentos', { data: [at({ id: 'h1', status: 'realizado' })], count: 2 });
    const { result } = renderHook(() => useAtendimentos('o1'), { wrapper });
    await waitFor(() => expect(result.current.query.historicoRestantes).toBe(1));
    enfileirar('atendimentos', { data: [at({ id: 'h2', status: 'cancelado' })], count: 2 });
    act(() => { result.current.query.carregarMaisHistorico(); });
    await waitFor(() => expect(result.current.query.data.map(a => a.id)).toEqual(['h1', 'h2']));
    expect(result.current.query.historicoRestantes).toBe(0);
    const ranges = chamadasCom('atendimentos', 'range').map(c => c.ops.find(([m]) => m === 'range')![1]);
    expect(ranges).toEqual([[0, 199], [200, 399]]);
  });

  it('erro em qualquer uma das duas consultas vira isError', async () => {
    enfileirar('atendimentos', { data: [] });
    enfileirar('atendimentos', { error: { message: 'histórico falhou' } });
    const { result } = renderHook(() => useAtendimentos('o1'), { wrapper });
    await waitFor(() => expect(result.current.query.isError).toBe(true));
  });

  it('marcar realizado com recorrência cria a próxima ocorrência com restantes-1', async () => {
    enfileirar('atendimentos', { data: [] }); enfileirar('atendimentos', { data: [] });
    const { result } = renderHook(() => useAtendimentos('o1'), { wrapper });
    await waitFor(() => expect(result.current.query.isLoading).toBe(false));

    enfileirar('atendimentos', { data: [{ id: 'at1' }] }); // update realizado
    enfileirar('atendimentos', { data: null });             // insert da próxima
    const item = at({ recorrencia_regra: 'semanal', recorrencia_restantes: 2, recorrencia_grupo: 'g1' });
    await act(async () => { await result.current.markRealizado.mutateAsync(item as never); });
    const ins = chamadasCom('atendimentos', 'insert').at(-1)!;
    const row = ins.ops.find(([m]) => m === 'insert')![1][0] as Record<string, unknown>;
    expect(row).toMatchObject({ status: 'agendado', recorrencia_restantes: 1, recorrencia_grupo: 'g1', office_id: 'o1' });
    expect(String(row.data_atendimento)).toMatch(/^2026-10-27T10:00:00/);
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Marcado como realizado!' }));
  });

  it('marcar realizado barrado pela RLS → erro, sem criar próxima ocorrência', async () => {
    enfileirar('atendimentos', { data: [] }); enfileirar('atendimentos', { data: [] });
    const { result } = renderHook(() => useAtendimentos('o1'), { wrapper });
    await waitFor(() => expect(result.current.query.isLoading).toBe(false));
    enfileirar('atendimentos', { data: [] });
    await act(async () => { await result.current.markRealizado.mutateAsync(at() as never).catch(() => undefined); });
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Erro', description: PERMISSAO_NEGADA }));
    expect(chamadasCom('atendimentos', 'insert')).toHaveLength(0);
  });

  it('falha ao criar a próxima ocorrência avisa "série interrompida" (não desfaz o realizado)', async () => {
    enfileirar('atendimentos', { data: [] }); enfileirar('atendimentos', { data: [] });
    const { result } = renderHook(() => useAtendimentos('o1'), { wrapper });
    await waitFor(() => expect(result.current.query.isLoading).toBe(false));
    enfileirar('atendimentos', { data: [{ id: 'at1' }] });
    enfileirar('atendimentos', { error: { message: 'cota' } });
    const item = at({ recorrencia_regra: 'semanal', recorrencia_restantes: 1 });
    await act(async () => { await result.current.markRealizado.mutateAsync(item as never); });
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Série recorrente interrompida', variant: 'destructive' }));
  });
});
