import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errors";

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
    const { data: cur } = await supabase.from("offices").select("settings").eq("id", user.office_id).maybeSingle();
    const merged = { ...((cur?.settings as any) || {}), [key]: next };
    // .select() conta as linhas afetadas: uma RLS que barra devolve 0 linhas
    // SEM erro — sem checar, o valor otimista ficava "salvo" na tela mesmo
    // sem persistir (mesma classe de bug corrigida em useOfficeSettingList).
    const { data: updated, error: updateError } = await supabase.from("offices").update({ settings: merged }).eq("id", user.office_id).select("id");
    if (updateError) {
      setValue(previous);
      toast({ variant: "destructive", title: "Erro ao salvar", description: updateError.message });
      return false;
    }
    if (!updated || updated.length === 0) {
      setValue(previous);
      toast({ variant: "destructive", title: "Sem permissão", description: "Só um administrador do escritório pode alterar esta configuração." });
      return false;
    }
    return true;
  }, [user?.office_id, key, value, toast, error]);

  return { value, save, loading, error, refetch: load };
}
