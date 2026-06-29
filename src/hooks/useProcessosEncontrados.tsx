import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

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
    await supabase.from("processos_descartados").insert({
      office_id: user.office_id,
      numero_processo: (item.numero_processo || "").replace(/\D/g, ""),
    }).then(() => {}, () => {}); // ignora erro se já descartado
    await remover(item.id);
  }, [user?.office_id, remover]);

  return { items, count: items.length, loading, refetch: fetch, remover, descartar };
}
