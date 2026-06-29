import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

export interface DashPrefs {
  widgets: Record<string, boolean>;
  order: string[];
  actions: Record<string, boolean>;
}

export const BLOCK_LABELS: Record<string, string> = {
  agenda: "Agenda / Calendário",
  produtividade: "Sua Produtividade",
  financeiro: "Financeiro do Mês",
  grafico: "Gráfico Receita x Despesa",
  atividade: "Atividade Recente",
  metas: "Metas",
};

export const DASH_DEFAULTS: DashPrefs = {
  widgets: { agenda: true, produtividade: true, financeiro: true, grafico: true, atividade: true, metas: false },
  order: ["agenda", "produtividade", "financeiro", "grafico", "atividade", "metas"],
  actions: { processo: true, prazo: true, agendar: true, cliente: true, timesheet: false, atendimento: false, audiencia: false },
};

/** Preferências do dashboard por usuário (persistidas no localStorage). */
export function useDashboardPrefs() {
  const { user } = useAuth();
  const key = `dash_prefs_v2_${user?.id || "anon"}`;
  const [prefs, setPrefs] = useState<DashPrefs>(DASH_DEFAULTS);

  useEffect(() => {
    try {
      const s = localStorage.getItem(key);
      if (s) {
        const p = JSON.parse(s);
        // Garante que blocos novos entrem na ordem mesmo em prefs antigas
        const order: string[] = Array.isArray(p.order) ? [...p.order] : [...DASH_DEFAULTS.order];
        DASH_DEFAULTS.order.forEach((k) => { if (!order.includes(k)) order.push(k); });
        setPrefs({
          widgets: { ...DASH_DEFAULTS.widgets, ...(p.widgets || {}) },
          order,
          actions: { ...DASH_DEFAULTS.actions, ...(p.actions || {}) },
        });
      } else {
        setPrefs(DASH_DEFAULTS);
      }
    } catch { /* ignore */ }
  }, [key]);

  const persist = (next: DashPrefs) => {
    setPrefs(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const toggle = (group: "widgets" | "actions", k: string, v: boolean) => {
    persist({ ...prefs, [group]: { ...prefs[group], [k]: v } });
  };

  const move = (k: string, dir: -1 | 1) => {
    const i = prefs.order.indexOf(k);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= prefs.order.length) return;
    const order = [...prefs.order];
    [order[i], order[j]] = [order[j], order[i]];
    persist({ ...prefs, order });
  };

  return { prefs, toggle, move };
}
