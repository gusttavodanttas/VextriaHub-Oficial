import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

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

  useEffect(() => {
    if (!user?.office_id) { setLoading(false); return; }
    const officeId = user.office_id;
    let cancel = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("offices").select("settings").eq("id", officeId).maybeSingle();
      if (cancel) return;
      const stored = (data?.settings as any)?.[key];
      setItems(Array.isArray(stored) ? stored : defaults);
      setLoading(false);
    })();
    return () => { cancel = true; };
    // defaults é intencionalmente omitido (identidade muda a cada render)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.office_id, key]);

  const persist = useCallback(async (next: T[]) => {
    setItems(next); // atualização otimista
    if (!user?.office_id) return false;
    setSaving(true);
    const { data: cur } = await supabase.from("offices").select("settings").eq("id", user.office_id).maybeSingle();
    const merged = { ...((cur?.settings as any) || {}), [key]: next };
    // .select() conta as linhas afetadas: uma RLS que barra (ex.: usuário comum sem
    // permissão de admin) devolve 0 linhas SEM erro — antes isso virava "Salvo" falso
    // (o item sumia no F5). Agora detecta e reverte o otimista. (v12)
    const { data: updated, error } = await supabase.from("offices").update({ settings: merged }).eq("id", user.office_id).select("id");
    setSaving(false);
    if (error) {
      toast({ variant: "destructive", title: "Erro ao salvar", description: error.message });
      return false;
    }
    if (!updated || updated.length === 0) {
      const stored = (cur?.settings as any)?.[key];
      setItems(Array.isArray(stored) ? stored : defaults); // reverte o otimista
      toast({ variant: "destructive", title: "Sem permissão", description: "Só um administrador do escritório pode alterar esta configuração." });
      return false;
    }
    toast({ title: "Salvo", description: "Configuração atualizada." });
    return true;
  }, [user?.office_id, key, toast, defaults]);

  return { items, setItems, loading, saving, persist };
}
