import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, differenceInCalendarDays, startOfDay } from "date-fns";

const DEFAULT_PREFS: Record<string, boolean> = { prazos: true, audiencias: true, tarefas: true, atendimentos: true, financeiro: false };
const HORIZONTE_DIAS = 90; // janela máxima de busca (cobre leads de até 30 dias com folga)

const proxLabel = (dateStr: string) => {
  const d = startOfDay(new Date(dateStr.length <= 10 ? `${dateStr}T12:00:00` : dateStr));
  const diff = differenceInCalendarDays(d, startOfDay(new Date()));
  return diff <= 0 ? "hoje" : diff === 1 ? "amanhã" : `em ${diff} dias`;
};
const diasAte = (dateStr: string) =>
  differenceInCalendarDays(startOfDay(new Date(dateStr.length <= 10 ? `${dateStr}T12:00:00` : dateStr)), startOfDay(new Date()));

/**
 * Gera notificações de PROXIMIDADE (audiências, prazos, tarefas) no sino.
 * A antecedência é POR ITEM (coluna aviso_dias): null = usa o padrão global do
 * usuário; 0 = não avisar; N = avisar N dias antes. Roda 1x/dia e deduplica.
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

      let prefs = DEFAULT_PREFS;
      try { const raw = localStorage.getItem(`notif_prefs_${user.id}`); if (raw) prefs = { ...DEFAULT_PREFS, ...JSON.parse(raw) }; } catch { /* ignore */ }
      const padrao = Math.max(1, Number(localStorage.getItem(`notif_lead_${user.id}`)) || 3);

      const start = startOfDay(new Date());
      const end = new Date(start); end.setDate(end.getDate() + HORIZONTE_DIAS); end.setHours(23, 59, 59, 999);
      const startDate = format(start, "yyyy-MM-dd");
      const endDate = format(end, "yyyy-MM-dd");

      // Decide se o item deve gerar aviso hoje, conforme a antecedência dele
      const deveAvisar = (avisoDias: number | null | undefined, dateStr: string) => {
        const lead = avisoDias == null ? padrao : avisoDias;
        if (lead <= 0) return false; // 0 = não avisar
        const d = diasAte(dateStr);
        return d >= 0 && d <= lead;
      };

      const candidatos: any[] = [];

      if (prefs.audiencias) {
        const { data } = await supabase.from("audiencias")
          .select("*")
          .eq("office_id", user.office_id).eq("deletado", false)
          .not("status", "in", "(realizada,cancelada)")
          .gte("data_audiencia", start.toISOString()).lte("data_audiencia", end.toISOString());
        (data || []).forEach((a: any) => {
          if (!deveAvisar(a.aviso_dias, a.data_audiencia)) return;
          candidatos.push({
            user_id: user.id, type: "warning",
            title: `Audiência ${proxLabel(a.data_audiencia)}`,
            message: `${a.titulo} — ${proxLabel(a.data_audiencia)} às ${format(new Date(a.data_audiencia), "HH:mm")}`,
            action_url: `/audiencias?openId=${a.id}`, action_label: "Ver audiência", read: false,
          });
        });
      }

      if (prefs.prazos) {
        const { data } = await supabase.from("prazos")
          .select("*, publicacoes(titulo)")
          .eq("office_id", user.office_id).neq("status", "concluido")
          .gte("data_fim_prazo", startDate).lte("data_fim_prazo", endDate);
        (data || []).forEach((p: any) => {
          if (!deveAvisar(p.aviso_dias, p.data_fim_prazo)) return;
          candidatos.push({
            user_id: user.id, type: "warning",
            title: `Prazo ${proxLabel(p.data_fim_prazo)}`,
            message: `${p.publicacoes?.titulo || p.tipo_prazo || p.numero_processo || "Prazo"} — vence ${proxLabel(p.data_fim_prazo)}`,
            action_url: `/prazos?openId=${p.id}`, action_label: "Ver prazo", read: false,
          });
        });
      }

      if (prefs.tarefas) {
        const { data } = await supabase.from("tarefas")
          .select("*")
          .eq("office_id", user.office_id).eq("deletado", false).eq("concluida", false)
          .gte("data_vencimento", startDate).lte("data_vencimento", endDate);
        (data || []).forEach((t: any) => {
          if (!deveAvisar(t.aviso_dias, t.data_vencimento)) return;
          candidatos.push({
            user_id: user.id, type: "info",
            title: `Tarefa ${proxLabel(t.data_vencimento)}`,
            message: `${t.titulo} — vence ${proxLabel(t.data_vencimento)}`,
            action_url: `/tarefas?openId=${t.id}`, action_label: "Ver tarefa", read: false,
          });
        });
      }

      if (candidatos.length === 0) return;

      const { data: existentes } = await supabase.from("notifications").select("action_url").eq("user_id", user.id);
      const jaTem = new Set((existentes || []).map((n: any) => n.action_url));
      const novos = candidatos.filter((c) => !jaTem.has(c.action_url));
      if (novos.length > 0) await supabase.from("notifications").insert(novos);
    };

    run();
  }, [user?.id, user?.office_id]);
}
