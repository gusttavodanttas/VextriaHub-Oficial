import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, differenceInCalendarDays, startOfDay } from "date-fns";

const DEFAULT_PREFS: Record<string, boolean> = { prazos: true, audiencias: true, tarefas: true, atendimentos: true, financeiro: false };

const proxLabel = (dateStr: string) => {
  const d = startOfDay(new Date(dateStr.length <= 10 ? `${dateStr}T12:00:00` : dateStr));
  const diff = differenceInCalendarDays(d, startOfDay(new Date()));
  return diff <= 0 ? "hoje" : diff === 1 ? "amanhã" : `em ${diff} dias`;
};

/**
 * Gera notificações de PROXIMIDADE (audiências, prazos, tarefas) na tabela `notifications`,
 * respeitando as preferências do usuário e o prazo de antecedência configurável.
 * Roda 1x/dia (guard em sessionStorage) e deduplica pela action_url já existente.
 */
export function useProximityNotifications() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id || !user?.office_id) return;

    const run = async () => {
      const hojeKey = new Date().toISOString().split("T")[0];
      const guard = `prox_notif_${user.id}_${hojeKey}`;
      if (sessionStorage.getItem(guard)) return;
      sessionStorage.setItem(guard, "1");

      // Preferências
      let prefs = DEFAULT_PREFS;
      try { const raw = localStorage.getItem(`notif_prefs_${user.id}`); if (raw) prefs = { ...DEFAULT_PREFS, ...JSON.parse(raw) }; } catch { /* ignore */ }
      const lead = Math.max(0, Number(localStorage.getItem(`notif_lead_${user.id}`)) || 3);

      const start = startOfDay(new Date());
      const end = new Date(start); end.setDate(end.getDate() + lead); end.setHours(23, 59, 59, 999);
      const startDate = format(start, "yyyy-MM-dd");
      const endDate = format(end, "yyyy-MM-dd");

      const candidatos: any[] = [];

      // Audiências
      if (prefs.audiencias) {
        const { data } = await supabase.from("audiencias")
          .select("id, titulo, data_audiencia, status")
          .eq("office_id", user.office_id).eq("deletado", false)
          .not("status", "in", "(realizada,cancelada)")
          .gte("data_audiencia", start.toISOString()).lte("data_audiencia", end.toISOString());
        (data || []).forEach((a: any) => candidatos.push({
          user_id: user.id, type: "warning",
          title: `Audiência ${proxLabel(a.data_audiencia)}`,
          message: `${a.titulo} — ${proxLabel(a.data_audiencia)} às ${format(new Date(a.data_audiencia), "HH:mm")}`,
          action_url: `/audiencias?openId=${a.id}`, action_label: "Ver audiência", read: false,
        }));
      }

      // Prazos
      if (prefs.prazos) {
        const { data } = await supabase.from("prazos")
          .select("id, tipo_prazo, numero_processo, data_fim_prazo, status, publicacoes(titulo)")
          .eq("office_id", user.office_id).neq("status", "concluido")
          .gte("data_fim_prazo", startDate).lte("data_fim_prazo", endDate);
        (data || []).forEach((p: any) => candidatos.push({
          user_id: user.id, type: "warning",
          title: `Prazo ${proxLabel(p.data_fim_prazo)}`,
          message: `${p.publicacoes?.titulo || p.tipo_prazo || p.numero_processo || "Prazo"} — vence ${proxLabel(p.data_fim_prazo)}`,
          action_url: `/prazos?openId=${p.id}`, action_label: "Ver prazo", read: false,
        }));
      }

      // Tarefas
      if (prefs.tarefas) {
        const { data } = await supabase.from("tarefas")
          .select("id, titulo, data_vencimento, concluida")
          .eq("office_id", user.office_id).eq("deletado", false).eq("concluida", false)
          .gte("data_vencimento", startDate).lte("data_vencimento", endDate);
        (data || []).forEach((t: any) => candidatos.push({
          user_id: user.id, type: "info",
          title: `Tarefa ${proxLabel(t.data_vencimento)}`,
          message: `${t.titulo} — vence ${proxLabel(t.data_vencimento)}`,
          action_url: `/tarefas?openId=${t.id}`, action_label: "Ver tarefa", read: false,
        }));
      }

      if (candidatos.length === 0) return;

      // Dedup: não recria avisos cuja action_url já existe
      const { data: existentes } = await supabase.from("notifications").select("action_url").eq("user_id", user.id);
      const jaTem = new Set((existentes || []).map((n: any) => n.action_url));
      const novos = candidatos.filter((c) => !jaTem.has(c.action_url));
      if (novos.length > 0) {
        await supabase.from("notifications").insert(novos);
      }
    };

    run();
  }, [user?.id, user?.office_id]);
}
