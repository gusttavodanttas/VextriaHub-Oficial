// useEquipeStats (painel da equipe): contagens por membro e resumo somado, equipe
// vazia zera o estado e erro em qualquer consulta é exposto.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { enfileirar, chamadasCom, resetSupabaseMock } from '../helpers/supabaseMock';

vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabase } = await import('../helpers/supabaseMock');
  return { supabase: mockSupabase };
});

import { useEquipeStats } from '@/hooks/useEquipeStats';

describe('useEquipeStats', () => {
  beforeEach(() => resetSupabaseMock());

  it('monta as estatísticas por membro (coordenador primeiro) e o resumo da equipe', async () => {
    enfileirar('office_team_members', { data: [{ user_id: 'u2', role: 'member' }, { user_id: 'u1', role: 'coordinator' }] });
    enfileirar('profiles', { data: [{ user_id: 'u1', full_name: 'Ana', email: 'a@x' }, { user_id: 'u2', full_name: 'Bia', email: 'b@x' }] });
    // processos: por equipe, por responsável, por criador — o mesmo id em dois critérios conta uma vez
    enfileirar('processos',
      { data: [{ id: 'p1', user_id: 'u2', responsavel_id: 'u1', team_id: 't1' }] },
      { data: [{ id: 'p1', user_id: 'u2', responsavel_id: 'u1', team_id: 't1' }, { id: 'p2', user_id: 'u2', responsavel_id: 'u2', team_id: null }] },
      { data: [] });
    enfileirar('tarefas', { data: [{ user_id: 'u1', concluida: true }, { user_id: 'u1', concluida: false }, { user_id: 'u2', concluida: false }] });
    enfileirar('audiencias', { data: [{ user_id: 'u2' }] });
    enfileirar('prazos', { data: [{ responsavel_id: 'u1' }, { responsavel_id: 'u1' }] });
    enfileirar('atendimentos', { data: [{ user_id: 'u2' }] });
    enfileirar('consultivos', { data: [] });
    enfileirar('timesheets', { data: [{ user_id: 'u1', duracao_minutos: 90 }, { user_id: 'u1', duracao_minutos: 45 }] });

    const { result } = renderHook(() => useEquipeStats('t1', 'o1', 'month'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.memberIds).toEqual(['u2', 'u1']);
    expect(result.current.members.map(m => m.user_id)).toEqual(['u1', 'u2']);
    expect(result.current.members[0]).toMatchObject({ full_name: 'Ana', role: 'coordinator', processos: 1, tarefasPendentes: 1, tarefasConcluidas: 1, prazos: 2, horasTimesheet: 2 });
    expect(result.current.members[1]).toMatchObject({ full_name: 'Bia', processos: 1, audiencias: 1, atendimentos: 1 });
    expect(result.current.summary).toMatchObject({ processos: 2, tarefasPendentes: 2, tarefasConcluidas: 1, prazos: 2, horasTimesheet: 2 });
    expect(chamadasCom('processos', 'select')).toHaveLength(3);
    expect(chamadasCom('timesheets', 'select')[0].ops).toContainEqual(['eq', ['office_id', 'o1']]);
  });

  it('equipe sem membros zera membros e resumo; erro em uma consulta vira `error`', async () => {
    enfileirar('office_team_members', { data: [] });
    const { result } = renderHook(() => useEquipeStats('t1', 'o1', 'week'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.members).toEqual([]);
    expect(result.current.summary.processos).toBe(0);

    resetSupabaseMock();
    enfileirar('office_team_members', { data: [{ user_id: 'u1', role: 'member' }] });
    enfileirar('profiles', { data: [] });
    enfileirar('processos', { data: [] }, { error: { message: 'rls' } }, { data: [] });
    const { result: r2 } = renderHook(() => useEquipeStats('t1', 'o1', 'year'));
    await waitFor(() => expect(r2.current.loading).toBe(false));
    expect(r2.current.error).toBe('rls');
  });
});
