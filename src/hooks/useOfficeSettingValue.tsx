import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Lê e grava um valor único de configuração dentro de offices.settings[key] (jsonb).
 * Mesmo mecanismo do useOfficeSettingList, mas para escalares (número, string, bool).
 */
export function useOfficeSettingValue<T>(key: string, defaultValue: T) {
  const { user } = useAuth();
  const [value, setValue] = useState<T>(defaultValue);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.office_id) { setLoading(false); return; }
    const { data } = await supabase.from("offices").select("settings").eq("id", user.office_id).maybeSingle();
    const stored = (data?.settings as any)?.[key];
    setValue(stored === undefined || stored === null ? defaultValue : stored);
    setLoading(false);
  }, [user?.office_id, key]);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (next: T) => {
    if (!user?.office_id) return;
    setValue(next);
    const { data: cur } = await supabase.from("offices").select("settings").eq("id", user.office_id).maybeSingle();
    const merged = { ...((cur?.settings as any) || {}), [key]: next };
    await supabase.from("offices").update({ settings: merged }).eq("id", user.office_id);
  }, [user?.office_id, key]);

  return { value, save, loading };
}
