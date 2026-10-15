// Parte 26, achado nº 3: as últimas mutations que ainda não conferiam linhas
// afetadas. A RLS barrando um UPDATE/DELETE não devolve erro — só 0 linhas —
// e cada uma destas mostrava "sucesso" com o banco intocado.
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
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', office_id: 'o1' }, isSuperAdmin: true }),
}));
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }));

import { useSubtarefas } from '@/hooks/useSubtarefas';
import { useTarefaComentarios } from '@/hooks/useTarefaComentarios';
import { useProcessoShareManager } from '@/hooks/useProcessShares';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useSuperAdminOffices } from '@/hooks/useSuperAdminOffices';

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
};
const negado = expect.objectContaining({ variant: 'destructive', description: PERMISSAO_NEGADA });

describe('mutations residuais — RLS barrando em silêncio vira erro visível', () => {
  beforeEach(() => { resetSupabaseMock(); mockToast.mockClear(); });

  it('subtarefa: concluir barrado → toast de erro, com .select no update', async () => {
    const { result } = renderHook(() => useSubtarefas('t1'), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    enfileirar('tarefa_subtarefas', { data: [] });
    await act(async () => { await result.current.toggle.mutateAsync({ id: 's1', concluida: true }).catch(() => undefined); });
    expect(mockToast).toHaveBeenCalledWith(negado);
    const upd = chamadasCom('tarefa_subtarefas', 'update').at(-1)!;
    expect(upd.ops.some(([m]) => m === 'select')).toBe(true);
  });

  it('subtarefa: excluir barrado → toast "Erro ao excluir"', async () => {
    const { result } = renderHook(() => useSubtarefas('t1'), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    enfileirar('tarefa_subtarefas', { data: [] });
    await act(async () => { await result.current.remove.mutateAsync('s1').catch(() => undefined); });
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Erro ao excluir', description: PERMISSAO_NEGADA }));
  });

  it('comentário: excluir barrado → toast de erro; permitido → sem toast de erro', async () => {
    const { result } = renderHook(() => useTarefaComentarios('t1'), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    enfileirar('tarefa_comentarios', { data: [] });
    await act(async () => { await result.current.remove.mutateAsync('c1').catch(() => undefined); });
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Erro ao excluir', description: PERMISSAO_NEGADA }));

    mockToast.mockClear();
    enfileirar('tarefa_comentarios', { data: [{ id: 'c1' }] });
    await act(async () => { await result.current.remove.mutateAsync('c1'); });
    expect(mockToast).not.toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
  });

  it('compartilhamento: revogar barrado → "Erro ao remover", nunca "Compartilhamento removido"', async () => {
    const { result } = renderHook(() => useProcessoShareManager('p1'), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    enfileirar('process_shares', { data: [] });
    await act(async () => { await result.current.revokeShare('sh1').catch(() => undefined); });
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Erro ao remover', description: PERMISSAO_NEGADA }));
    expect(mockToast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Compartilhamento removido' }));
  });

  it('permissões: redefinir com 2 overrides e a RLS deixando apagar só 1 → falha e mantém o estado', async () => {
    enfileirar('user_permissions', { data: [{ permission_key: 'canViewFinanceiro', granted: true }, { permission_key: 'canManageProcessos', granted: false }] });
    const { result } = renderHook(() => useUserPermissions('alvo'), { wrapper });
    await waitFor(() => expect(result.current.overrides).toHaveLength(2));

    enfileirar('user_permissions', { data: [{ permission_key: 'canViewFinanceiro' }] });
    let ok: boolean | undefined;
    await act(async () => { ok = await result.current.resetAll(); });
    expect(ok).toBe(false);
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Não foi possível redefinir as permissões', description: PERMISSAO_NEGADA }));
    expect(result.current.overrides).toHaveLength(2);
  });

  it('permissões: sem overrides não há o que apagar → true sem chamar delete', async () => {
    const { result } = renderHook(() => useUserPermissions('alvo'), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    let ok: boolean | undefined;
    await act(async () => { ok = await result.current.resetAll(); });
    expect(ok).toBe(true);
    expect(chamadasCom('user_permissions', 'delete')).toHaveLength(0);
  });

  it('super admin: suspender escritório barrado → "Erro", nunca "Acesso Suspenso"', async () => {
    const { result } = renderHook(() => useSuperAdminOffices(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    enfileirar('offices', { data: [] });
    let ok: boolean | undefined;
    await act(async () => { ok = await result.current.updateOfficeStatus('o9', false); });
    expect(ok).toBe(false);
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Erro', description: PERMISSAO_NEGADA }));
    expect(mockToast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Acesso Suspenso' }));
  });

  it('super admin: sincronizar dados barrado → "Erro ao salvar"', async () => {
    const { result } = renderHook(() => useSuperAdminOffices(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    enfileirar('offices', { data: [] });
    let ok: boolean | undefined;
    await act(async () => { ok = await result.current.updateOfficeFull('o9', { office_name: 'Novo nome' }); });
    expect(ok).toBe(false);
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Erro ao salvar', description: PERMISSAO_NEGADA }));
    expect(mockToast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Dados Sincronizados' }));
  });
});
