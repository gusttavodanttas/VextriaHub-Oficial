import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/lib/errors';
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
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    if (!user?.id) { setLoading(false); return; }
    setLoading(true);
    fetchNotificationPrefs(user.id).then((p) => {
      if (!alive) return;
      setPrefs(p.prefs);
      setLeadDias(p.leadDias);
      setLoadFailed(!!p.loadFailed);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [user?.id, reloadKey]);

  // O upsert grava o objeto inteiro: com o load falho, a tela mostra o cache local/
  // defaults, e salvar um toggle gravaria esses valores por cima das preferências reais.
  const blocked = useCallback(() => {
    if (!loadFailed) return false;
    toast({ title: 'Não foi possível salvar', description: 'Suas preferências não carregaram — tente de novo antes de editar.', variant: 'destructive' });
    return true;
  }, [loadFailed, toast]);

  const toggle = useCallback(async (key: string, value: boolean) => {
    if (!user?.id || blocked()) return;
    const previous = prefs;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    const { error } = await saveNotificationPrefs(user.id, { prefs: next, leadDias });
    if (error) {
      setPrefs(previous); // reverte o otimista — antes a chave ficava trocada na tela
      toast({ title: 'Não foi possível salvar a preferência', description: getErrorMessage(error, 'Verifique a conexão e tente de novo.'), variant: 'destructive' });
    }
  }, [user?.id, prefs, leadDias, toast, blocked]);

  const saveLead = useCallback(async (v: number) => {
    if (!user?.id || blocked()) return;
    const previous = leadDias;
    setLeadDias(v);
    const { error } = await saveNotificationPrefs(user.id, { prefs, leadDias: v });
    if (error) {
      setLeadDias(previous);
      toast({ title: 'Não foi possível salvar a preferência', description: getErrorMessage(error, 'Verifique a conexão e tente de novo.'), variant: 'destructive' });
    }
  }, [user?.id, prefs, leadDias, toast, blocked]);

  return {
    prefs, leadDias, toggle, saveLead, loading,
    error: loadFailed ? 'Não foi possível carregar suas preferências do servidor.' : null,
    refetch: () => setReloadKey((k) => k + 1),
  };
}
