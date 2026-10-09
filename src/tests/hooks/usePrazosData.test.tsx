// Hook de Prazos: ativos/concluídos separados, soft-delete filtrado em JS,
// erro visível e mutations conferidas.
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
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', office_id: 'o1' } }) }));
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }));

import { usePrazosData } from '@/hooks/usePrazosData';

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
};
const prazo = (over: Record<string, unknown> = {}) => ({ id: 'pz1', titulo: 'Contestação', status: 'pendente', data_fim_prazo: '2026-10-20', office_id: 'o1', deletado: false, publicacao_id: null, numero_processo: null, ...over });

describe('usePrazosData', () => {
  beforeEach(() => { resetSupabaseMock(); mockToast.mockClear(); });

  it('ativos: consulta por office_id, exclui concluídos e filtra deletados em JS', async () => {
    enfileirar('prazos', { data: [prazo(), prazo({ id: 'pz2', deletado: true })] });
    const { result } = renderHook(() => usePrazosData({}), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.prazos.map(p => p.id)).toEqual(['pz1']);
    const sel = chamadasCom('prazos', 'select')[0];
    expect(sel.ops).toEqual(expect.arrayContaining([['or', ['status.is.null,status.neq.concluido']], ['eq', ['office_id', 'o1']]]));
  });

  it('concluídos só são buscados com showConcluidos (cap 500)', async () => {
    enfileirar('prazos', { data: [prazo()] });
    enfileirar('prazos', { data: [prazo({ id: 'pz9', status: 'concluido' })] });
    const { result } = renderHook(() => usePrazosData({ showConcluidos: true }), { wrapper });
    await waitFor(() => expect(result.current.prazos.length).toBe(2));
    const sels = chamadasCom('prazos', 'select');
    expect(sels.some(s => s.ops.some(([m, a]) => m === 'eq' && a[0] === 'status' && a[1] === 'concluido') && s.ops.some(([m, a]) => m === 'limit' && a[0] === 500))).toBe(true);
  });

  it('erro na busca dos ativos expõe isError', async () => {
    enfileirar('prazos', { error: { message: 'falhou' } });
    const { result } = renderHook(() => usePrazosData({}), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('aceitar sugestão do robô barrada pela RLS → "Não foi possível aceitar"', async () => {
    enfileirar('prazos', { data: [] });
    const { result } = renderHook(() => usePrazosData({}), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    enfileirar('prazos', { data: [] });
    await act(async () => { await result.current.aceitarMutation.mutateAsync('pz1').catch(() => undefined); });
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Não foi possível aceitar', description: PERMISSAO_NEGADA }));
  });

  it('excluir em lote com parte bloqueada → "Erro ao excluir", nunca "Prazos excluídos"', async () => {
    enfileirar('prazos', { data: [] });
    const onBulkDeleted = vi.fn();
    const { result } = renderHook(() => usePrazosData({ onBulkDeleted }), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    enfileirar('prazos', { data: [{ id: 'pz1' }] });
    await act(async () => { await result.current.bulkDeleteMutation.mutateAsync(['pz1', 'pz2']).catch(() => undefined); });
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Erro ao excluir', description: PERMISSAO_NEGADA }));
    expect(onBulkDeleted).not.toHaveBeenCalled();
  });

  it('reabrir com sucesso volta para pendente e avisa', async () => {
    enfileirar('prazos', { data: [] });
    const { result } = renderHook(() => usePrazosData({}), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    enfileirar('prazos', { data: [{ id: 'pz1' }] });
    await act(async () => { await result.current.reopenMutation.mutateAsync('pz1'); });
    const upd = chamadasCom('prazos', 'update').at(-1)!;
    expect(upd.ops.find(([m]) => m === 'update')![1][0]).toMatchObject({ status: 'pendente', concluido_em: null });
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Prazo reaberto' }));
  });
});
