// useCoordinatorAlerts: só coordenadores; uma vez por dia (sessionStorage); gera
// notificações de tarefas atrasadas e prazos em 2 dias dos membros coordenados.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { enfileirar, chamadasCom, resetSupabaseMock } from '../helpers/supabaseMock';

vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabase } = await import('../helpers/supabaseMock');
  return { supabase: mockSupabase };
});
const auth = { user: { id: 'u1', office_id: 'o1' } as { id: string; office_id: string | null } };
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
const teams = { teams: [], isAnyCoordinator: true, coordinatedMemberIds: ['u2', 'u3'] };
vi.mock('@/hooks/useMyTeams', () => ({ useMyTeams: () => teams }));

import { useCoordinatorAlerts } from '@/hooks/useCoordinatorAlerts';

describe('useCoordinatorAlerts', () => {
  beforeEach(() => { resetSupabaseMock(); sessionStorage.clear(); teams.isAnyCoordinator = true; teams.coordinatedMemberIds = ['u2', 'u3']; });

  it('insere uma notificação por categoria com plural correto e marca o dia na sessão', async () => {
    enfileirar('tarefas', { data: [{ id: 't1' }, { id: 't2' }] });
    enfileirar('prazos', { data: [{ id: 'z1' }] });
    renderHook(() => useCoordinatorAlerts());
    await waitFor(() => expect(chamadasCom('notifications', 'insert')).toHaveLength(1));
    const rows = chamadasCom('notifications', 'insert')[0].ops[0][1][0] as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ user_id: 'u1', type: 'warning', title: '2 tarefas atrasadas na equipe', read: false, data: { action_url: '/tarefas' } });
    expect(rows[1]).toMatchObject({ title: '1 prazo vencendo em 2 dias', data: { action_url: '/prazos' } });
    const hoje = new Date().toISOString().split('T')[0];
    expect(chamadasCom('tarefas', 'select')[0].ops).toEqual(expect.arrayContaining([
      ['eq', ['office_id', 'o1']], ['eq', ['deletado', false]], ['eq', ['concluida', false]], ['lt', ['data_vencimento', hoje]], ['in', ['responsavel_id', ['u2', 'u3']]],
    ]));
    expect(chamadasCom('prazos', 'select')[0].ops).toEqual(expect.arrayContaining([['gte', ['data_fim_prazo', hoje]], ['in', ['responsavel_id', ['u2', 'u3']]]]));
    expect(sessionStorage.getItem(`coord_alerts_u1_${hoje}`)).toBe('1');

    // segunda montagem no mesmo dia não consulta de novo
    resetSupabaseMock();
    renderHook(() => useCoordinatorAlerts());
    await new Promise((r) => setTimeout(r, 0));
    expect(chamadasCom('tarefas', 'select')).toHaveLength(0);
  });

  it('sem pendências não insere; quem não coordena não consulta', async () => {
    enfileirar('tarefas', { data: [] });
    enfileirar('prazos', { data: [] });
    renderHook(() => useCoordinatorAlerts());
    await waitFor(() => expect(chamadasCom('prazos', 'select')).toHaveLength(1));
    await new Promise((r) => setTimeout(r, 0));
    expect(chamadasCom('notifications', 'insert')).toHaveLength(0);

    resetSupabaseMock(); sessionStorage.clear();
    teams.isAnyCoordinator = false;
    renderHook(() => useCoordinatorAlerts());
    await new Promise((r) => setTimeout(r, 0));
    expect(chamadasCom('tarefas', 'select')).toHaveLength(0);
  });
});
