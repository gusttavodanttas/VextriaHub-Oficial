import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ActivityItem {
  id: string;
  tipo: "Processo" | "Tarefa" | "Atendimento";
  label: string;
  date: string;
}

const pick = (o: any, keys: string[], fallback: string) => {
  for (const k of keys) if (o?.[k]) return String(o[k]);
  return fallback;
};

/** Últimas atividades do usuário logado (processos, tarefas, atendimentos criados por ele). */
export function useMyActivity(limit = 8) {
  const { user } = useAuth();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id || !user?.office_id) { setLoading(false); return; }
    let cancel = false;
    (async () => {
      setLoading(true);
      const office = user.office_id, uid = user.id;
      const [proc, tar, at] = await Promise.all([
        supabase.from("processos").select("*").eq("office_id", office).eq("user_id", uid).order("created_at", { ascending: false }).limit(5),
        supabase.from("tarefas").select("*").eq("office_id", office).eq("user_id", uid).order("created_at", { ascending: false }).limit(5),
        supabase.from("atendimentos").select("*").eq("office_id", office).eq("user_id", uid).order("created_at", { ascending: false }).limit(5),
      ]);
      if (cancel) return;

      const all: ActivityItem[] = [
        ...(proc.data || []).map((p: any) => ({ id: `p-${p.id}`, tipo: "Processo" as const, label: pick(p, ["titulo", "numero_processo", "numero", "cliente", "nome"], "Processo"), date: p.created_at })),
        ...(tar.data || []).map((t: any) => ({ id: `t-${t.id}`, tipo: "Tarefa" as const, label: pick(t, ["titulo", "descricao", "nome"], "Tarefa"), date: t.created_at })),
        ...(at.data || []).map((a: any) => ({ id: `a-${a.id}`, tipo: "Atendimento" as const, label: pick(a, ["assunto", "titulo", "descricao", "tipo"], "Atendimento"), date: a.created_at })),
      ]
        .filter((x) => x.date)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, limit);

      setItems(all);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [user?.id, user?.office_id, limit]);

  return { items, loading };
}
