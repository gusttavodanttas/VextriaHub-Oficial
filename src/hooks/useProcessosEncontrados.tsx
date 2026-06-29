import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { tribunalFromCNJ } from "@/utils/tribunalCNJ";

export interface ProcessoEncontrado {
  id: string;
  numero_processo: string;
  titulo: string | null;
  tribunal: string | null;
  autor: string | null;
  reu: string | null;
  fonte: string | null;
  payload: any;
  created_at: string;
}

export function useProcessosEncontrados() {
  const { user } = useAuth();
  const [items, setItems] = useState<ProcessoEncontrado[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user?.office_id) { setItems([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("processos_encontrados")
      .select("*")
      .eq("office_id", user.office_id)
      .order("created_at", { ascending: false });
    setItems((data as any) || []);
    setLoading(false);
  }, [user?.office_id]);

  useEffect(() => { fetch(); }, [fetch]);

  // Remove do staging (após aprovar/importar)
  const remover = useCallback(async (id: string) => {
    await supabase.from("processos_encontrados").delete().eq("id", id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  // Descarta: marca como descartado (não reaparece na próxima busca) e remove do staging
  const descartar = useCallback(async (item: ProcessoEncontrado) => {
    if (!user?.office_id) return;
    const numero = (item.numero_processo || "").replace(/\D/g, "");
    // Otimista: some da lista imediatamente (contagem atualiza na hora)
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    const { error } = await supabase.from("processos_descartados").insert({
      office_id: user.office_id,
      user_id: user.id,
      numero_processo: numero,
      titulo: item.titulo,
      tribunal: tribunalFromCNJ(item.numero_processo) || item.tribunal,
      motivo: "descartado_inbox",
      dados_originais: item.payload as any,
    });
    const jaDescartado = error && /(duplicate|unique|already)/i.test(error.message || "");
    if (error && !jaDescartado) {
      // Não conseguiu REGISTRAR o descarte → desfaz para não voltar silenciosamente
      setItems((prev) => [item, ...prev]);
      throw new Error(error.message || "Falha ao registrar descarte");
    }
    // Registrado (ou já estava) → remove do staging definitivamente
    await supabase.from("processos_encontrados").delete().eq("id", item.id);
  }, [user?.office_id, user?.id]);

  return { items, count: items.length, loading, refetch: fetch, remover, descartar };
}
