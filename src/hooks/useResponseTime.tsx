import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Tempo médio de resposta = intervalo entre a entrada do lead/cliente
 * (created_at) e o PRIMEIRO atendimento registrado para ele.
 * Retorna a média em horas (e um rótulo formatado).
 */
export function useResponseTime() {
  const { user } = useAuth();
  const [horas, setHoras] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.office_id) { setLoading(false); return; }
    let cancel = false;
    (async () => {
      setLoading(true);
      const [cliRes, atRes] = await Promise.all([
        supabase.from("clientes").select("id, created_at").eq("office_id", user.office_id).eq("deletado", false),
        supabase.from("atendimentos").select("cliente_id, data_atendimento, created_at").eq("office_id", user.office_id).eq("deletado", false),
      ]);
      if (cancel) return;

      // Primeiro atendimento por cliente
      const primeiro: Record<string, number> = {};
      (atRes.data || []).forEach((a: any) => {
        if (!a.cliente_id) return;
        const t = new Date(a.data_atendimento || a.created_at).getTime();
        if (!primeiro[a.cliente_id] || t < primeiro[a.cliente_id]) primeiro[a.cliente_id] = t;
      });

      let soma = 0, qtd = 0;
      (cliRes.data || []).forEach((c: any) => {
        const first = primeiro[c.id];
        if (!first || !c.created_at) return;
        const diffH = (first - new Date(c.created_at).getTime()) / 3_600_000;
        if (diffH >= 0) { soma += diffH; qtd += 1; }
      });

      if (!cancel) {
        setHoras(qtd > 0 ? Math.round((soma / qtd) * 10) / 10 : null);
        setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [user?.office_id]);

  // Rótulo amigável: "2.4h" ou "3.2 dias"
  const label = horas === null ? "—" : horas < 48 ? `${horas}h` : `${Math.round((horas / 24) * 10) / 10} dias`;

  return { horas, label, loading };
}
