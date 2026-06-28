import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMyTeams } from "@/hooks/useMyTeams";

/**
 * Verifica tarefas atrasadas e prazos vencendo para membros das equipes
 * coordenadas pelo usuário logado e insere notificações automaticamente.
 * Executa uma vez por sessão (sem polling).
 */
export function useCoordinatorAlerts() {
  const { user } = useAuth();
  const { teams, isAnyCoordinator, coordinatedMemberIds } = useMyTeams();

  useEffect(() => {
    if (!user?.id || !user?.office_id || !isAnyCoordinator || !coordinatedMemberIds.length) return;

    const check = async () => {
      const today = new Date().toISOString().split("T")[0];
      const in2days = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      // Chave única para evitar notificações duplicadas no mesmo dia
      const sessionKey = `coord_alerts_${user.id}_${today}`;
      if (sessionStorage.getItem(sessionKey)) return;
      sessionStorage.setItem(sessionKey, "1");

      const [tarefasRes, prazosRes] = await Promise.all([
        // Tarefas atrasadas dos membros coordenados
        supabase.from("tarefas")
          .select("id, titulo, user_id")
          .eq("office_id", user.office_id)
          .eq("deletado", false)
          .eq("concluida", false)
          .lt("data_vencimento", today)
          .in("responsavel_id", coordinatedMemberIds),

        // Prazos vencendo em 2 dias para membros coordenados
        supabase.from("prazos")
          .select("id, tipo_prazo, data_fim_prazo, user_id")
          .eq("office_id", user.office_id)
          .gte("data_fim_prazo", today)
          .lte("data_fim_prazo", in2days)
          .in("user_id", coordinatedMemberIds),
      ]);

      const notifications: any[] = [];

      if ((tarefasRes.data || []).length > 0) {
        const count = tarefasRes.data!.length;
        notifications.push({
          user_id: user.id,
          type: "warning",
          title: `${count} tarefa${count > 1 ? "s atrasadas" : " atrasada"} na equipe`,
          message: `Membros da sua equipe têm tarefa${count > 1 ? "s" : ""} vencida${count > 1 ? "s" : ""} que precisam de atenção.`,
          action_url: "/tarefas",
          action_label: "Ver tarefas",
          read: false,
        });
      }

      if ((prazosRes.data || []).length > 0) {
        const count = prazosRes.data!.length;
        notifications.push({
          user_id: user.id,
          type: "warning",
          title: `${count} prazo${count > 1 ? "s" : ""} vencendo em 2 dias`,
          message: `Membros da sua equipe têm prazo${count > 1 ? "s" : ""} crítico${count > 1 ? "s" : ""} nos próximos 2 dias.`,
          action_url: "/prazos",
          action_label: "Ver prazos",
          read: false,
        });
      }

      if (notifications.length > 0) {
        await supabase.from("notifications").insert(notifications);
      }
    };

    check();
  }, [user?.id, user?.office_id, isAnyCoordinator, coordinatedMemberIds.join(",")]);
}
