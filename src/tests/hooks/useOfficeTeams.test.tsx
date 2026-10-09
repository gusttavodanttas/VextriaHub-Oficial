// useOfficeTeams / useTeamMembers: carga com contagem de membros, erros expostos
// e mutations que dependem de linhas afetadas (RLS silenciosa).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { enfileirar, chamadasCom, resetSupabaseMock } from '../helpers/supabaseMock';

vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabase } = await import('../helpers/supabaseMock');
  return { supabase: mockSupabase };
});
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ office: { id: 'o1' }, user: { id: 'u1' } }) }));

import { useOfficeTeams, useTeamMembers } from '@/hooks/useOfficeTeams';

describe('useOfficeTeams', () => {
  beforeEach(() => resetSupabaseMock());

  it('lista as equipes do escritório com member_count', async () => {
    enfileirar('office_teams', { data: [{ id: 't1', name: 'Cível', color: '#000' }, { id: 't2', name: 'Trabalhista', color: '#fff' }] });
    enfileirar('office_team_members', { data: [{ team_id: 't1' }, { team_id: 't1' }] });
    const { result } = renderHook(() => useOfficeTeams());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.teams.map(t => [t.id, t.member_count])).toEqual([['t1', 2], ['t2', 0]]);
    expect(result.current.error).toBeNull();
    expect(chamadasCom('office_teams', 'select')[0].ops).toContainEqual(['eq', ['office_id', 'o1']]);
  });

  it('erro nas equipes vira `error`; erro só na contagem mantém a lista e avisa', async () => {
    enfileirar('office_teams', { error: { message: 'boom' } });
    const { result } = renderHook(() => useOfficeTeams());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('boom');

    resetSupabaseMock();
    enfileirar('office_teams', { data: [{ id: 't1', name: 'Cível' }] });
    enfileirar('office_team_members', { error: { message: 'contagem falhou' } });
    await act(async () => { await result.current.refetch(); });
    expect(result.current.teams).toHaveLength(1);
    expect(result.current.error).toBe('contagem falhou');
  });

  it('remove: 0 linhas (RLS) devolve false e mantém a equipe; 1 linha tira da lista', async () => {
    enfileirar('office_teams', { data: [{ id: 't1', name: 'Cível' }] });
    enfileirar('office_team_members', { data: [] });
    const { result } = renderHook(() => useOfficeTeams());
    await waitFor(() => expect(result.current.loading).toBe(false));
    enfileirar('office_teams', { data: [] });
    let ok: boolean | undefined;
    await act(async () => { ok = await result.current.remove('t1'); });
    expect(ok).toBe(false);
    expect(result.current.teams).toHaveLength(1);
    enfileirar('office_teams', { data: [{ id: 't1' }] });
    await act(async () => { ok = await result.current.remove('t1'); });
    expect(ok).toBe(true);
    expect(result.current.teams).toHaveLength(0);
  });
});

describe('useTeamMembers', () => {
  beforeEach(() => resetSupabaseMock());

  it('carrega membros com perfil e setMemberRole barrado devolve false', async () => {
    enfileirar('office_team_members', { data: [{ id: 'm1', user_id: 'u1', role: 'member' }] });
    enfileirar('profiles', { data: [{ user_id: 'u1', full_name: 'Ana', email: 'a@x' }] });
    const { result } = renderHook(() => useTeamMembers('t1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.members[0].profile?.full_name).toBe('Ana');

    enfileirar('office_team_members', { data: [] });
    let ok: boolean | undefined;
    await act(async () => { ok = await result.current.setMemberRole('u1', 'coordinator'); });
    expect(ok).toBe(false);
    expect(result.current.members[0].role).toBe('member');
    const upd = chamadasCom('office_team_members', 'update').at(-1)!;
    expect(upd.ops.some(([m]) => m === 'select')).toBe(true);
  });

  it('sem teamId não consulta nada', async () => {
    const { result } = renderHook(() => useTeamMembers(null));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(chamadasCom('office_team_members', 'select')).toHaveLength(0);
  });
});
