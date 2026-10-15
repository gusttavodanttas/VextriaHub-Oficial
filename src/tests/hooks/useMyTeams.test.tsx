// useMyTeams: equipes do usuário com papel e membros; derivados de coordenação.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { enfileirar, chamadasCom, resetSupabaseMock } from '../helpers/supabaseMock';

vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabase } = await import('../helpers/supabaseMock');
  return { supabase: mockSupabase };
});
const auth = { user: { id: 'u1', office_id: 'o1' } as { id: string; office_id: string | null } };
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));

import { useMyTeams } from '@/hooks/useMyTeams';

describe('useMyTeams', () => {
  beforeEach(() => { resetSupabaseMock(); auth.user = { id: 'u1', office_id: 'o1' }; });

  it('monta as equipes com papel, membros e derivados de coordenação', async () => {
    enfileirar('office_team_members',
      { data: [
        { team_id: 't1', role: 'coordinator', office_teams: { id: 't1', name: 'Cível', color: '#f00', description: 'd' } },
        { team_id: 't2', role: 'member', office_teams: null },
      ] },
      { data: [{ team_id: 't1', user_id: 'u1' }, { team_id: 't1', user_id: 'u2' }, { team_id: 't2', user_id: 'u1' }, { team_id: 't2', user_id: 'u3' }] },
    );
    const { result } = renderHook(() => useMyTeams());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.teams).toEqual([
      { id: 't1', name: 'Cível', color: '#f00', description: 'd', myRole: 'coordinator', memberIds: ['u1', 'u2'] },
      { id: 't2', name: '', color: '#3b82f6', description: null, myRole: 'member', memberIds: ['u1', 'u3'] },
    ]);
    expect(result.current.isCoordinatorOf('t1')).toBe(true);
    expect(result.current.isCoordinatorOf('t2')).toBe(false);
    expect(result.current.isAnyCoordinator).toBe(true);
    expect(result.current.coordinatedMemberIds).toEqual(['u1', 'u2']);
    expect(result.current.allTeamMemberIds).toEqual(['u1', 'u2', 'u3']);
    const [minhas, todos] = chamadasCom('office_team_members', 'select');
    expect(minhas.ops).toEqual(expect.arrayContaining([['eq', ['user_id', 'u1']], ['eq', ['office_id', 'o1']]]));
    expect(todos.ops).toEqual(expect.arrayContaining([['in', ['team_id', ['t1', 't2']]]]));
  });

  it('sem equipes não busca membros; sem escritório não consulta', async () => {
    enfileirar('office_team_members', { data: [] });
    const { result } = renderHook(() => useMyTeams());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.teams).toEqual([]);
    expect(result.current.isAnyCoordinator).toBe(false);
    expect(chamadasCom('office_team_members', 'select')).toHaveLength(1);

    resetSupabaseMock();
    auth.user = { id: 'u1', office_id: null };
    const { result: r2 } = renderHook(() => useMyTeams());
    await waitFor(() => expect(r2.current.loading).toBe(false));
    expect(chamadasCom('office_team_members', 'select')).toHaveLength(0);
  });
});
