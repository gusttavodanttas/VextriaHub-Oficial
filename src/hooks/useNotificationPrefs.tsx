import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchNotificationPrefs,
  saveNotificationPrefs,
  DEFAULT_PREFS,
  DEFAULT_LEAD_DIAS,
} from '@/lib/notificationPrefs';

/**
 * Preferências de notificação do usuário, persistidas no banco (sincronizam entre
 * dispositivos). Toggle/lead salvam otimista (UI responde na hora) e gravam no
 * banco por baixo. Usado pela tela Configurações → Notificações.
 */
export function useNotificationPrefs() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<Record<string, boolean>>(DEFAULT_PREFS);
  const [leadDias, setLeadDias] = useState<number>(DEFAULT_LEAD_DIAS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    if (!user?.id) { setLoading(false); return; }
    setLoading(true);
    fetchNotificationPrefs(user.id).then((p) => {
      if (!alive) return;
      setPrefs(p.prefs);
      setLeadDias(p.leadDias);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [user?.id]);

  const toggle = useCallback((key: string, value: boolean) => {
    if (!user?.id) return;
    setPrefs((prev) => {
      const next = { ...prev, [key]: value };
      void saveNotificationPrefs(user.id, { prefs: next, leadDias });
      return next;
    });
  }, [user?.id, leadDias]);

  const saveLead = useCallback((v: number) => {
    if (!user?.id) return;
    setLeadDias(v);
    void saveNotificationPrefs(user.id, { prefs, leadDias: v });
  }, [user?.id, prefs]);

  return { prefs, leadDias, toggle, saveLead, loading };
}
