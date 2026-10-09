// useInvitations: lista de convites, criação com disparo do e-mail, mensagem de
// permissão quando a RLS barra o insert, e cancelamento com linha afetada.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { enfileirar, chamadasCom, resetSupabaseMock, mockSupabase } from '../helpers/supabaseMock';
import { PERMISSAO_NEGADA } from '@/lib/errors';

vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabase } = await import('../helpers/supabaseMock');
  return { supabase: mockSupabase };
});
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ office: { id: 'o1' }, user: { id: 'u1' } }) }));

import { useInvitations } from '@/hooks/useInvitations';

describe('useInvitations', () => {
  beforeEach(() => { resetSupabaseMock(); mockSupabase.functions.invoke.mockClear(); vi.spyOn(console, 'error').mockImplementation(() => undefined); });

  it('lista pendentes e aceitos do escritório e separa por status', async () => {
    enfileirar('invitations', { data: [{ id: 'i1', status: 'pending', email: 'a@x' }, { id: 'i2', status: 'accepted', email: 'b@x' }] });
    const { result } = renderHook(() => useInvitations());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.pendingInvitations.map(i => i.id)).toEqual(['i1']);
    expect(result.current.acceptedInvitations.map(i => i.id)).toEqual(['i2']);
    const sel = chamadasCom('invitations', 'select')[0];
    expect(sel.ops).toEqual(expect.arrayContaining([['eq', ['office_id', 'o1']], ['in', ['status', ['pending', 'accepted']]]]));
  });

  it('createInvitation grava office_id/invited_by, adiciona à lista e dispara send-invite-email', async () => {
    enfileirar('invitations', { data: [] });
    const { result } = renderHook(() => useInvitations());
    await waitFor(() => expect(result.current.loading).toBe(false));
    enfileirar('invitations', { data: { id: 'i9', status: 'pending', email: 'novo@x' } });
    let res: unknown;
    await act(async () => { res = await result.current.createInvitation({ email: 'novo@x', role: 'user' } as any); });
    expect(res).toEqual({ data: expect.objectContaining({ id: 'i9' }) });
    expect(result.current.invitations.map(i => i.id)).toEqual(['i9']);
    const ins = chamadasCom('invitations', 'insert').at(-1)!;
    expect(ins.ops.find(([m]) => m === 'insert')![1][0]).toMatchObject({ email: 'novo@x', office_id: 'o1', invited_by: 'u1' });
    expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('send-invite-email', { body: { invitation_id: 'i9' } });
  });

  it('insert barrado pela RLS (42501) vira mensagem de permissão, não erro genérico', async () => {
    enfileirar('invitations', { data: [] });
    const { result } = renderHook(() => useInvitations());
    await waitFor(() => expect(result.current.loading).toBe(false));
    enfileirar('invitations', { error: { code: '42501', message: 'new row violates row-level security policy' } });
    let res: { error?: string } = {};
    await act(async () => { res = (await result.current.createInvitation({ email: 'x@x', role: 'user' } as any)) as { error?: string }; });
    expect(res.error).toMatch(/permissão para convidar/);
    expect(mockSupabase.functions.invoke).not.toHaveBeenCalled();
  });

  it('cancelInvitation com 0 linhas devolve false e mantém o convite', async () => {
    enfileirar('invitations', { data: [{ id: 'i1', status: 'pending' }] });
    const { result } = renderHook(() => useInvitations());
    await waitFor(() => expect(result.current.loading).toBe(false));
    enfileirar('invitations', { data: [] });
    let ok: boolean | undefined;
    await act(async () => { ok = await result.current.cancelInvitation('i1'); });
    expect(ok).toBe(false);
    expect(result.current.error).toBe(PERMISSAO_NEGADA);
    expect(result.current.invitations).toHaveLength(1);
  });
});
