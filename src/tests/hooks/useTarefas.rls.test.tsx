import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { enfileirar, resetSupabaseMock } from '../helpers/supabaseMock';
import { PERMISSAO_NEGADA } from '@/lib/errors';

vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabase } = await import('../helpers/supabaseMock');
  return { supabase: mockSupabase };
});
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', office_id: 'o1' } }),
}));
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }));

import { useTarefas } from '@/hooks/useTarefas';

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
};

describe('useTarefas — mutations bloqueadas pela RLS', () => {
  beforeEach(() => { resetSupabaseMock(); mockToast.mockClear(); });

  it('concluir com 0 linhas afetadas mostra erro, não sucesso silencioso', async () => {
    const { result } = renderHook(() => useTarefas(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    enfileirar('tarefas', { data: [] }); // update barrado: 0 linhas, sem erro
    await act(async () => {
      await result.current.toggle.mutateAsync({ id: 't1', concluida: true }).catch(() => undefined);
    });

    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive', description: PERMISSAO_NEGADA }));
  });

  it('excluir em lote com parte bloqueada falha (não diz "movidas para a lixeira")', async () => {
    const { result } = renderHook(() => useTarefas(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    enfileirar('tarefas', { data: [{ id: 't1' }] }); // pediu 2, a RLS deixou 1
    await act(async () => {
      await result.current.remove.mutateAsync(['t1', 't2']).catch(() => undefined);
    });

    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Erro ao excluir', variant: 'destructive' }));
    expect(mockToast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Tarefa(s) excluída(s)' }));
  });
});
