// useProximityNotifications: gera avisos de proximidade por categoria conforme as
// preferências, respeita a antecedência por item, deduplica pelo action_url e
// roda uma vez por dia.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { enfileirar, chamadasCom, resetSupabaseMock } from '../helpers/supabaseMock';

vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabase } = await import('../helpers/supabaseMock');
  return { supabase: mockSupabase };
});
const auth = { user: { id: 'u1', office_id: 'o1' } as { id: string; office_id: string | null } };
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
const fetchPrefs = vi.fn();
vi.mock('@/lib/notificationPrefs', () => ({ fetchNotificationPrefs: (...a: unknown[]) => fetchPrefs(...a) }));

import { useProximityNotifications } from '@/hooks/useProximityNotifications';

const emDias = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const todas = { prazos: true, audiencias: true, tarefas: true, atendimentos: true, financeiro: true };
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('useProximityNotifications', () => {
  beforeEach(() => { resetSupabaseMock(); sessionStorage.clear(); fetchPrefs.mockReset(); fetchPrefs.mockResolvedValue({ prefs: todas, leadDias: 3 }); });

  it('gera avisos por categoria dentro da antecedência, deduplica e insere só os novos', async () => {
    enfileirar('audiencias', { data: [{ id: 'a1', titulo: 'Instrução', data_audiencia: `${emDias(1)}T14:00:00` }] });
    enfileirar('prazos', { data: [
      { id: 'z1', titulo: 'Contestação', data_fim_prazo: null, data_vencimento: emDias(2) }, // legado: só data_vencimento
      { id: 'z2', titulo: 'Lixeira', data_fim_prazo: emDias(1), deletado: true },
      { id: 'z3', titulo: 'Contrária', data_fim_prazo: emDias(1), titular: 'contraria' },
      { id: 'z4', titulo: 'Longe', data_fim_prazo: emDias(10) }, // fora da antecedência padrão (3)
      { id: 'z5', titulo: 'Antecedência própria', data_fim_prazo: emDias(10), aviso_dias: 15 },
      { id: 'z6', titulo: 'Sem aviso', data_fim_prazo: emDias(1), aviso_dias: 0 },
    ] });
    enfileirar('tarefas', { data: [{ id: 't1', titulo: 'Ligar', data_vencimento: emDias(0) }] });
    enfileirar('atendimentos', { data: [{ id: 'at1', tipo_atendimento: 'Reunião', data_atendimento: `${emDias(3)}T09:30:00`, clientes: { nome: 'Maria' } }] });
    enfileirar('financeiro', { data: [{ id: 'f1', tipo: 'receita', descricao: 'Honorários', data_vencimento: emDias(2) }] });
    enfileirar('notifications', { data: [{ data: { action_url: '/tarefas?openId=t1&d=3' } }] }); // já existe
    renderHook(() => useProximityNotifications());
    await waitFor(() => expect(chamadasCom('notifications', 'insert')).toHaveLength(1));
    const rows = chamadasCom('notifications', 'insert')[0].ops[0][1][0] as Array<{ title: string; message: string; type: string; data: { action_url: string } }>;
    expect(rows.map((r) => r.data.action_url)).toEqual([
      '/audiencias?openId=a1&d=3', '/prazos?openId=z1&d=3', '/prazos?openId=z5&d=15', '/atendimentos?openId=at1&d=3', '/financeiro?openId=f1&d=3',
    ]);
    expect(rows[0]).toMatchObject({ type: 'warning', title: 'Audiência amanhã', message: 'Instrução — amanhã às 14:00' });
    expect(rows[1]).toMatchObject({ title: 'Prazo em 2 dias', message: 'Contestação — vence em 2 dias' });
    expect(rows[3]).toMatchObject({ type: 'info', message: 'Reunião — Maria — em 3 dias às 09:30' });
    expect(rows[4]).toMatchObject({ message: 'Recebimento: Honorários — vence em 2 dias' });
    expect(chamadasCom('prazos', 'select')[0].ops).toEqual(expect.arrayContaining([['eq', ['office_id', 'o1']], ['neq', ['status', 'concluido']]]));
    expect(chamadasCom('notifications', 'select')[0].ops).toEqual(expect.arrayContaining([['eq', ['user_id', 'u1']]]));
    expect(sessionStorage.getItem(`prox_notif_u1_${new Date().toISOString().split('T')[0]}`)).toBe('1');
  });

  it('respeita as preferências desligadas e não insere quando não há candidatos', async () => {
    fetchPrefs.mockResolvedValue({ prefs: { ...todas, audiencias: false, financeiro: false }, leadDias: 3 });
    enfileirar('prazos', { data: [] }); enfileirar('tarefas', { data: [] }); enfileirar('atendimentos', { data: [] });
    renderHook(() => useProximityNotifications());
    await waitFor(() => expect(chamadasCom('atendimentos', 'select')).toHaveLength(1));
    await tick();
    expect(chamadasCom('audiencias', 'select')).toHaveLength(0);
    expect(chamadasCom('financeiro', 'select')).toHaveLength(0);
    expect(chamadasCom('notifications', 'select')).toHaveLength(0);
    expect(chamadasCom('notifications', 'insert')).toHaveLength(0);
  });

  it('roda uma vez por dia; sem escritório não roda', async () => {
    sessionStorage.setItem(`prox_notif_u1_${new Date().toISOString().split('T')[0]}`, '1');
    renderHook(() => useProximityNotifications());
    await tick();
    expect(fetchPrefs).not.toHaveBeenCalled();

    sessionStorage.clear();
    auth.user = { id: 'u1', office_id: null };
    renderHook(() => useProximityNotifications());
    await tick();
    expect(fetchPrefs).not.toHaveBeenCalled();
    auth.user = { id: 'u1', office_id: 'o1' };
  });
});
