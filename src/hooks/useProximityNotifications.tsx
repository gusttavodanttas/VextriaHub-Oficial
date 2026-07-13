import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, startOfDay } from "date-fns";
import { diasAte, proxLabel, marcosDe, deveAvisar, dataFatalPrazo } from "@/lib/proximityAlert";

const DEFAULT_PREFS: Record<string, boolean> = { prazos: true, audiencias: true, tarefas: true, atendimentos: true, financeiro: false };
const HORIZONTE_DIAS = 90; // janela máxima de busca (cobre leads de até 30 dias com folga)

/**
 * Gera notificações de PROXIMIDADE (audiências, prazos, tarefas, atendimentos) no sino.
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

      const candidatos: any[] = [];

      if (prefs.audiencias) {
        const { data } = await supabase.from("audiencias")
          .select("*")
          .eq("office_id", user.office_id).eq("deletado", false)
          .not("status", "in", "(realizada,cancelada)")
          .gte("data_audiencia", start.toISOString()).lte("data_audiencia", end.toISOString());
        (data || []).forEach((a: any) => {
          const d = diasAte(a.data_audiencia);
          marcosDe(a, padrao).forEach((D) => {
            if (d < 0 || d > D) return;
            candidatos.push({
              user_id: user.id, type: "warning",
              title: `Audiência ${proxLabel(a.data_audiencia)}`,
              message: `${a.titulo} — ${proxLabel(a.data_audiencia)} às ${format(new Date(a.data_audiencia), "HH:mm")}`,
              action_url: `/audiencias?openId=${a.id}&d=${D}`, action_label: "Ver audiência", read: false,
            });
          });
        });
      }

      if (prefs.prazos) {
        // Sem filtro de data no banco: prazos legados guardam a data só em
        // data_vencimento (data_fim_prazo nulo) e sumiam do aviso. Resolvemos a
        // data fatal e filtramos o horizonte aqui. (RLS já limita ao escritório.)
        const { data } = await supabase.from("prazos")
          .select("*, publicacoes(titulo)")
          .eq("office_id", user.office_id).neq("status", "concluido");
        (data || []).forEach((p: any) => {
          if (p.titular === "contraria") return; // prazo da parte contrária: só monitoramento
          const fatal = dataFatalPrazo(p);
          if (!fatal) return;
          const d = diasAte(fatal);
          if (d < 0 || d > HORIZONTE_DIAS) return;
          marcosDe(p, padrao).forEach((D) => {
            if (!deveAvisar(d, D)) return;
            candidatos.push({
              user_id: user.id, type: "warning",
              title: `Prazo ${proxLabel(fatal)}`,
              message: `${p.publicacoes?.titulo || p.tipo_prazo || p.numero_processo || "Prazo"} — vence ${proxLabel(fatal)}`,
              action_url: `/prazos?openId=${p.id}&d=${D}`, action_label: "Ver prazo", read: false,
            });
          });
        });
      }

      if (prefs.tarefas) {
        const { data } = await supabase.from("tarefas")
          .select("*")
          .eq("office_id", user.office_id).eq("deletado", false).eq("concluida", false)
          .gte("data_vencimento", startDate).lte("data_vencimento", endDate);
        (data || []).forEach((t: any) => {
          const d = diasAte(t.data_vencimento);
          marcosDe(t, padrao).forEach((D) => {
            if (d < 0 || d > D) return;
            candidatos.push({
              user_id: user.id, type: "info",
              title: `Tarefa ${proxLabel(t.data_vencimento)}`,
              message: `${t.titulo} — vence ${proxLabel(t.data_vencimento)}`,
              action_url: `/tarefas?openId=${t.id}&d=${D}`, action_label: "Ver tarefa", read: false,
            });
          });
        });
      }

      if (prefs.atendimentos) {
        const { data } = await supabase.from("atendimentos")
          .select("*, clientes(nome)")
          .eq("office_id", user.office_id).eq("deletado", false)
          .in("status", ["agendado", "pendente"])
          .gte("data_atendimento", start.toISOString()).lte("data_atendimento", end.toISOString());
        (data || []).forEach((a: any) => {
          const d = diasAte(a.data_atendimento);
          marcosDe(a, padrao).forEach((D) => {
            if (d < 0 || d > D) return;
            candidatos.push({
              user_id: user.id, type: "info",
              title: `Atendimento ${proxLabel(a.data_atendimento)}`,
              message: `${a.tipo_atendimento || "Atendimento"}${a.clientes?.nome ? ` — ${a.clientes.nome}` : ""} — ${proxLabel(a.data_atendimento)} às ${format(new Date(a.data_atendimento), "HH:mm")}`,
              action_url: `/atendimentos?openId=${a.id}&d=${D}`, action_label: "Ver atendimento", read: false,
            });
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
