// useOfficeManagement: escopo da listagem por papel, criação/desativação só para
// super admin, atualização e estatísticas do escritório.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { enfileirar, chamadasCom, resetSupabaseMock } from '../helpers/supabaseMock';

vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabase } = await import('../helpers/supabaseMock');
  return { supabase: mockSupabase };
});
const auth = { isSuperAdmin: false, user: { id: 'u1' } as { id: string } | null };
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));

import { useOfficeManagement } from '@/hooks/useOfficeManagement';

const office = (over: Record<string, unknown> = {}) => ({ id: 'o1', name: 'Dantas', active: true, created_at: '2026-01-01', ...over });

describe('useOfficeManagement', () => {
  beforeEach(() => { resetSupabaseMock(); auth.isSuperAdmin = false; auth.user = { id: 'u1' }; vi.restoreAllMocks(); });

  it('usuário comum: só o próprio escritório ativo, pelo vínculo em office_users', async () => {
    enfileirar('offices', { data: [office()] });
    const { result } = renderHook(() => useOfficeManagement());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.offices).toHaveLength(1);
    expect(result.current.canCreateOffices).toBe(false);
    const sel = chamadasCom('offices', 'select')[0];
    expect(sel.ops).toEqual(expect.arrayContaining([
      ['eq', ['office_users.user_id', 'u1']], ['eq', ['office_users.active', true]], ['eq', ['active', true]],
      ['order', ['created_at', { ascending: false }]],
    ]));
  });

  it('super admin lista todos sem filtro; erro vira `error`', async () => {
    auth.isSuperAdmin = true;
    enfileirar('offices', { data: [office(), office({ id: 'o2', active: false })] });
    const { result } = renderHook(() => useOfficeManagement());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.offices).toHaveLength(2);
    expect(result.current.canCreateOffices).toBe(true);
    expect(chamadasCom('offices', 'select')[0].ops.some(([m]) => m === 'eq')).toBe(false);

    vi.spyOn(console, 'error').mockImplementation(() => {});
    resetSupabaseMock();
    enfileirar('offices', { error: { message: 'boom' } });
    const { result: r2 } = renderHook(() => useOfficeManagement());
    await waitFor(() => expect(r2.current.loading).toBe(false));
    expect(r2.current.error).toBe('Erro ao carregar escritórios');
    expect(r2.current.isEmpty).toBe(true);
  });

  it('createOffice/deactivateOffice: negados para quem não é super admin, sem tocar o banco', async () => {
    enfileirar('offices', { data: [office()] });
    const { result } = renderHook(() => useOfficeManagement());
    await waitFor(() => expect(result.current.loading).toBe(false));
    let criado: unknown = 'x';
    await act(async () => { criado = await result.current.createOffice({ name: 'Novo' } as never); });
    expect(criado).toBeNull();
    expect(result.current.error).toBe('Apenas super administradores podem criar escritórios');
    let ok = true;
    await act(async () => { ok = await result.current.deactivateOffice('o1'); });
    expect(ok).toBe(false);
    expect(result.current.error).toBe('Apenas super administradores podem desativar escritórios');
    expect(chamadasCom('offices', 'insert')).toHaveLength(0);
    expect(chamadasCom('offices', 'update')).toHaveLength(0);
    expect(result.current.offices).toHaveLength(1);
  });

  it('super admin cria (com created_by), atualiza e desativa; erros viram `error`', async () => {
    auth.isSuperAdmin = true;
    enfileirar('offices', { data: [office()] });
    const { result } = renderHook(() => useOfficeManagement());
    await waitFor(() => expect(result.current.loading).toBe(false));

    enfileirar('offices', { data: office({ id: 'o2', name: 'Novo' }) });
    await act(async () => { await result.current.createOffice({ name: 'Novo' } as never); });
    expect(chamadasCom('offices', 'insert')[0].ops[0]).toEqual(['insert', [{ name: 'Novo', created_by: 'u1' }]]);
    expect(result.current.offices.map((o) => o.id)).toEqual(['o2', 'o1']);

    enfileirar('offices', { data: office({ name: 'Renomeado' }) });
    await act(async () => { await result.current.updateOffice('o1', { name: 'Renomeado' } as never); });
    expect(result.current.offices.find((o) => o.id === 'o1')?.name).toBe('Renomeado');

    enfileirar('offices', { data: null });
    let ok = false;
    await act(async () => { ok = await result.current.deactivateOffice('o2'); });
    expect(ok).toBe(true);
    expect(result.current.offices.map((o) => o.id)).toEqual(['o1']);

    vi.spyOn(console, 'error').mockImplementation(() => {});
    enfileirar('offices', { error: { message: 'boom' } });
    await act(async () => { ok = await result.current.deactivateOffice('o1'); });
    expect(ok).toBe(false);
    expect(result.current.error).toBe('Erro ao desativar escritório');
    expect(result.current.offices).toHaveLength(1);

    enfileirar('offices', { error: { message: 'boom' } });
    let atualizado: unknown = 'x';
    await act(async () => { atualizado = await result.current.updateOffice('o1', { name: 'Z' } as never); });
    expect(atualizado).toBeNull();
    expect(result.current.error).toBe('Erro ao atualizar escritório');
  });

  it('getOfficeStats conta usuários por papel e lê o plano da assinatura', async () => {
    enfileirar('offices', { data: [office()] });
    const { result } = renderHook(() => useOfficeManagement());
    await waitFor(() => expect(result.current.loading).toBe(false));

    enfileirar('office_users', { data: [{ id: '1', role: 'admin' }, { id: '2', role: 'user' }, { id: '3', role: 'super_admin' }] });
    enfileirar('office_subscriptions', { data: { plan_name: 'pro', status: 'ativa' } });
    let stats: unknown;
    await act(async () => { stats = await result.current.getOfficeStats('o1'); });
    expect(stats).toEqual({ totalUsers: 3, adminUsers: 2, regularUsers: 1, currentPlan: 'pro', planStatus: 'ativa' });
    expect(chamadasCom('office_users', 'select')[0].ops).toEqual(expect.arrayContaining([['eq', ['office_id', 'o1']], ['eq', ['active', true]]]));
    expect(chamadasCom('office_subscriptions', 'select')[0].ops.some(([m]) => m === 'maybeSingle')).toBe(true);

    // sem assinatura → free/inactive
    enfileirar('office_users', { data: [] });
    enfileirar('office_subscriptions', { data: null });
    await act(async () => { stats = await result.current.getOfficeStats('o1'); });
    expect(stats).toEqual({ totalUsers: 0, adminUsers: 0, regularUsers: 0, currentPlan: 'free', planStatus: 'inactive' });
  });
});
