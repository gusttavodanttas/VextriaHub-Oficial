import type React from "react";
import {
  FileText, CheckSquare, Calendar, MessageSquare, BookOpen, AlertCircle,
} from "lucide-react";

// Tipos e helpers puros do painel de detalhe da equipe (EquipeDetalhe).

// Lança se a consulta falhou — nas listas de detalhe/atribuição, erro virava
// "nenhum item", indistinguível de vazio de verdade.
export function rowsOrThrow<T>(res: { data: T[] | null; error: unknown }): T[] {
  if (res.error) throw res.error;
  return res.data || [];
}

// ─── Drill-down ─────────────────────────────────────────────────────────────
export type DetailType = "processos" | "tarefas" | "audiencias" | "prazos" | "atendimentos" | "consultivos";

export const DETAIL_CONFIG: Record<DetailType, { title: string; route: string; icon: React.ElementType; color: string }> = {
  processos:    { title: "Processos ativos",   route: "/processos",  icon: FileText,      color: "text-blue-500" },
  tarefas:      { title: "Tarefas abertas",    route: "/tarefas",    icon: CheckSquare,   color: "text-violet-500" },
  audiencias:   { title: "Audiências (7 dias)", route: "/audiencias", icon: Calendar,      color: "text-emerald-500" },
  prazos:       { title: "Prazos (3 dias)",    route: "/prazos",     icon: AlertCircle,   color: "text-amber-500" },
  atendimentos: { title: "Atendimentos",       route: "/atendimentos", icon: MessageSquare, color: "text-rose-500" },
  consultivos:  { title: "Consultivos",        route: "/consultivo", icon: BookOpen,      color: "text-cyan-500" },
};

export function fmtDate(d: string | null | undefined) {
  if (!d) return "";
  // Ancora data-only ao MEIO-DIA local: new Date("YYYY-MM-DD")=UTC mostrava 1 dia antes. (v12)
  const dt = new Date(String(d).length <= 10 ? `${d}T12:00:00` : String(d));
  return isNaN(dt.getTime()) ? "" : dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export type Period = "week" | "month" | "quarter" | "year";
export type SortKey = "processos" | "tarefasPendentes" | "tarefasConcluidas" | "audiencias" | "atendimentos" | "horasTimesheet";

export const PERIOD_LABEL: Record<Period, string> = {
  week: "Esta semana", month: "Este mês", quarter: "Últimos 3 meses", year: "Este ano",
};

export function getPeriodDates(period: Period) {
  const now = new Date();
  const end = new Date(now);
  let start: Date;
  switch (period) {
    case "week":
      start = new Date(now); start.setDate(now.getDate() - 7); break;
    case "month":
      start = new Date(now.getFullYear(), now.getMonth(), 1); break;
    case "quarter":
      start = new Date(now); start.setMonth(now.getMonth() - 3); break;
    case "year":
      start = new Date(now.getFullYear(), 0, 1); break;
  }
  return { start: start.toISOString(), end: end.toISOString(), startDate: start.toISOString().split("T")[0], endDate: end.toISOString().split("T")[0] };
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TeamSummary {
  processos: number;
  tarefasPendentes: number;
  tarefasConcluidas: number;
  audiencias: number;
  prazos: number;
  atendimentos: number;
  consultivos: number;
  horasTimesheet: number;
}

export interface MemberStats extends TeamSummary {
  user_id: string;
  full_name: string | null;
  email: string | null;
  role: "coordinator" | "member";
}

export const EMPTY_SUMMARY: TeamSummary = {
  processos: 0, tarefasPendentes: 0, tarefasConcluidas: 0,
  audiencias: 0, prazos: 0, atendimentos: 0, consultivos: 0, horasTimesheet: 0,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "bg-blue-500","bg-violet-500","bg-emerald-500","bg-amber-500",
  "bg-rose-500","bg-cyan-500","bg-fuchsia-500","bg-orange-500",
];

export function avatarColor(id: string) {
  let n = 0;
  for (let i = 0; i < id.length; i++) n += id.charCodeAt(i);
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}

export function getInitials(name: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
