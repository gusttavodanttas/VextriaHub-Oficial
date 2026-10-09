// useOfficeUsers: membros ativos enriquecidos com perfil, erro de carga e
// remoção que exige linha afetada (RLS silenciosa).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { enfileirar, chamadasCom, resetSupabaseMock } from '../helpers/supabaseMock';
import { PERMISSAO_NEGADA } from '@/lib/errors';

vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabase } = await import('../helpers/supabaseMock');
  return { supabase: mockSupabase };
});
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ office: { id: 'o1' }, user: { id: 'u1' } }) }));

import { useOfficeUsers } from '@/hooks/useOfficeUsers';

describe('useOfficeUsers', () => {
  beforeEach(() => { resetSupabaseMock(); vi.spyOn(console, 'error').mockImplementation(() => undefined); });

  it('lista só membros ativos do escritório e junta o perfil em lote', async () => {
    enfileirar('office_users', { data: [{ id: 'ou1', user_id: 'u1', role: 'admin' }, { id: 'ou2', user_id: 'u2', role: 'user' }] });
    enfileirar('profiles', { data: [{ user_id: 'u2', full_name: 'Bia', email: 'b@x' }] });
    const { result } = renderHook(() => useOfficeUsers());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.users.map(u => u.profile?.full_name ?? null)).toEqual([null, 'Bia']);
    const sel = chamadasCom('office_users', 'select')[0];
    expect(sel.ops).toEqual(expect.arrayContaining([['eq', ['office_id', 'o1']], ['eq', ['active', true]]]));
    expect(chamadasCom('profiles', 'select')[0].ops).toContainEqual(['in', ['user_id', ['u1', 'u2']]]);
  });

  it('erro de carga é exposto e a lista fica vazia', async () => {
    enfileirar('office_users', { error: { message: 'boom' } });
    const { result } = renderHook(() => useOfficeUsers());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Erro ao carregar usuários do escritório');
    expect(result.current.isEmpty).toBe(true);
  });

  it('removeUser barrado pela RLS devolve false, expõe a mensagem e mantém o membro', async () => {
    enfileirar('office_users', { data: [{ id: 'ou2', user_id: 'u2' }] });
    enfileirar('profiles', { data: [] });
    const { result } = renderHook(() => useOfficeUsers());
    await waitFor(() => expect(result.current.loading).toBe(false));
    enfileirar('office_users', { data: [] });
    let ok: boolean | undefined;
    await act(async () => { ok = await result.current.removeUser('ou2'); });
    expect(ok).toBe(false);
    expect(result.current.error).toBe(PERMISSAO_NEGADA);
    expect(result.current.users).toHaveLength(1);
    const upd = chamadasCom('office_users', 'update').at(-1)!;
    expect(upd.ops).toEqual(expect.arrayContaining([['update', [{ active: false }]], ['eq', ['id', 'ou2']]]));
    expect(upd.ops.some(([m]) => m === 'select')).toBe(true);
  });
});
