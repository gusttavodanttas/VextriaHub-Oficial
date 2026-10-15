import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getErrorMessage } from '@/lib/errors';

export interface MonitoredOabOption { id: string; oab: string; uf: string; label: string | null; }

/**
 * OABs que o escritório monitora (curadas pelo admin, dentro do teto do plano).
 * A busca e o robô só olham estas — usado pelos seletores das telas de busca.
 */
export function useMonitoredOabs() {
  const { user } = useAuth();
  const [oabs, setOabs] = useState<MonitoredOabOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user?.office_id) { setOabs([]); setLoading(false); return; }
    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from('monitored_oabs')
      .select('id, oab, uf, label')
      .eq('office_id', user.office_id)
      .order('created_at');
    // Antes a falha virava "nenhuma OAB monitorada" nos seletores de busca.
    setError(fetchError ? getErrorMessage(fetchError, 'Não foi possível carregar as OABs monitoradas.') : null);
    setOabs(fetchError ? [] : ((data as MonitoredOabOption[]) || []));
    setLoading(false);
  }, [user?.office_id]);

  useEffect(() => { refresh(); }, [refresh]);

  return { oabs, loading, error, refresh };
}
