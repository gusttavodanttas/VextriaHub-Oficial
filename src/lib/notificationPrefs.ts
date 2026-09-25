import { supabase } from '@/integrations/supabase/client';
import { captureError } from '@/lib/monitoring';

// Preferências de notificação POR USUÁRIO. Fonte da verdade = tabela
// user_notification_prefs (sincroniza entre dispositivos). O localStorage vira
// só cache/fallback (migração de quem já tinha config + leitura offline). Lido
// tanto pela tela de Configurações quanto pelo gerador useProximityNotifications.

export type NotifCategory = 'prazos' | 'audiencias' | 'tarefas' | 'atendimentos' | 'financeiro';

export const DEFAULT_PREFS: Record<string, boolean> = {
  prazos: true, audiencias: true, tarefas: true, atendimentos: true, financeiro: false,
};
export const DEFAULT_LEAD_DIAS = 3;

export interface NotifPrefs {
  prefs: Record<string, boolean>;
  leadDias: number;
  /**
   * true quando a leitura do banco falhou e os valores vieram do cache local/defaults.
   * Quem grava (tela de Configurações) precisa bloquear o save nesse estado: o upsert
   * grava o objeto inteiro, então salvar um toggle gravaria os defaults por cima das
   * preferências reais. O gerador de notificações pode seguir usando o fallback.
   */
  loadFailed?: boolean;
}

const prefsKey = (uid: string) => `notif_prefs_${uid}`;
const leadKey = (uid: string) => `notif_lead_${uid}`;

/** Lê as prefs do localStorage (fallback/cache). Nunca lança. */
export function readLocalPrefs(userId: string): NotifPrefs {
  let prefs: Record<string, boolean> = { ...DEFAULT_PREFS };
  let leadDias = DEFAULT_LEAD_DIAS;
  try {
    const raw = localStorage.getItem(prefsKey(userId));
    if (raw) prefs = { ...DEFAULT_PREFS, ...JSON.parse(raw) };
    const lead = Number(localStorage.getItem(leadKey(userId)));
    if (lead) leadDias = Math.max(1, lead);
  } catch { /* ignore */ }
  return { prefs, leadDias };
}

function writeLocalPrefs(userId: string, p: NotifPrefs): void {
  try {
    localStorage.setItem(prefsKey(userId), JSON.stringify(p.prefs));
    localStorage.setItem(leadKey(userId), String(p.leadDias));
  } catch { /* ignore */ }
}

/**
 * Lê as prefs do usuário: banco primeiro (fonte da verdade), caindo pro
 * localStorage (usuário antigo, ainda sem linha) e por fim pros defaults.
 */
export async function fetchNotificationPrefs(userId: string): Promise<NotifPrefs> {
  try {
    const { data, error } = await supabase
      .from('user_notification_prefs')
      .select('prefs, lead_dias')
      .eq('user_id', userId)
      .maybeSingle();
    // supabase-js não lança em erro de PostgREST/RLS — o catch abaixo só pegava rede.
    if (error) throw error;
    if (data) {
      const dbPrefs = (data.prefs as Record<string, boolean> | null) || {};
      return {
        prefs: { ...DEFAULT_PREFS, ...dbPrefs },
        leadDias: Math.max(1, data.lead_dias || DEFAULT_LEAD_DIAS),
      };
    }
  } catch (e) {
    captureError(e, { context: 'fetchNotificationPrefs: rede/RLS, caindo pro localStorage', userId });
    return { ...readLocalPrefs(userId), loadFailed: true };
  }
  // Sem linha no banco (usuário antigo): o localStorage é a fonte legítima, não uma falha.
  return readLocalPrefs(userId);
}

/**
 * Salva no banco (upsert por user_id) e espelha no localStorage (cache do gerador).
 * Retorna o erro do banco (ou null) — o chamador avisa se a persistência falhou, em
 * vez de a UI dizer "salvo" com o valor só no localStorage (divergiria entre dispositivos).
 */
export async function saveNotificationPrefs(userId: string, p: NotifPrefs): Promise<{ error: unknown | null }> {
  writeLocalPrefs(userId, p);
  const { error } = await supabase.from('user_notification_prefs').upsert(
    { user_id: userId, prefs: p.prefs, lead_dias: p.leadDias, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' },
  );
  return { error: error ?? null };
}
