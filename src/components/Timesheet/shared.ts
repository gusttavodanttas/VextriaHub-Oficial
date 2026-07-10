// Configs e helpers puros do módulo Timesheet — extraídos de pages/Timesheet.tsx.
import React from "react";
import {
  Phone, Scale, Users, FileText, Gavel, BookOpen, Search,
  AlertCircle, CheckSquare, MessageSquareText,
} from "lucide-react";
import { roundMinutes, type Arredondamento } from "@/hooks/useTimesheetConfig";
import { type TimesheetCategoria } from "@/types/timesheet";

// ─── Configs ──────────────────────────────────────────────────────────────────

const CATEGORIA_CONFIG: Record<TimesheetCategoria, { label: string; Icon: React.FC<any>; color: string; border: string }> = {
  atendimento:    { label: "Atendimento",    Icon: Phone,      color: "bg-blue-500/10 text-blue-600 dark:text-blue-400",       border: "border-l-blue-500" },
  processo:       { label: "Processo",       Icon: Scale,      color: "bg-violet-500/10 text-violet-600 dark:text-violet-400", border: "border-l-violet-500" },
  reuniao:        { label: "Reunião",        Icon: Users,      color: "bg-teal-500/10 text-teal-600 dark:text-teal-400",       border: "border-l-teal-500" },
  administrativa: { label: "Administrativa", Icon: FileText,   color: "bg-orange-500/10 text-orange-600 dark:text-orange-400", border: "border-l-orange-500" },
  audiencia:      { label: "Audiência",      Icon: Gavel,      color: "bg-red-500/10 text-red-600 dark:text-red-400",          border: "border-l-red-500" },
  peticao:        { label: "Petição",        Icon: FileText,   color: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400", border: "border-l-indigo-500" },
  consulta:       { label: "Consulta",       Icon: BookOpen,   color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", border: "border-l-emerald-500" },
  pesquisa:       { label: "Pesquisa",       Icon: Search,     color: "bg-amber-500/10 text-amber-600 dark:text-amber-400",    border: "border-l-amber-500" },
};

type ReferenciaTipo = "atendimento" | "audiencia" | "prazo" | "tarefa" | "consultivo";

const REFERENCIA_CONFIG: Record<ReferenciaTipo, {
  label: string; Icon: React.FC<any>; color: string;
  table: string; labelField: string; dateField?: string;
  clienteField?: string; route: string;
}> = {
  atendimento: { label: "Atendimento", Icon: Phone,             color: "bg-blue-500/10 text-blue-600 dark:text-blue-400",          table: "atendimentos", labelField: "observacoes", dateField: "data_atendimento", clienteField: "cliente_id", route: "/atendimentos" },
  audiencia:   { label: "Audiência",   Icon: Gavel,             color: "bg-red-500/10 text-red-600 dark:text-red-400",             table: "audiencias",   labelField: "titulo",      dateField: "data_audiencia",   clienteField: "cliente_id", route: "/audiencias" },
  prazo:       { label: "Prazo",       Icon: AlertCircle,       color: "bg-orange-500/10 text-orange-600 dark:text-orange-400",    table: "prazos",       labelField: "titulo",      dateField: "data_vencimento",  route: "/prazos" },
  tarefa:      { label: "Tarefa",      Icon: CheckSquare,       color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", table: "tarefas",      labelField: "titulo",      dateField: "data_vencimento",  clienteField: "cliente_id", route: "/tarefas" },
  consultivo:  { label: "Consultivo",  Icon: MessageSquareText, color: "bg-teal-500/10 text-teal-600 dark:text-teal-400",          table: "processos",    labelField: "titulo",      dateField: "created_at",       clienteField: "cliente_id", route: "/consultivo" },
};

interface ReferenciaItem { id: string; label: string; sublabel?: string }

const CATEGORIA_TO_REF: Partial<Record<TimesheetCategoria, ReferenciaTipo>> = {
  atendimento: "atendimento", audiencia: "audiencia", processo: "consultivo", peticao: "consultivo", consulta: "atendimento",
};
const REF_LIVRES: ReferenciaTipo[] = ["prazo", "tarefa"];

const PERIODOS = [
  { v: 7, l: "7 dias" }, { v: 30, l: "30 dias" }, { v: 90, l: "90 dias" }, { v: 365, l: "1 ano" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatSeconds(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
}
function formatMinutes(min: number) {
  const h = Math.floor(min / 60), m = min % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}
const formatBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const valorDe = (t: any, arred: Arredondamento = "nenhum") =>
  t.faturavel !== false && t.valor_hora && t.duracao_minutos
    ? (roundMinutes(t.duracao_minutos, arred) / 60) * t.valor_hora
    : 0;

function formatDateHeader(dateStr: string) {
  const d = new Date(dateStr), today = new Date(), yst = new Date(today);
  yst.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Hoje";
  if (d.toDateString() === yst.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
}

const NONE = "__none__";

export {
  NONE, CATEGORIA_CONFIG, REFERENCIA_CONFIG, CATEGORIA_TO_REF, REF_LIVRES, PERIODOS,
  formatSeconds, formatMinutes, formatBRL, valorDe, formatDateHeader,
};
export type { ReferenciaTipo, ReferenciaItem };
