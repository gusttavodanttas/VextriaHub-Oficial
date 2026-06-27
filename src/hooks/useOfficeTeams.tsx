import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type OfficeTeam = {
  id: string;
  office_id: string;
  name: string;
  color: string;
  description: string | null;
  created_at: string;
  member_count?: number;
};

export type TeamMember = {
  id: string;
  team_id: string;
  user_id: string;
  role: "coordinator" | "member";
  profile?: { full_name: string | null; email: string | null };
};

export function useOfficeTeams() {
  const { office } = useAuth();
  const [teams, setTeams] = useState<OfficeTeam[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!office?.id) { setTeams([]); setLoading(false); return; }
    setLoading(true);
    const { data: teamsData } = await supabase
      .from("office_teams")
      .select("*")
      .eq("office_id", office.id)
      .order("name");

    const { data: countsData } = await supabase
      .from("office_team_members")
      .select("team_id")
      .in("team_id", (teamsData || []).map((t: any) => t.id));

    const countMap: Record<string, number> = {};
    (countsData || []).forEach((m: any) => {
      countMap[m.team_id] = (countMap[m.team_id] || 0) + 1;
    });

    setTeams(
      (teamsData || []).map((t: any) => ({
        ...t,
        member_count: countMap[t.id] ?? 0,
      }))
    );
    setLoading(false);
  }, [office?.id]);

  useEffect(() => { fetch(); }, [fetch]);

  const create = async (name: string, color: string, description?: string) => {
    if (!office?.id) return null;
    const { data, error } = await supabase
      .from("office_teams")
      .insert({ office_id: office.id, name, color, description: description || null })
      .select()
      .single();
    if (!error && data) { setTeams(prev => [...prev, { ...data, member_count: 0 }]); }
    return error ? null : data;
  };

  const update = async (id: string, patch: { name?: string; color?: string; description?: string }) => {
    const { data, error } = await supabase
      .from("office_teams").update(patch).eq("id", id).select().single();
    if (!error && data) setTeams(prev => prev.map(t => t.id === id ? { ...t, ...data } : t));
    return error ? null : data;
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("office_teams").delete().eq("id", id);
    if (!error) setTeams(prev => prev.filter(t => t.id !== id));
    return !error;
  };

  return { teams, loading, create, update, remove, refetch: fetch };
}

export function useTeamMembers(teamId: string | null) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const { office } = useAuth();

  const fetch = useCallback(async () => {
    if (!teamId) { setMembers([]); return; }
    setLoading(true);
    const { data: membersData } = await supabase
      .from("office_team_members")
      .select("*")
      .eq("team_id", teamId);

    if (!membersData?.length) { setMembers([]); setLoading(false); return; }

    const userIds = membersData.map((m: any) => m.user_id);
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("user_id, full_name, email")
      .in("user_id", userIds);

    const profileMap: Record<string, any> = {};
    (profilesData || []).forEach((p: any) => { profileMap[p.user_id] = p; });

    setMembers(
      membersData.map((m: any) => ({
        ...m,
        profile: profileMap[m.user_id] || null,
      }))
    );
    setLoading(false);
  }, [teamId]);

  useEffect(() => { fetch(); }, [fetch]);

  const addMember = async (userId: string, role: "coordinator" | "member" = "member") => {
    if (!teamId || !office?.id) return false;
    const { error } = await supabase
      .from("office_team_members")
      .insert({ team_id: teamId, user_id: userId, office_id: office.id, role });
    if (error) {
      console.error("addMember error:", error);
      return false;
    }
    fetch();
    return true;
  };

  const setMemberRole = async (userId: string, role: "coordinator" | "member") => {
    if (!teamId) return false;
    const { error } = await supabase
      .from("office_team_members")
      .update({ role })
      .eq("team_id", teamId)
      .eq("user_id", userId);
    if (!error) setMembers(prev => prev.map(m => m.user_id === userId ? { ...m, role } : m));
    return !error;
  };

  const removeMember = async (userId: string) => {
    if (!teamId) return false;
    const { error } = await supabase
      .from("office_team_members")
      .delete().eq("team_id", teamId).eq("user_id", userId);
    if (!error) setMembers(prev => prev.filter(m => m.user_id !== userId));
    return !error;
  };

  return { members, loading, addMember, removeMember, setMemberRole, refetch: fetch };
}
