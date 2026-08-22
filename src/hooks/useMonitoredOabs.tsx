import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface MonitoredOabOption { id: string; oab: string; uf: string; label: string | null; }

/**
 * OABs que o escritório monitora (curadas pelo admin, dentro do teto do plano).
 * A busca e o robô só olham estas — usado pelos seletores das telas de busca.
 */
export function useMonitoredOabs() {
  const [oabs, setOabs] = useState<MonitoredOabOption[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('monitored_oabs')
      .select('id, oab, uf, label')
      .order('created_at');
    setOabs((data as MonitoredOabOption[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { oabs, loading, refresh };
}
