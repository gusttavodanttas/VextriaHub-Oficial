import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errors";
import { patchOfficeSettings } from "@/lib/officeSettings";

/**
 * Lê e grava uma lista de configuração dentro de offices.settings[key] (jsonb).
 * Persiste de verdade no banco — sem necessidade de migração/tabela nova.
 */
export function useOfficeSettingList<T>(key: string, defaults: T[]) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<T[]>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.office_id) { setLoading(false); return; }
    const officeId = user.office_id;
    setLoading(true);
    const { data, error: fetchError } = await supabase.from("offices").select("settings").eq("id", officeId).maybeSingle();
    if (fetchError) {
      // Sem isto, um fetch que falha caía pros `defaults` como se fosse a lista real —
      // e um `persist` logo em seguida gravava esses defaults por cima da configuração
      // de verdade (perda de dados silenciosa). Por isso o `persist` abaixo é bloqueado
      // enquanto `error` estiver setado.
      setError(getErrorMessage(fetchError, "Não foi possível carregar esta configuração."));
      setLoading(false);
      return;
    }
    setError(null);
    const stored = (data?.settings as any)?.[key];
    setItems(Array.isArray(stored) ? stored : defaults);
    setLoading(false);
    // defaults é intencionalmente omitido (identidade muda a cada render)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.office_id, key]);

  useEffect(() => { load(); }, [load]);

  const persist = useCallback(async (next: T[]) => {
    if (error) {
      toast({ variant: "destructive", title: "Não foi possível salvar", description: "A configuração atual não carregou — recarregue antes de editar." });
      return false;
    }
    if (!user?.office_id) return false;
    const previous = items;
    setItems(next); // atualização otimista
    setSaving(true);
    try {
      // Releitura com erro checado + contagem de linhas (RLS bloqueando = 0 linhas
      // sem erro) — ver patchOfficeSettings.
      await patchOfficeSettings(user.office_id, { [key]: next });
    } catch (e) {
      setItems(previous); // reverte o otimista
      toast({ variant: "destructive", title: "Erro ao salvar", description: getErrorMessage(e) });
      return false;
    } finally {
      setSaving(false);
    }
    toast({ title: "Salvo", description: "Configuração atualizada." });
    return true;
  }, [user?.office_id, key, toast, error, items]);

  return { items, setItems, loading, saving, error, refetch: load, persist };
}
