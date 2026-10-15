// Preferências de notificação: banco é a fonte da verdade, localStorage é cache;
// falha de RLS/rede marca loadFailed (quem grava precisa bloquear o save).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { enfileirar, chamadasCom, resetSupabaseMock } from '../helpers/supabaseMock';

vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabase } = await import('../helpers/supabaseMock');
  return { supabase: mockSupabase };
});
const captureError = vi.fn();
vi.mock('@/lib/monitoring', () => ({ captureError: (...a: unknown[]) => captureError(...a) }));

import { fetchNotificationPrefs, saveNotificationPrefs, readLocalPrefs, DEFAULT_PREFS } from '@/lib/notificationPrefs';

describe('notificationPrefs', () => {
  beforeEach(() => { resetSupabaseMock(); localStorage.clear(); captureError.mockClear(); });

  it('readLocalPrefs mescla com os defaults, exige lead ≥ 1 e nunca lança', () => {
    expect(readLocalPrefs('u1')).toEqual({ prefs: DEFAULT_PREFS, leadDias: 3 });
    localStorage.setItem('notif_prefs_u1', JSON.stringify({ financeiro: true }));
    localStorage.setItem('notif_lead_u1', '-2');
    expect(readLocalPrefs('u1')).toEqual({ prefs: { ...DEFAULT_PREFS, financeiro: true }, leadDias: 1 });
    localStorage.setItem('notif_prefs_u1', '{nope');
    expect(readLocalPrefs('u1').prefs).toEqual(DEFAULT_PREFS);
  });

  it('banco com linha → mescla defaults; sem linha → localStorage sem loadFailed', async () => {
    enfileirar('user_notification_prefs', { data: { prefs: { prazos: false }, lead_dias: 0 } });
    expect(await fetchNotificationPrefs('u1')).toEqual({ prefs: { ...DEFAULT_PREFS, prazos: false }, leadDias: 3 });
    expect(chamadasCom('user_notification_prefs', 'select')[0].ops).toEqual(expect.arrayContaining([['eq', ['user_id', 'u1']], ['maybeSingle', []]]));

    localStorage.setItem('notif_lead_u1', '7');
    enfileirar('user_notification_prefs', { data: null });
    const r = await fetchNotificationPrefs('u1');
    expect(r).toEqual({ prefs: DEFAULT_PREFS, leadDias: 7 });
    expect(r.loadFailed).toBeUndefined();
    expect(captureError).not.toHaveBeenCalled();
  });

  it('erro de RLS/rede → cache local com loadFailed e reporta ao Sentry', async () => {
    enfileirar('user_notification_prefs', { error: { message: 'rls' } });
    const r = await fetchNotificationPrefs('u1');
    expect(r).toEqual({ prefs: DEFAULT_PREFS, leadDias: 3, loadFailed: true });
    expect(captureError).toHaveBeenCalledWith({ message: 'rls' }, expect.objectContaining({ userId: 'u1' }));
  });

  it('save espelha no localStorage e faz upsert por usuário, devolvendo o erro do banco', async () => {
    enfileirar('user_notification_prefs', { data: null });
    const p = { prefs: { ...DEFAULT_PREFS, tarefas: false }, leadDias: 5 };
    expect(await saveNotificationPrefs('u1', p)).toEqual({ error: null });
    const up = chamadasCom('user_notification_prefs', 'upsert')[0];
    expect(up.ops[0][1][0]).toMatchObject({ user_id: 'u1', prefs: p.prefs, lead_dias: 5 });
    expect(up.ops[0][1][1]).toEqual({ onConflict: 'user_id' });
    expect(readLocalPrefs('u1')).toEqual(p);

    enfileirar('user_notification_prefs', { error: { message: 'offline' } });
    expect(await saveNotificationPrefs('u1', p)).toEqual({ error: { message: 'offline' } });
  });
});
