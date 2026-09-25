import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errors";
import { patchOfficeSettings } from "@/lib/officeSettings";

/**
 * Lê e grava um valor único de configuração dentro de offices.settings[key] (jsonb).
 * Mesmo mecanismo do useOfficeSettingList, mas para escalares (número, string, bool).
 */
export function useOfficeSettingValue<T>(key: string, defaultValue: T) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [value, setValue] = useState<T>(defaultValue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.office_id) { setLoading(false); return; }
    const { data, error: fetchError } = await supabase.from("offices").select("settings").eq("id", user.office_id).maybeSingle();
    if (fetchError) {
      // Mesmo risco do useOfficeSettingList: sem isto, um fetch que falha cai pro
      // defaultValue como se fosse o valor real, e um `save` em seguida gravaria o
      // default por cima do valor de verdade — por isso `save` é bloqueado abaixo.
      setError(getErrorMessage(fetchError, "Não foi possível carregar esta configuração."));
      setLoading(false);
      return;
    }
    setError(null);
    const stored = (data?.settings as any)?.[key];
    setValue(stored === undefined || stored === null ? defaultValue : stored);
    setLoading(false);
  }, [user?.office_id, key]);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (next: T) => {
    if (error) {
      toast({ variant: "destructive", title: "Não foi possível salvar", description: "O valor atual não carregou — recarregue antes de editar." });
      return false;
    }
    if (!user?.office_id) return false;
    const previous = value;
    setValue(next); // otimista
    try {
      await patchOfficeSettings(user.office_id, { [key]: next });
    } catch (e) {
      setValue(previous);
      toast({ variant: "destructive", title: "Erro ao salvar", description: getErrorMessage(e) });
      return false;
    }
    return true;
  }, [user?.office_id, key, value, toast, error]);

  return { value, save, loading, error, refetch: load };
}
