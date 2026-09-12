// Constantes, tipos e helpers do módulo Financeiro — extraídos de
// pages/Financeiro.tsx (código idêntico; movido para reuso e leitura).
import { format } from "date-fns";
import { formatBRL } from "@/lib/currency";

// ─── Constants ───────────────────────────────────────────────────────────────

const NONE = "__none__";

const DEFAULT_CATEGORIAS_RECEITA = ["Honorários", "Consulta", "Êxito", "Outros"];
const DEFAULT_CATEGORIAS_DESPESA = ["Custas", "Diligências", "Despesas de Escritório", "Outros"];

// ─── Types ───────────────────────────────────────────────────────────────────

type StatusType = "pendente" | "pago" | "vencido" | "parcial" | "cancelado";
type TipoType = "receita" | "despesa";
type EscopoType = "pj" | "pf";
// Grupos de prioridade são customizáveis por escritório (ver DEFAULT_GRUPOS_PRIORIDADE
// e useFinanceiroGruposPrioridade) — o valor gravado em `financeiro.prioridade` é o
// `id` do grupo, um texto livre, não mais um enum fixo.
type PrioridadeType = string;

interface PrioridadeGrupo { id: string; label: string; }

interface FinanceiroItem {
  id: string;
  tipo: TipoType;
  descricao: string;
  valor: number;
  valor_pago?: number | null;
  data_vencimento: string;
  data_pagamento: string | null;
  status: StatusType;
  categoria: string | null;
  cliente_id: string | null;
  processo_id: string | null;
  user_id: string;
  office_id: string;
  deletado: boolean;
  grupo_id?: string | null;
  parcela_numero?: number | null;
  parcela_total?: number | null;
  recorrencia?: string | null;
  escopo: EscopoType;
  prioridade?: PrioridadeType | null;
  clientes?: { nome: string } | null;
}

interface ClienteOption { id: string; nome: string; }
interface ProcessoOption { id: string; titulo: string; numero: string; }

type ModoLancamento = "unico" | "parcelado" | "recorrente";
type RecorrenciaTipo = "mensal" | "semanal" | "quinzenal";

interface FormState {
  tipo: TipoType;
  descricao: string;
  valor: string;
  data_vencimento: string;
  status: StatusType;
  categoria: string;
  cliente_id: string;
  processo_id: string;
  escopo: EscopoType;
  prioridade: PrioridadeType | typeof NONE;
  valor_pago: string; // só usado quando status = "parcial"
  // Recorrência / parcelamento
  modo: ModoLancamento;
  parcelas: string;        // número de parcelas (parcelado)
  recorrencia: RecorrenciaTipo; // frequência (recorrente)
  meses_recorrencia: string;   // quantos meses gerar (recorrente)
}

// Converte qualquer valor falsy/NONE para null para enviar ao DB
const toNull = (v: string | null | undefined) =>
  !v || v === NONE || v.trim() === "" ? null : v;

const defaultForm = (tipo: TipoType = "receita"): FormState => ({
  tipo,
  descricao: "",
  valor: "",
  data_vencimento: format(new Date(), "yyyy-MM-dd"),
  status: "pendente",
  categoria: NONE,
  cliente_id: NONE,
  processo_id: NONE,
  escopo: "pj",
  prioridade: NONE,
  valor_pago: "",
  modo: "unico",
  parcelas: "2",
  recorrencia: "mensal",
  meses_recorrencia: "12",
});
// ─── Helpers ─────────────────────────────────────────────────────────────────

const statusConfig: Record<StatusType, { label: string; className: string }> = {
  pago:      { label: "Pago",      className: "border-emerald-500/50 text-emerald-500 bg-emerald-500/10 font-bold" },
  pendente:  { label: "Pendente",  className: "border-yellow-500/50 text-yellow-500 bg-yellow-500/10 font-bold" },
  parcial:   { label: "Parcial",   className: "border-sky-500/50 text-sky-500 bg-sky-500/10 font-bold" },
  vencido:   { label: "Vencido",   className: "border-red-500/50 text-red-500 bg-red-500/10 font-bold" },
  cancelado: { label: "Cancelado", className: "border-muted/30 text-muted-foreground bg-muted/10 font-bold" },
};

const escopoConfig: Record<EscopoType, { label: string; className: string }> = {
  pj: { label: "Escritório", className: "border-blue-500/40 text-blue-500 bg-blue-500/10 font-bold" },
  pf: { label: "Pessoal",    className: "border-violet-500/40 text-violet-500 bg-violet-500/10 font-bold" },
};

// Grupos de prioridade padrão (seed usado quando o escritório ainda não
// customizou a lista em offices.settings.fin_grupos_prioridade).
const DEFAULT_GRUPOS_PRIORIDADE: PrioridadeGrupo[] = [
  { id: "g1", label: "G1 · Essencial" },
  { id: "g2", label: "G2 · Importante" },
  { id: "g3", label: "G3 · Contornável" },
  { id: "esperar", label: "Esperar" },
];

// Paleta cíclica pros badges de prioridade — grupos são customizáveis então não
// dá pra ter uma cor fixa por id como antes; a cor é definida pela posição do
// grupo na lista configurada pelo escritório.
const PRIORIDADE_PALETTE = [
  "border-red-500/40 text-red-500 bg-red-500/10 font-bold",
  "border-orange-500/40 text-orange-500 bg-orange-500/10 font-bold",
  "border-slate-400/40 text-slate-500 bg-slate-400/10 font-bold",
  "border-amber-500/40 text-amber-600 bg-amber-500/10 font-bold",
  "border-violet-500/40 text-violet-500 bg-violet-500/10 font-bold",
  "border-blue-500/40 text-blue-500 bg-blue-500/10 font-bold",
];

const prioridadeBadgeClassName = (index: number) =>
  PRIORIDADE_PALETTE[index % PRIORIDADE_PALETTE.length];

// Versão suave da mesma paleta, pro fundo dos cartões da aba Priorização.
const PRIORIDADE_ACCENT_PALETTE = [
  "border-red-500/30 bg-red-500/5",
  "border-orange-500/30 bg-orange-500/5",
  "border-slate-400/30 bg-slate-400/5",
  "border-amber-500/30 bg-amber-500/5",
  "border-violet-500/30 bg-violet-500/5",
  "border-blue-500/30 bg-blue-500/5",
];

const prioridadeAccentClassName = (index: number) =>
  PRIORIDADE_ACCENT_PALETTE[index % PRIORIDADE_ACCENT_PALETTE.length];

const findPrioridadeGrupo = (grupos: PrioridadeGrupo[], id: string | null | undefined) =>
  id ? grupos.find((g) => g.id === id) : undefined;

// Quanto já foi efetivamente pago/recebido de um lançamento. Registros antigos
// (antes do pagamento parcial existir) não têm valor_pago gravado — nesse caso,
// status "pago" implica que o valor total já foi quitado.
const valorPago = (item: Pick<FinanceiroItem, "status" | "valor" | "valor_pago">) =>
  item.valor_pago ?? (item.status === "pago" ? item.valor : 0);

const saldoRestante = (item: Pick<FinanceiroItem, "status" | "valor" | "valor_pago">) =>
  Math.max(0, item.valor - valorPago(item));

const fmt = (v: number) => formatBRL(v); // 2 casas = mesmo comportamento do toLocaleString anterior

export {
  NONE, DEFAULT_CATEGORIAS_RECEITA, DEFAULT_CATEGORIAS_DESPESA, DEFAULT_GRUPOS_PRIORIDADE,
  toNull, defaultForm, statusConfig, escopoConfig, prioridadeBadgeClassName, prioridadeAccentClassName,
  findPrioridadeGrupo, valorPago, saldoRestante, fmt,
};
export type { StatusType, TipoType, EscopoType, PrioridadeType, PrioridadeGrupo, FinanceiroItem, ClienteOption, ProcessoOption, ModoLancamento, RecorrenciaTipo, FormState };
