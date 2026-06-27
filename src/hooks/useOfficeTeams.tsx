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
  profile?: { full_name: string | null; email: string | null };
};

export function useOfficeTeams() {
  const { office } = useAuth();
  const [teams, setTeams] = useState<OfficeTeam[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!office?.id) { setTeams([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("office_teams")
      .select("*, office_team_members(count)")
      .eq("office_id", office.id)
      .order("name");
    setTeams(
      (data || []).map((t: any) => ({
        ...t,
        member_count: t.office_team_members?.[0]?.count ?? 0,
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
    const { data } = await supabase
      .from("office_team_members")
      .select("*, profiles(full_name, email)")
      .eq("team_id", teamId);
    setMembers(
      (data || []).map((m: any) => ({
        ...m,
        profile: m.profiles,
      }))
    );
    setLoading(false);
  }, [teamId]);

  useEffect(() => { fetch(); }, [fetch]);

  const addMember = async (userId: string) => {
    if (!teamId || !office?.id) return false;
    const { error } = await supabase
      .from("office_team_members")
      .upsert({ team_id: teamId, user_id: userId, office_id: office.id }, { onConflict: "team_id,user_id" });
    if (!error) fetch();
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

  return { members, loading, addMember, removeMember, refetch: fetch };
}
