// Constantes, tipos e helpers do módulo de Atendimentos — extraídos de
// pages/Atendimentos.tsx (código idêntico; apenas movido para reuso e leitura).
import {
  MessageSquare, Users, Phone, Video, MapPin, Mail, FileText,
  Clock, CheckCircle2, XCircle, AlertCircle,
} from "lucide-react";
import { format, parseISO } from "date-fns";

export const NONE = "__none__";

export const TIPOS_FIXOS = [
  { value: "consulta",         label: "Consulta",        Icon: MessageSquare },
  { value: "reuniao",          label: "Reunião",          Icon: Users },
  { value: "telefonema",       label: "Telefonema",       Icon: Phone },
  { value: "video",            label: "Vídeo",            Icon: Video },
  { value: "presencial",       label: "Presencial",       Icon: MapPin },
  { value: "email",            label: "E-mail",           Icon: Mail },
];

export const STATUS_CONFIG = {
  agendado:  { label: "Agendado",  className: "border-blue-500/50 text-blue-500 bg-blue-500/10",     Icon: Clock },
  realizado: { label: "Realizado", className: "border-emerald-500/50 text-emerald-500 bg-emerald-500/10", Icon: CheckCircle2 },
  cancelado: { label: "Cancelado", className: "border-red-500/50 text-red-500 bg-red-500/10",         Icon: XCircle },
  pendente:  { label: "Pendente",  className: "border-yellow-500/50 text-yellow-500 bg-yellow-500/10", Icon: AlertCircle },
} as const;

export type StatusType = keyof typeof STATUS_CONFIG;

// Proximidade de atendimentos futuros agendados/pendentes
const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
export const diasAteData = (data: Date) =>
  Math.round((startOfDay(data).getTime() - startOfDay(new Date()).getTime()) / 86400000);

export const proximidadeBadge = (item: { data_atendimento: string; status: StatusType }) => {
  if (item.status !== "agendado" && item.status !== "pendente") return null;
  const dias = diasAteData(parseISO(item.data_atendimento));
  if (dias < 0 || dias > 7) return null;
  if (dias === 0) return { label: "Hoje", className: "border-red-500/50 text-red-500 bg-red-500/10" };
  if (dias === 1) return { label: "Amanhã", className: "border-orange-500/50 text-orange-500 bg-orange-500/10" };
  return { label: `Em ${dias} dias`, className: "border-amber-500/50 text-amber-600 bg-amber-500/10" };
};

// Agrupamento temporal dos cards
export const ORDEM_GRUPOS = ["hoje", "semana", "futuros", "passados"] as const;
export type GrupoKey = (typeof ORDEM_GRUPOS)[number];
export const LABEL_GRUPOS: Record<GrupoKey, string> = {
  hoje: "Hoje", semana: "Esta semana", futuros: "Próximos", passados: "Passados",
};
export const grupoDe = (item: { data_atendimento: string }): GrupoKey => {
  const d = diasAteData(parseISO(item.data_atendimento));
  if (d < 0) return "passados";
  if (d === 0) return "hoje";
  if (d <= 7) return "semana";
  return "futuros";
};

// Sobreposição de horários (conflito de agenda do mesmo responsável)
export const DURACAO_PADRAO_MIN = 30;
export const haConflito = (
  startMs: number, durMin: number,
  it: { data_atendimento: string; duracao?: number | null },
) => {
  const end = startMs + (durMin > 0 ? durMin : DURACAO_PADRAO_MIN) * 60000;
  const s2 = parseISO(it.data_atendimento).getTime();
  const d2 = it.duracao && it.duracao > 0 ? it.duracao : DURACAO_PADRAO_MIN;
  const e2 = s2 + d2 * 60000;
  return startMs < e2 && s2 < end;
};

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Atendimento {
  id: string;
  tipo_atendimento: string;
  data_atendimento: string;
  observacoes: string | null;
  status: StatusType;
  cliente_id: string | null;
  processo_id: string | null;
  user_id: string;
  office_id: string;
  deletado: boolean;
  duracao?: number | null;
  avisos_dias?: number[] | null;
  resultado?: string | null;
  responsavel_id?: string | null;
  recorrencia_grupo?: string | null;
  recorrencia_regra?: string | null;
  recorrencia_restantes?: number | null;
  clientes?: { nome: string } | null;
}

export interface ClienteOpt { id: string; nome: string; }
export interface ProcessoOpt { id: string; titulo: string; numero: string; }
export interface MembroOpt { id: string; label: string; }

export interface FormState {
  tipo_atendimento: string;
  data_atendimento: string;
  hora_atendimento: string;
  observacoes: string;
  status: StatusType;
  cliente_id: string;
  processo_id: string;
  responsavel_id: string;
  duracao: string;
  avisos_dias: number[] | null;
  resultado: string;
  recorrencia: string;
  ocorrencias: string;
}

export const toNull = (v: string | null | undefined) =>
  !v || v === NONE || v.trim() === "" ? null : v;

export const defaultForm = (userId = ""): FormState => ({
  tipo_atendimento: NONE,
  data_atendimento: format(new Date(), "yyyy-MM-dd"),
  hora_atendimento: format(new Date(), "HH:mm"),
  observacoes: "",
  status: "agendado",
  cliente_id: NONE,
  processo_id: NONE,
  responsavel_id: userId,
  duracao: "",
  avisos_dias: null,
  resultado: "",
  recorrencia: "nenhuma",
  ocorrencias: "4",
});

export const tipoInfo = (tipo: string, extras: string[] = []) => {
  const fixo = TIPOS_FIXOS.find((t) => t.value === tipo);
  if (fixo) return fixo;
  if (extras.includes(tipo)) return { value: tipo, label: tipo, Icon: FileText };
  return { value: tipo, label: tipo, Icon: FileText };
};
