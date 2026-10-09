// Hooks de Publicações: lista paginada no servidor (de-dup por página), stats e
// mutations conferidas.
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
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', office_id: 'o1' }, profile: null }) }));
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }));

import { usePublicacoesLista, usePublicacoes } from '@/hooks/usePublicacoes';

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
};
const pub = (over: Record<string, unknown> = {}) => ({ id: 'pb1', numero_processo: '0001', data_publicacao: '2026-10-08', conteudo: 'Intimação para audiência de instrução marcada', status: 'nova', urgencia: 'media', office_id: 'o1', ...over });
const params = { page: 2, pageSize: 20, status: 'todas', urgencia: 'todas', vinculo: 'todos', search: '' } as never;

describe('usePublicacoesLista', () => {
  beforeEach(() => { resetSupabaseMock(); mockToast.mockClear(); });

  it('pagina no servidor (range da página 2) e usa o total do count', async () => {
    enfileirar('publicacoes', { data: [pub(), pub({ id: 'pb2', numero_processo: '0002', conteudo: 'Sentença publicada' })], count: 57 });
    const { result } = renderHook(() => usePublicacoesLista(params), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toHaveLength(2);
    expect(result.current.total).toBe(57);
    const sel = chamadasCom('publicacoes', 'select')[0];
    expect(sel.ops).toEqual(expect.arrayContaining([['range', [20, 39]]]));
  });

  it('de-dup dentro da página por CNJ+data+início do conteúdo', async () => {
    enfileirar('publicacoes', { data: [pub(), pub({ id: 'pb-dup' })], count: 2 });
    const { result } = renderHook(() => usePublicacoesLista(params), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toHaveLength(1);
  });

  it('erro na busca é exposto', async () => {
    enfileirar('publicacoes', { error: { message: 'falhou' } });
    const { result } = renderHook(() => usePublicacoesLista(params), { wrapper });
    await waitFor(() => expect(result.current.error).toBeTruthy());
  });
});

describe('usePublicacoes — mutations', () => {
  beforeEach(() => { resetSupabaseMock(); mockToast.mockClear(); });

  it('atualizar status barrado pela RLS → false + toast; permitido → true', async () => {
    const { result } = renderHook(() => usePublicacoes(), { wrapper });
    enfileirar('publicacoes', { data: [] });
    let ok: boolean | undefined;
    await act(async () => { ok = await result.current.updateStatus('pb1', 'lida'); });
    expect(ok).toBe(false);
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Erro ao atualizar status', description: PERMISSAO_NEGADA }));

    enfileirar('publicacoes', { data: [{ id: 'pb1' }] });
    await act(async () => { ok = await result.current.updateStatus('pb1', 'lida'); });
    expect(ok).toBe(true);
  });

  it('atualizar em lote faz UMA query .in() e falha se a RLS deixar passar menos linhas', async () => {
    const { result } = renderHook(() => usePublicacoes(), { wrapper });
    enfileirar('publicacoes', { data: [{ id: 'pb1' }] });
    let ok: boolean | undefined;
    await act(async () => { ok = await result.current.bulkUpdateStatus(['pb1', 'pb2', 'pb3'], 'arquivada'); });
    expect(ok).toBe(false);
    expect(chamadasCom('publicacoes', 'update')).toHaveLength(1);
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Erro ao atualizar', description: PERMISSAO_NEGADA }));
  });

  it('arquivar grava status=arquivada e avisa', async () => {
    const { result } = renderHook(() => usePublicacoes(), { wrapper });
    enfileirar('publicacoes', { data: [{ id: 'pb1' }] });
    let ok: boolean | undefined;
    await act(async () => { ok = await result.current.deletePublication('pb1'); });
    expect(ok).toBe(true);
    const upd = chamadasCom('publicacoes', 'update').at(-1)!;
    expect(upd.ops.find(([m]) => m === 'update')![1][0]).toEqual({ status: 'arquivada' });
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Publicação arquivada' }));
  });
});
