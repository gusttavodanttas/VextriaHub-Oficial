import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type MyTeam = {
  id: string;
  name: string;
  color: string;
  description: string | null;
  myRole: "coordinator" | "member";
  memberIds: string[]; // user_ids de todos os membros da equipe
};

/**
 * Retorna as equipes do usuário logado com seu papel e os user_ids dos membros.
 * Usado para filtrar conteúdo e verificar se o usuário é coordenador.
 */
export function useMyTeams() {
  const { user } = useAuth();
  const [teams, setTeams] = useState<MyTeam[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user?.id || !user?.office_id) { setTeams([]); setLoading(false); return; }
    setLoading(true);

    // Busca as equipes que o usuário participa
    const { data: myMemberships } = await supabase
      .from("office_team_members")
      .select("team_id, role, office_teams(id, name, color, description)")
      .eq("user_id", user.id)
      .eq("office_id", user.office_id);

    if (!myMemberships?.length) { setTeams([]); setLoading(false); return; }

    // Para cada equipe, busca todos os membros
    const teamIds = myMemberships.map(m => m.team_id);
    const { data: allMembers } = await supabase
      .from("office_team_members")
      .select("team_id, user_id")
      .in("team_id", teamIds);

    const membersByTeam = new Map<string, string[]>();
    (allMembers || []).forEach(m => {
      if (!membersByTeam.has(m.team_id)) membersByTeam.set(m.team_id, []);
      membersByTeam.get(m.team_id)!.push(m.user_id);
    });

    setTeams(
      myMemberships.map(m => ({
        id: m.team_id,
        name: (m.office_teams as any)?.name ?? "",
        color: (m.office_teams as any)?.color ?? "#3b82f6",
        description: (m.office_teams as any)?.description ?? null,
        myRole: m.role as "coordinator" | "member",
        memberIds: membersByTeam.get(m.team_id) ?? [],
      }))
    );
    setLoading(false);
  }, [user?.id, user?.office_id]);

  useEffect(() => { fetch(); }, [fetch]);

  const isCoordinatorOf = (teamId: string) =>
    teams.find(t => t.id === teamId)?.myRole === "coordinator";

  const isAnyCoordinator = teams.some(t => t.myRole === "coordinator");

  // Todos os user_ids que o usuário coordena (de todas as equipes onde é coordenador)
  const coordinatedMemberIds = [
    ...new Set(
      teams
        .filter(t => t.myRole === "coordinator")
        .flatMap(t => t.memberIds)
    ),
  ];

  // Todos os user_ids de todas as equipes do usuário (para filtro de conteúdo)
  const allTeamMemberIds = [...new Set(teams.flatMap(t => t.memberIds))];

  return { teams, loading, isCoordinatorOf, isAnyCoordinator, coordinatedMemberIds, allTeamMemberIds, refetch: fetch };
}
