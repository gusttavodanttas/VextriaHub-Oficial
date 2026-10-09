// Hook de Audiências: lista mapeada, erro visível e mutations conferidas.
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

import { useAudiencias } from '@/hooks/useAudiencias';

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
};

describe('useAudiencias', () => {
  beforeEach(() => { resetSupabaseMock(); mockToast.mockClear(); });

  it('mapeia cliente_nome, responsavel_id e avisos_dias (bug v11: editar zerava os dois últimos)', async () => {
    enfileirar('audiencias', { data: [{
      id: 'a1', titulo: 'Instrução', tipo: 'instrucao', data_audiencia: '2026-10-20T14:00:00Z', local: 'Fórum',
      status: 'agendada', observacoes: null, cliente_id: 'c1', processo_id: null,
      clientes: { nome: 'Maria' }, responsavel_id: 'u9', avisos_dias: [1, 3],
    }] });
    const { result } = renderHook(() => useAudiencias(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.audiencias[0]).toMatchObject({ cliente_nome: 'Maria', responsavel_id: 'u9', avisos_dias: [1, 3] });
    const sel = chamadasCom('audiencias', 'select')[0];
    expect(sel.ops).toEqual(expect.arrayContaining([['eq', ['office_id', 'o1']], ['eq', ['deletado', false]], ['limit', [1000]]]));
  });

  it('erro na busca expõe isError/error', async () => {
    enfileirar('audiencias', { error: { message: 'falhou' } });
    const { result } = renderHook(() => useAudiencias(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.audiencias).toEqual([]);
  });

  it('criar grava office_id, user_id e deletado=false', async () => {
    enfileirar('audiencias', { data: [] });
    const { result } = renderHook(() => useAudiencias(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => { await result.current.create.mutateAsync({ titulo: 'Conciliação', tipo: 'conciliacao', data_audiencia: '2026-11-01T10:00:00Z' } as never); });
    const ins = chamadasCom('audiencias', 'insert').at(-1)!;
    const payload = ins.ops.find(([m]) => m === 'insert')![1][0] as Array<Record<string, unknown>>;
    expect(payload[0]).toMatchObject({ office_id: 'o1', user_id: 'u1', deletado: false, titulo: 'Conciliação' });
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Audiência criada' }));
  });

  it('atualizar status e excluir em lote barrados pela RLS → erro, nunca sucesso', async () => {
    enfileirar('audiencias', { data: [] });
    const { result } = renderHook(() => useAudiencias(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    enfileirar('audiencias', { data: [] });
    await act(async () => { await result.current.updateStatus.mutateAsync({ id: 'a1', status: 'realizada' }).catch(() => undefined); });
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Erro', description: PERMISSAO_NEGADA }));

    enfileirar('audiencias', { data: [{ id: 'a1' }] }); // pediu 2, RLS deixou 1
    await act(async () => { await result.current.remove.mutateAsync(['a1', 'a2']).catch(() => undefined); });
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Erro ao excluir', description: PERMISSAO_NEGADA }));
    expect(mockToast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Audiência(s) excluída(s)' }));
  });
});
