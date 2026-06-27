import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type PermissionOverride = { permission_key: string; granted: boolean };

export function useUserPermissions(targetUserId: string | null) {
  const [overrides, setOverrides] = useState<PermissionOverride[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const fetch = useCallback(async () => {
    if (!targetUserId || !user?.office_id) { setOverrides([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from("user_permissions")
      .select("permission_key, granted")
      .eq("office_id", user.office_id)
      .eq("user_id", targetUserId);
    setOverrides(data || []);
    setLoading(false);
  }, [targetUserId, user?.office_id]);

  useEffect(() => { fetch(); }, [fetch]);

  const setPermission = async (permissionKey: string, granted: boolean) => {
    if (!targetUserId || !user?.office_id) return;
    await supabase.from("user_permissions").upsert(
      { office_id: user.office_id, user_id: targetUserId, permission_key: permissionKey, granted, updated_at: new Date().toISOString() },
      { onConflict: "office_id,user_id,permission_key" }
    );
    setOverrides(prev => {
      const without = prev.filter(o => o.permission_key !== permissionKey);
      return [...without, { permission_key: permissionKey, granted }];
    });
  };

  const resetAll = async () => {
    if (!targetUserId || !user?.office_id) return;
    await supabase.from("user_permissions")
      .delete()
      .eq("office_id", user.office_id)
      .eq("user_id", targetUserId);
    setOverrides([]);
  };

  return { overrides, loading, setPermission, resetAll, refetch: fetch };
}

// Hook para carregar overrides do próprio usuário logado (usado no usePermissions)
export function useMyPermissionOverrides() {
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id || !user?.office_id) { setOverrides({}); setLoaded(true); return; }
    supabase.from("user_permissions")
      .select("permission_key, granted")
      .eq("office_id", user.office_id)
      .eq("user_id", user.id)
      .then(({ data }) => {
        const map: Record<string, boolean> = {};
        (data || []).forEach(r => { map[r.permission_key] = r.granted; });
        setOverrides(map);
        setLoaded(true);
      });
  }, [user?.id, user?.office_id]);

  return { overrides, loaded };
}
