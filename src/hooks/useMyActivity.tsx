import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getErrorMessage } from "@/lib/errors";

export interface ActivityItem {
  id: string;
  tipo: "Processo" | "Tarefa" | "Atendimento";
  label: string;
  date: string;
  link: string;
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
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!user?.id || !user?.office_id) { setLoading(false); return; }
    const office = user.office_id, uid = user.id;
    let cancel = false;
    (async () => {
      setLoading(true);
      const [proc, tar, at] = await Promise.all([
        supabase.from("processos").select("*").eq("office_id", office).eq("user_id", uid).order("created_at", { ascending: false }).limit(5),
        supabase.from("tarefas").select("*").eq("office_id", office).eq("user_id", uid).order("created_at", { ascending: false }).limit(5),
        supabase.from("atendimentos").select("*").eq("office_id", office).eq("user_id", uid).order("created_at", { ascending: false }).limit(5),
      ]);
      if (cancel) return;

      // Nenhum dos 3 resultados tinha o erro checado — uma falha de RLS/rede em
      // qualquer um virava "sem atividade recente", indistinguível de um usuário
      // genuinamente sem nada criado ainda.
      const firstError = [proc, tar, at].find((r) => r.error)?.error;
      if (firstError) {
        console.error("useMyActivity:", firstError);
        setError(getErrorMessage(firstError, "Não foi possível carregar sua atividade recente."));
        setLoading(false);
        return;
      }

      const all: ActivityItem[] = [
        ...(proc.data || []).map((p: any) => ({ id: `p-${p.id}`, tipo: "Processo" as const, label: pick(p, ["titulo", "numero_processo", "numero", "cliente", "nome"], "Processo"), date: p.created_at, link: `/processos?openId=${p.id}` })),
        ...(tar.data || []).map((t: any) => ({ id: `t-${t.id}`, tipo: "Tarefa" as const, label: pick(t, ["titulo", "descricao", "nome"], "Tarefa"), date: t.created_at, link: `/tarefas?openId=${t.id}` })),
        ...(at.data || []).map((a: any) => ({ id: `a-${a.id}`, tipo: "Atendimento" as const, label: pick(a, ["assunto", "titulo", "descricao", "tipo"], "Atendimento"), date: a.created_at, link: `/atendimentos?openId=${a.id}` })),
      ]
        .filter((x) => x.date)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, limit);

      setError(null);
      setItems(all);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [user?.id, user?.office_id, limit, reload]);

  const refetch = useCallback(() => setReload((r) => r + 1), []);

  return { items, loading, isError: !!error, error, refetch };
}
