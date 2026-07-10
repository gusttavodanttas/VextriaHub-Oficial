// Constantes, tipos e helpers do módulo Financeiro — extraídos de
// pages/Financeiro.tsx (código idêntico; movido para reuso e leitura).
import { format } from "date-fns";

// ─── Constants ───────────────────────────────────────────────────────────────

const NONE = "__none__";

const DEFAULT_CATEGORIAS_RECEITA = ["Honorários", "Consulta", "Êxito", "Outros"];
const DEFAULT_CATEGORIAS_DESPESA = ["Custas", "Diligências", "Despesas de Escritório", "Outros"];

// ─── Types ───────────────────────────────────────────────────────────────────

type StatusType = "pendente" | "pago" | "vencido" | "cancelado";
type TipoType = "receita" | "despesa";

interface FinanceiroItem {
  id: string;
  tipo: TipoType;
  descricao: string;
  valor: number;
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
  modo: "unico",
  parcelas: "2",
  recorrencia: "mensal",
  meses_recorrencia: "12",
});
// ─── Helpers ─────────────────────────────────────────────────────────────────

const statusConfig: Record<StatusType, { label: string; className: string }> = {
  pago:      { label: "Pago",      className: "border-emerald-500/50 text-emerald-500 bg-emerald-500/10 font-bold" },
  pendente:  { label: "Pendente",  className: "border-yellow-500/50 text-yellow-500 bg-yellow-500/10 font-bold" },
  vencido:   { label: "Vencido",   className: "border-red-500/50 text-red-500 bg-red-500/10 font-bold" },
  cancelado: { label: "Cancelado", className: "border-muted/30 text-muted-foreground bg-muted/10 font-bold" },
};

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export { NONE, DEFAULT_CATEGORIAS_RECEITA, DEFAULT_CATEGORIAS_DESPESA, toNull, defaultForm, statusConfig, fmt };
export type { StatusType, TipoType, FinanceiroItem, ClienteOption, ProcessoOption, ModoLancamento, RecorrenciaTipo, FormState };
