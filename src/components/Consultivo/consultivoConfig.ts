import type React from "react";
import {
  FileText, Scale, Briefcase, Users, TrendingUp, AlertTriangle, Clock, X,
  CheckCircle2, BookOpen, Star, Landmark, Shield, Gavel,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Configuração estática da aba Consultivo: ícones e cores disponíveis para
// categorias, categorias padrão, prioridades e status. Sem estado nem Supabase.

export const ICON_OPTIONS: { value: string; Icon: React.ElementType; label: string }[] = [
  { value: "FileText",      Icon: FileText,      label: "Documento" },
  { value: "Scale",         Icon: Scale,         label: "Balança" },
  { value: "Briefcase",     Icon: Briefcase,     label: "Maleta" },
  { value: "Users",         Icon: Users,         label: "Pessoas" },
  { value: "TrendingUp",    Icon: TrendingUp,    label: "Gráfico" },
  { value: "AlertTriangle", Icon: AlertTriangle, label: "Alerta" },
  { value: "Clock",         Icon: Clock,         label: "Relógio" },
  { value: "BookOpen",      Icon: BookOpen,      label: "Livro" },
  { value: "Star",          Icon: Star,          label: "Estrela" },
  { value: "Landmark",      Icon: Landmark,      label: "Tribunal" },
  { value: "Shield",        Icon: Shield,        label: "Escudo" },
  { value: "Gavel",         Icon: Gavel,         label: "Martelo" },
];

export const COLOR_OPTIONS: { value: string; label: string; color: string; bg: string; border: string }[] = [
  { value: "blue",    label: "Azul",     color: "text-blue-500",    bg: "bg-blue-500/10",    border: "border-l-blue-500" },
  { value: "violet",  label: "Violeta",  color: "text-violet-500",  bg: "bg-violet-500/10",  border: "border-l-violet-500" },
  { value: "emerald", label: "Verde",    color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-l-emerald-500" },
  { value: "amber",   label: "Âmbar",   color: "text-amber-500",   bg: "bg-amber-500/10",   border: "border-l-amber-500" },
  { value: "rose",    label: "Rosa",     color: "text-rose-500",    bg: "bg-rose-500/10",    border: "border-l-rose-500" },
  { value: "indigo",  label: "Índigo",   color: "text-indigo-500",  bg: "bg-indigo-500/10",  border: "border-l-indigo-500" },
  { value: "red",     label: "Vermelho", color: "text-red-500",     bg: "bg-red-500/10",     border: "border-l-red-500" },
  { value: "teal",    label: "Teal",     color: "text-teal-500",    bg: "bg-teal-500/10",    border: "border-l-teal-500" },
  { value: "orange",  label: "Laranja",  color: "text-orange-500",  bg: "bg-orange-500/10",  border: "border-l-orange-500" },
  { value: "pink",    label: "Rosa",     color: "text-pink-500",    bg: "bg-pink-500/10",    border: "border-l-pink-500" },
];

export function getColorCfg(cor: string | null | undefined) {
  return COLOR_OPTIONS.find(c => c.value === cor) ?? COLOR_OPTIONS[0];
}
export function getIconEl(icone: string | null | undefined): React.ElementType {
  return ICON_OPTIONS.find(i => i.value === icone)?.Icon ?? FileText;
}

/** Forma mínima de uma categoria para a UI (vale para as do banco, as padrão e as órfãs sintetizadas). */
export type CatCfg = { valor: string; label: string; cor: string | null; icone: string | null };

// ─── default categories (used when office has none yet) ───────────────────

export const DEFAULT_CATS = [
  { valor: "contratos",      label: "Contratos",      cor: "blue",    icone: "FileText" },
  { valor: "trabalhista",    label: "Trabalhista",    cor: "amber",   icone: "Users" },
  { valor: "tributario",     label: "Tributário",     cor: "violet",  icone: "TrendingUp" },
  { valor: "civil",          label: "Civil",          cor: "emerald", icone: "Scale" },
  { valor: "empresarial",    label: "Empresarial",    cor: "indigo",  icone: "Briefcase" },
  { valor: "familiar",       label: "Familiar",       cor: "rose",    icone: "Users" },
  { valor: "criminal",       label: "Criminal",       cor: "red",     icone: "AlertTriangle" },
  { valor: "previdenciario", label: "Previdenciário", cor: "teal",    icone: "Clock" },
];

// ─── prioridade / status ──────────────────────────────────────────────────

export const PRIORIDADES = [
  { value: "alta",  label: "Alta",  cls: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20" },
  { value: "media", label: "Média", cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" },
  { value: "baixa", label: "Baixa", cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
];

export const STATUS_MAP = [
  { value: "pendente",     label: "Pendente",     cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",        Icon: Clock },
  { value: "em_andamento", label: "Em Andamento", cls: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",            Icon: TrendingUp },
  { value: "concluido",    label: "Concluído",    cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20", Icon: CheckCircle2 },
  { value: "cancelado",    label: "Cancelado",    cls: "bg-slate-500/10 text-slate-500 border-slate-500/20",                            Icon: X },
];

export function getPriCls(p: string | null) {
  return PRIORIDADES.find(x => x.value === p)?.cls ?? "bg-muted text-muted-foreground border-border";
}
export function getStatusCfg(s: string | null) {
  return STATUS_MAP.find(x => x.value === s) ?? STATUS_MAP[0];
}
export function fmtDate(d: string | null | undefined) {
  if (!d) return "";
  try { return format(new Date(d), "dd/MM/yyyy", { locale: ptBR }); }
  catch { return d; }
}

// ─── formulário de consultivo ─────────────────────────────────────────────

export const BLANK_FORM = {
  titulo: "", descricao: "", categoria: "", prioridade: "media",
  status: "pendente", tags: "", observacoes: "", cliente_id: "", responsavel_id: "", prazo: "",
};
export type ConsultivoForm = typeof BLANK_FORM;
