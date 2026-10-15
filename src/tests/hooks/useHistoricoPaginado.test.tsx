// Paginação incremental do histórico: primeira página com contagem, "carregar
// mais" acumula, e nunca pede página além do total.
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useHistoricoPaginado } from '@/hooks/useHistoricoPaginado';

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
};

describe('useHistoricoPaginado', () => {
  it('carrega por páginas, expõe restantes e para no total', async () => {
    const todos = [1, 2, 3, 4, 5];
    const fetchPage = vi.fn(async (from: number, to: number) => ({ rows: todos.slice(from, to + 1), total: todos.length }));
    const { result } = renderHook(() => useHistoricoPaginado<number>({ queryKey: ['h'], enabled: true, fetchPage, pageSize: 2 }), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.rows).toEqual([1, 2]);
    expect(result.current.total).toBe(5);
    expect(result.current.restantes).toBe(3);
    expect(result.current.temMais).toBe(true);

    act(() => result.current.carregarMais());
    await waitFor(() => expect(result.current.rows).toEqual([1, 2, 3, 4]));
    act(() => result.current.carregarMais());
    await waitFor(() => expect(result.current.rows).toEqual([1, 2, 3, 4, 5]));
    expect(result.current.restantes).toBe(0);
    expect(result.current.temMais).toBe(false);

    // Com tudo carregado, carregarMais é no-op
    act(() => result.current.carregarMais());
    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(fetchPage.mock.calls.map(([f, t]) => [f, t])).toEqual([[0, 1], [2, 3], [4, 5]]);
  });

  it('página vazia encerra mesmo que a contagem diga que há mais (linha sumiu entre páginas)', async () => {
    const fetchPage = vi.fn(async (from: number) => (from === 0 ? { rows: ['a'], total: 3 } : { rows: [], total: 3 }));
    const { result } = renderHook(() => useHistoricoPaginado<string>({ queryKey: ['h2'], enabled: true, fetchPage, pageSize: 1 }), { wrapper });
    await waitFor(() => expect(result.current.temMais).toBe(true));
    act(() => result.current.carregarMais());
    await waitFor(() => expect(result.current.temMais).toBe(false));
    expect(result.current.rows).toEqual(['a']);
  });

  it('erro na busca vira isError', async () => {
    const fetchPage = vi.fn(async () => { throw new Error('falhou'); });
    const { result } = renderHook(() => useHistoricoPaginado<number>({ queryKey: ['h3'], enabled: true, fetchPage }), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.rows).toEqual([]);
    expect(result.current.restantes).toBe(0);
  });
});
