import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errors";

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
    setItems(next); // atualização otimista
    if (!user?.office_id) return false;
    setSaving(true);
    const { data: cur } = await supabase.from("offices").select("settings").eq("id", user.office_id).maybeSingle();
    const merged = { ...((cur?.settings as any) || {}), [key]: next };
    // .select() conta as linhas afetadas: uma RLS que barra (ex.: usuário comum sem
    // permissão de admin) devolve 0 linhas SEM erro — antes isso virava "Salvo" falso
    // (o item sumia no F5). Agora detecta e reverte o otimista. (v12)
    const { data: updated, error: updateError } = await supabase.from("offices").update({ settings: merged }).eq("id", user.office_id).select("id");
    setSaving(false);
    if (updateError) {
      toast({ variant: "destructive", title: "Erro ao salvar", description: updateError.message });
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
  }, [user?.office_id, key, toast, defaults, error]);

  return { items, setItems, loading, saving, error, refetch: load, persist };
}
