// useUserPermissions: overrides por usuário (upsert) e redefinição que exige apagar
// todos os overrides carregados (RLS silenciosa → toast, estado intocado).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { enfileirar, chamadasCom, resetSupabaseMock } from '../helpers/supabaseMock';

vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabase } = await import('../helpers/supabaseMock');
  return { supabase: mockSupabase };
});
const auth = { user: { id: 'u1', office_id: 'o1' } as { id: string; office_id: string | null } | null };
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }));

import { useUserPermissions, useMyPermissionOverrides } from '@/hooks/useUserPermissions';

describe('useUserPermissions', () => {
  beforeEach(() => { resetSupabaseMock(); mockToast.mockClear(); auth.user = { id: 'u1', office_id: 'o1' }; });

  it('carrega os overrides do alvo e setPermission faz upsert por chave', async () => {
    enfileirar('user_permissions', { data: [{ permission_key: 'canViewMetas', granted: false }] });
    const { result } = renderHook(() => useUserPermissions('u2'));
    await waitFor(() => expect(result.current.overrides).toHaveLength(1));
    const sel = chamadasCom('user_permissions', 'select')[0];
    expect(sel.ops).toEqual(expect.arrayContaining([['eq', ['office_id', 'o1']], ['eq', ['user_id', 'u2']]]));

    let ok = false;
    await act(async () => { ok = await result.current.setPermission('canViewMetas', true); });
    expect(ok).toBe(true);
    const up = chamadasCom('user_permissions', 'upsert')[0];
    expect(up.ops[0][1][0]).toMatchObject({ office_id: 'o1', user_id: 'u2', permission_key: 'canViewMetas', granted: true });
    expect(up.ops[0][1][1]).toEqual({ onConflict: 'office_id,user_id,permission_key' });
    // substitui, não duplica
    expect(result.current.overrides).toEqual([{ permission_key: 'canViewMetas', granted: true }]);
  });

  it('erro no upsert → toast destrutivo e estado intocado', async () => {
    enfileirar('user_permissions', { data: [] });
    const { result } = renderHook(() => useUserPermissions('u2'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    enfileirar('user_permissions', { error: { message: 'boom' } });
    let ok = true;
    await act(async () => { ok = await result.current.setPermission('canViewCRM', false); });
    expect(ok).toBe(false);
    expect(result.current.overrides).toEqual([]);
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
  });

  it('resetAll: sem overrides não consulta; com overrides exige apagar todos', async () => {
    enfileirar('user_permissions', { data: [] });
    const { result } = renderHook(() => useUserPermissions('u2'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    let ok = false;
    await act(async () => { ok = await result.current.resetAll(); });
    expect(ok).toBe(true);
    expect(chamadasCom('user_permissions', 'delete')).toHaveLength(0);

    resetSupabaseMock();
    enfileirar('user_permissions', { data: [{ permission_key: 'a', granted: true }, { permission_key: 'b', granted: false }] });
    const { result: r2 } = renderHook(() => useUserPermissions('u3'));
    await waitFor(() => expect(r2.current.overrides).toHaveLength(2));
    // RLS barrou um dos dois (1 linha em vez de 2)
    enfileirar('user_permissions', { data: [{ permission_key: 'a' }] });
    await act(async () => { ok = await r2.current.resetAll(); });
    expect(ok).toBe(false);
    expect(r2.current.overrides).toHaveLength(2);
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Não foi possível redefinir as permissões' }));

    enfileirar('user_permissions', { data: [{ permission_key: 'a' }, { permission_key: 'b' }] });
    await act(async () => { ok = await r2.current.resetAll(); });
    expect(ok).toBe(true);
    expect(r2.current.overrides).toEqual([]);
  });

  it('sem alvo ou sem escritório não consulta e as mutations devolvem false', async () => {
    const { result } = renderHook(() => useUserPermissions(null));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(chamadasCom('user_permissions', 'select')).toHaveLength(0);
    let ok = true;
    await act(async () => { ok = await result.current.setPermission('x', true); });
    expect(ok).toBe(false);
    await act(async () => { ok = await result.current.resetAll(); });
    expect(ok).toBe(false);
  });
});

describe('useMyPermissionOverrides', () => {
  beforeEach(() => { resetSupabaseMock(); auth.user = { id: 'u1', office_id: 'o1' }; });

  it('vira mapa chave→granted do próprio usuário', async () => {
    enfileirar('user_permissions', { data: [{ permission_key: 'canViewMetas', granted: false }, { permission_key: 'canViewCRM', granted: true }] });
    const { result } = renderHook(() => useMyPermissionOverrides());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.overrides).toEqual({ canViewMetas: false, canViewCRM: true });
    const sel = chamadasCom('user_permissions', 'select')[0];
    expect(sel.ops).toEqual(expect.arrayContaining([['eq', ['user_id', 'u1']]]));
  });

  it('sem escritório marca loaded com mapa vazio sem consultar', async () => {
    auth.user = { id: 'u1', office_id: null };
    const { result } = renderHook(() => useMyPermissionOverrides());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.overrides).toEqual({});
    expect(chamadasCom('user_permissions', 'select')).toHaveLength(0);
  });
});
