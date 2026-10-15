// useProcessShares / useProcessoShareManager: mapa de compartilhamentos recebidos,
// compartilhar por e-mail via RPC e revogar com checagem de linhas (RLS).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { enfileirar, chamadasCom, resetSupabaseMock, mockSupabase } from '../helpers/supabaseMock';
import { wrapper } from './_setup';

vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabase } = await import('../helpers/supabaseMock');
  return { supabase: mockSupabase };
});
const auth = { user: { id: 'u1', office_id: 'o1' } as { id: string; office_id: string | null } };
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }));

import { useProcessShares, useProcessoShareManager } from '@/hooks/useProcessShares';

const row = (over: Record<string, unknown> = {}) => ({
  id: 's1', processo_id: 'p1', owner_office_id: 'o9', shared_office_id: 'o1',
  owner_office_name: 'Parceiro', shared_office_name: 'Dantas', permission: 'ver', created_at: '2026-10-01', ...over,
});

describe('useProcessShares', () => {
  beforeEach(() => { resetSupabaseMock(); mockToast.mockClear(); auth.user = { id: 'u1', office_id: 'o1' }; });

  it('indexa por processo_id com nome do dono e permissão normalizada', async () => {
    enfileirar('process_shares', { data: [row(), row({ id: 's2', processo_id: 'p2', owner_office_name: null, permission: 'editar' })] });
    const { result } = renderHook(() => useProcessShares(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.sharedInMap.get('p1')).toEqual({ shareId: 's1', ownerOfficeName: 'Parceiro', permission: 'ver' });
    expect(result.current.sharedInMap.get('p2')).toEqual({ shareId: 's2', ownerOfficeName: 'Escritório parceiro', permission: 'editar' });
    const sel = chamadasCom('process_shares', 'select')[0];
    expect(sel.ops).toEqual(expect.arrayContaining([['eq', ['shared_office_id', 'o1']]]));
  });

  it('sem escritório não consulta', async () => {
    auth.user = { id: 'u1', office_id: null };
    const { result } = renderHook(() => useProcessShares(), { wrapper });
    expect(result.current.sharedInMap.size).toBe(0);
    expect(chamadasCom('process_shares', 'select')).toHaveLength(0);
  });
});

describe('useProcessoShareManager', () => {
  beforeEach(() => { resetSupabaseMock(); mockToast.mockClear(); mockSupabase.rpc.mockReset(); });

  it('lista os compartilhamentos do processo em ordem de criação', async () => {
    enfileirar('process_shares', { data: [row()] });
    const { result } = renderHook(() => useProcessoShareManager('p1'), { wrapper });
    await waitFor(() => expect(result.current.shares).toHaveLength(1));
    const sel = chamadasCom('process_shares', 'select')[0];
    expect(sel.ops).toEqual(expect.arrayContaining([['eq', ['processo_id', 'p1']], ['order', ['created_at', { ascending: true }]]]));
  });

  it('shareByEmail chama a RPC com e-mail limpo e informa o escritório parceiro', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: { ok: true, office_name: 'Silva Adv', permission: 'editar' }, error: null });
    const { result } = renderHook(() => useProcessoShareManager('p1'), { wrapper });
    await act(async () => { await result.current.shareByEmail('  x@silva.adv ', 'editar'); });
    expect(mockSupabase.rpc).toHaveBeenCalledWith('share_processo_with_office', {
      p_processo_id: 'p1', p_email: 'x@silva.adv', p_permission: 'editar',
    });
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Processo compartilhado', description: 'Silva Adv agora pode ver e editar este processo.',
    }));
  });

  it('erro da RPC vira toast destrutivo e rejeita a promise', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: { message: 'E-mail não cadastrado' } });
    const { result } = renderHook(() => useProcessoShareManager('p1'), { wrapper });
    await act(async () => {
      await expect(result.current.shareByEmail('a@b.c', 'ver')).rejects.toBeTruthy();
    });
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Não foi possível compartilhar', description: 'E-mail não cadastrado', variant: 'destructive',
    }));
  });

  it('revokeShare: RLS barrando (0 linhas) → toast de erro, não diz "removido"', async () => {
    enfileirar('process_shares', { data: [row()] });
    const { result } = renderHook(() => useProcessoShareManager('p1'), { wrapper });
    await waitFor(() => expect(result.current.shares).toHaveLength(1));
    enfileirar('process_shares', { data: [] });
    await act(async () => {
      await expect(result.current.revokeShare('s1')).rejects.toBeTruthy();
    });
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Erro ao remover', variant: 'destructive' }));

    mockToast.mockClear();
    enfileirar('process_shares', { data: [{ id: 's1' }] });
    await act(async () => { await result.current.revokeShare('s1'); });
    const del = chamadasCom('process_shares', 'delete')[1];
    expect(del.ops).toEqual(expect.arrayContaining([['eq', ['id', 's1']], ['select', ['id']]]));
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Compartilhamento removido' }));
  });
});
