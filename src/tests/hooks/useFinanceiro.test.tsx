// Hook de dados do Financeiro: lista, erro visível e mutations conferidas.
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

import { useFinanceiro } from '@/hooks/useFinanceiro';

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
};
const item = (over: Record<string, unknown> = {}) => ({
  id: 'f1', office_id: 'o1', tipo: 'receita', descricao: 'Honorários', valor: 1000, valor_pago: 0,
  status: 'pendente', data_vencimento: '2026-10-20', deletado: false, grupo_id: null, ...over,
});

describe('useFinanceiro', () => {
  beforeEach(() => { resetSupabaseMock(); mockToast.mockClear(); });

  it('lista os lançamentos do escritório (filtra deletado=false e office_id)', async () => {
    enfileirar('financeiro', { data: [item(), item({ id: 'f2' })] });
    const { result } = renderHook(() => useFinanceiro('o1'), { wrapper });
    await waitFor(() => expect(result.current.query.isLoading).toBe(false));
    expect(result.current.query.data).toHaveLength(2);
    const sel = chamadasCom('financeiro', 'select')[0];
    expect(sel.ops).toEqual(expect.arrayContaining([['eq', ['office_id', 'o1']], ['eq', ['deletado', false]]]));
  });

  it('sem officeId não consulta nada', async () => {
    const { result } = renderHook(() => useFinanceiro(null), { wrapper });
    expect(result.current.query.isLoading).toBe(false);
    expect(chamadasCom('financeiro', 'select')).toHaveLength(0);
  });

  it('erro na busca é exposto em query.error (não vira lista vazia)', async () => {
    enfileirar('financeiro', { error: { message: 'RLS/rede' } });
    const { result } = renderHook(() => useFinanceiro('o1'), { wrapper });
    await waitFor(() => expect(result.current.query.isError).toBe(true));
    expect(result.current.query.data).toBeUndefined();
  });

  it('registrar pagamento total marca como pago; parcial mantém saldo', async () => {
    enfileirar('financeiro', { data: [] });
    const { result } = renderHook(() => useFinanceiro('o1'), { wrapper });
    await waitFor(() => expect(result.current.query.isLoading).toBe(false));

    enfileirar('financeiro', { data: [{ id: 'f1' }] });
    await act(async () => { await result.current.registrarPagamento.mutateAsync({ item: item() as never, valor: 1000 }); });
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Marcado como pago!' }));
    let upd = chamadasCom('financeiro', 'update').at(-1)!;
    expect(upd.ops.find(([m]) => m === 'update')![1][0]).toMatchObject({ status: 'pago', valor_pago: 1000 });

    enfileirar('financeiro', { data: [{ id: 'f1' }] });
    await act(async () => { await result.current.registrarPagamento.mutateAsync({ item: item() as never, valor: 400 }); });
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Pagamento parcial registrado!' }));
    upd = chamadasCom('financeiro', 'update').at(-1)!;
    expect(upd.ops.find(([m]) => m === 'update')![1][0]).toMatchObject({ status: 'parcial', valor_pago: 400 });
  });

  it('update/remove barrados pela RLS (0 linhas) → toast de erro, nunca "atualizado"/"excluído"', async () => {
    enfileirar('financeiro', { data: [] });
    const { result } = renderHook(() => useFinanceiro('o1'), { wrapper });
    await waitFor(() => expect(result.current.query.isLoading).toBe(false));

    enfileirar('financeiro', { data: [] });
    await act(async () => { await result.current.update.mutateAsync({ id: 'f1', valor: 5 }).catch(() => undefined); });
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Erro ao atualizar', description: PERMISSAO_NEGADA }));

    enfileirar('financeiro', { data: [] });
    await act(async () => { await result.current.remove.mutateAsync('f1').catch(() => undefined); });
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Erro ao excluir', description: PERMISSAO_NEGADA }));
    expect(mockToast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Registro excluído!' }));
  });

  it('cancelar grupo: contagem falha → erro (não aceita 0 linhas como sucesso); contagem 2 e update de 1 → erro', async () => {
    enfileirar('financeiro', { data: [] });
    const { result } = renderHook(() => useFinanceiro('o1'), { wrapper });
    await waitFor(() => expect(result.current.query.isLoading).toBe(false));

    enfileirar('financeiro', { error: { message: 'count falhou' } });
    await act(async () => { await result.current.cancelarGrupo.mutateAsync('g1').catch(() => undefined); });
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Erro', description: 'count falhou' }));

    enfileirar('financeiro', { count: 2 });
    enfileirar('financeiro', { data: [{ id: 'f1' }] });
    await act(async () => { await result.current.cancelarGrupo.mutateAsync('g1').catch(() => undefined); });
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Erro', description: PERMISSAO_NEGADA }));
    expect(mockToast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Lançamentos futuros cancelados.' }));
  });
});
