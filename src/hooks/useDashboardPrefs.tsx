import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

export interface DashPrefs {
  widgets: Record<string, boolean>;
  actions: Record<string, boolean>;
}

export const DASH_DEFAULTS: DashPrefs = {
  // agenda e KPIs são fixos (núcleo); o resto é configurável
  widgets: { produtividade: true, financeiro: true, grafico: true, atividade: true, metas: false },
  actions: { processo: true, prazo: true, agendar: true, cliente: true, timesheet: false, atendimento: false, audiencia: false },
};

/** Preferências do dashboard por usuário (persistidas no localStorage). */
export function useDashboardPrefs() {
  const { user } = useAuth();
  const key = `dash_prefs_${user?.id || "anon"}`;
  const [prefs, setPrefs] = useState<DashPrefs>(DASH_DEFAULTS);

  useEffect(() => {
    try {
      const s = localStorage.getItem(key);
      if (s) {
        const p = JSON.parse(s);
        setPrefs({
          widgets: { ...DASH_DEFAULTS.widgets, ...(p.widgets || {}) },
          actions: { ...DASH_DEFAULTS.actions, ...(p.actions || {}) },
        });
      } else {
        setPrefs(DASH_DEFAULTS);
      }
    } catch { /* ignore */ }
  }, [key]);

  const toggle = (group: "widgets" | "actions", k: string, v: boolean) => {
    setPrefs((prev) => {
      const next = { ...prev, [group]: { ...prev[group], [k]: v } };
      try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  return { prefs, toggle };
}
