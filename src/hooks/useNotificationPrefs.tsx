import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
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
  const { toast } = useToast();
  const [prefs, setPrefs] = useState<Record<string, boolean>>(DEFAULT_PREFS);
  const [leadDias, setLeadDias] = useState<number>(DEFAULT_LEAD_DIAS);
  const [loading, setLoading] = useState(true);

  // Salva e avisa se o banco recusar (não deixa a UI dizer "salvo" só no localStorage).
  const persist = useCallback((uid: string, p: { prefs: Record<string, boolean>; leadDias: number }) => {
    saveNotificationPrefs(uid, p).then(({ error }) => {
      if (error) toast({ title: 'Não foi possível salvar a preferência', description: 'Verifique a conexão e tente de novo.', variant: 'destructive' });
    });
  }, [toast]);

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
      persist(user.id, { prefs: next, leadDias });
      return next;
    });
  }, [user?.id, leadDias, persist]);

  const saveLead = useCallback((v: number) => {
    if (!user?.id) return;
    setLeadDias(v);
    persist(user.id, { prefs, leadDias: v });
  }, [user?.id, prefs, persist]);

  return { prefs, leadDias, toggle, saveLead, loading };
}
