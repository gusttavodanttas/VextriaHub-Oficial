import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { PermissionGuard } from "@/components/Auth/PermissionGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  CreditCard,
  CheckCircle2,
  Pencil,
  Trash2,
  Plus,
  Search,
  AlertCircle,
  Calendar,
  Loader2,
  Settings2,
  X,
  Repeat,
  Layers,
} from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  parseISO,
  isAfter,
  isBefore,
  addMonths,
  addWeeks,
} from "date-fns";
import { cn } from "@/lib/utils";

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

// ─── Hook financeiro ─────────────────────────────────────────────────────────

const useFinanceiro = (officeId: string | null | undefined) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ["financeiro", officeId],
    enabled: !!officeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financeiro")
        .select("*, clientes!cliente_id(nome)")
        .eq("office_id", officeId!)
        .eq("deletado", false)
        .order("data_vencimento", { ascending: true });
      if (error) throw error;
      return (data ?? []) as FinanceiroItem[];
    },
  });

  const invalidate = useCallback(() =>
    queryClient.invalidateQueries({ queryKey: ["financeiro", officeId] }),
    [queryClient, officeId]
  );

  const create = useMutation({
    mutationFn: async (payload: any | any[]) => {
      const { error } = await supabase.from("financeiro").insert(payload);
      if (error) throw error;
    },
    onSuccess: (_d, payload) => {
      invalidate();
      const n = Array.isArray(payload) ? payload.length : 1;
      toast({ title: n > 1 ? `${n} lançamentos criados!` : "Registro criado!" });
    },
    onError: (e: Error) => toast({ title: "Erro ao criar", description: e.message, variant: "destructive" }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...payload }: any) => {
      const { error } = await supabase.from("financeiro").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Registro atualizado!" }); },
    onError: (e: Error) => toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("financeiro").update({ deletado: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Registro excluído!" }); },
    onError: (e: Error) => toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" }),
  });

  const markPago = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("financeiro")
        .update({ status: "pago", data_pagamento: format(new Date(), "yyyy-MM-dd") })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Marcado como pago!" }); },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const cancelarGrupo = useMutation({
    mutationFn: async (grupoId: string) => {
      const hoje = format(new Date(), "yyyy-MM-dd");
      const { error } = await supabase.from("financeiro")
        .update({ deletado: true })
        .eq("grupo_id", grupoId)
        .eq("status", "pendente")
        .gte("data_vencimento", hoje);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Lançamentos futuros cancelados." }); },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return { query, create, update, remove, markPago, cancelarGrupo };
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const statusConfig: Record<StatusType, { label: string; className: string }> = {
  pago:      { label: "Pago",      className: "border-emerald-500/50 text-emerald-500 bg-emerald-500/10 font-bold" },
  pendente:  { label: "Pendente",  className: "border-yellow-500/50 text-yellow-500 bg-yellow-500/10 font-bold" },
  vencido:   { label: "Vencido",   className: "border-red-500/50 text-red-500 bg-red-500/10 font-bold" },
  cancelado: { label: "Cancelado", className: "border-muted/30 text-muted-foreground bg-muted/10 font-bold" },
};

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// ─── Gerenciar Categorias Dialog ──────────────────────────────────────────────

interface GerenciarCategoriasProps {
  open: boolean;
  onClose: () => void;
  categoriasReceita: string[];
  categoriasDespesa: string[];
  onSave: (receita: string[], despesa: string[]) => void;
}

const GerenciarCategoriasDialog: React.FC<GerenciarCategoriasProps> = ({
  open, onClose, categoriasReceita, categoriasDespesa, onSave,
}) => {
  const [receita, setReceita] = useState<string[]>([]);
  const [despesa, setDespesa] = useState<string[]>([]);
  const [novaReceita, setNovaReceita] = useState("");
  const [novaDespesa, setNovaDespesa] = useState("");

  useEffect(() => {
    if (open) {
      setReceita([...categoriasReceita]);
      setDespesa([...categoriasDespesa]);
      setNovaReceita("");
      setNovaDespesa("");
    }
  }, [open, categoriasReceita, categoriasDespesa]);

  const addReceita = () => {
    const v = novaReceita.trim();
    if (v && !receita.includes(v)) { setReceita([...receita, v]); setNovaReceita(""); }
  };
  const addDespesa = () => {
    const v = novaDespesa.trim();
    if (v && !despesa.includes(v)) { setDespesa([...despesa, v]); setNovaDespesa(""); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md rounded-3xl border border-black/5 dark:border-border shadow-premium">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-black">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary"><Settings2 className="h-5 w-5" /></div>
            Gerenciar Categorias
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-2">
          {/* Receitas */}
          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Categorias de Receita</p>
            <div className="flex flex-wrap gap-2">
              {receita.map((c) => (
                <span key={c} className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-500/20">
                  {c}
                  <button onClick={() => setReceita(receita.filter((x) => x !== c))} className="hover:text-red-500 transition-colors">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Nova categoria..."
                value={novaReceita}
                onChange={(e) => setNovaReceita(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addReceita())}
                className="rounded-xl text-sm h-9"
              />
              <Button size="sm" onClick={addReceita} className="rounded-xl h-9 px-3">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Despesas */}
          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-orange-500">Categorias de Despesa</p>
            <div className="flex flex-wrap gap-2">
              {despesa.map((c) => (
                <span key={c} className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 text-xs font-bold border border-orange-500/20">
                  {c}
                  <button onClick={() => setDespesa(despesa.filter((x) => x !== c))} className="hover:text-red-500 transition-colors">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Nova categoria..."
                value={novaDespesa}
                onChange={(e) => setNovaDespesa(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addDespesa())}
                className="rounded-xl text-sm h-9"
              />
              <Button size="sm" onClick={addDespesa} className="rounded-xl h-9 px-3">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <Button variant="outline" onClick={onClose} className="flex-1 rounded-xl font-black uppercase text-[10px] tracking-widest">
              Cancelar
            </Button>
            <Button onClick={() => { onSave(receita, despesa); onClose(); }} className="flex-1 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-premium">
              Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ─── Form Dialog ──────────────────────────────────────────────────────────────

interface FormDialogProps {
  open: boolean;
  onClose: () => void;
  initial: FormState;
  editId?: string;
  officeId: string;
  userId: string;
  categoriasReceita: string[];
  categoriasDespesa: string[];
  onSave: (data: any) => void;
  onUpdate: (data: any) => void;
  loading: boolean;
}

const FormDialog: React.FC<FormDialogProps> = ({
  open, onClose, initial, editId, officeId, userId,
  categoriasReceita, categoriasDespesa, onSave, onUpdate, loading,
}) => {
  const [form, setForm] = useState<FormState>(initial);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  useEffect(() => { if (open) setForm(initial); }, [open]);

  const { data: clientes = [] } = useQuery<ClienteOption[]>({
    queryKey: ["clientes-fin", officeId],
    enabled: !!officeId,
    queryFn: async () => {
      const { data } = await supabase.from("clientes").select("id, nome")
        .eq("office_id", officeId).eq("deletado", false).order("nome");
      return (data ?? []) as ClienteOption[];
    },
  });

  const clienteSelecionado = form.cliente_id !== NONE && !!form.cliente_id;

  const { data: processos = [] } = useQuery<ProcessoOption[]>({
    queryKey: ["processos-fin", officeId, form.cliente_id],
    enabled: !!officeId && clienteSelecionado,
    queryFn: async () => {
      const { data } = await supabase.from("processos")
        .select("id, numero_processo, titulo")
        .eq("office_id", officeId)
        .eq("cliente_id", form.cliente_id)
        .eq("deletado", false);
      return (data ?? []).map((p: any) => ({
        id: p.id,
        titulo: p.titulo || p.numero_processo || p.id,
        numero: p.numero_processo || "",
      }));
    },
  });

  const categorias = form.tipo === "receita" ? categoriasReceita : categoriasDespesa;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const valorTotal = parseFloat(form.valor) || 0;
    const base = {
      tipo: form.tipo,
      descricao: form.descricao.trim(),
      status: form.status,
      categoria: toNull(form.categoria),
      cliente_id: toNull(form.cliente_id),
      processo_id: toNull(form.processo_id),
      user_id: userId,
      office_id: officeId,
      data_pagamento: form.status === "pago" ? format(new Date(), "yyyy-MM-dd") : null,
    };

    if (editId) {
      onUpdate({ id: editId, ...base, valor: valorTotal, data_vencimento: form.data_vencimento });
      return;
    }

    const grupo_id = crypto.randomUUID();
    const dataBase = parseISO(form.data_vencimento);

    if (form.modo === "parcelado") {
      const n = Math.max(2, Math.min(120, parseInt(form.parcelas) || 2));
      const valorParcela = Math.round((valorTotal / n) * 100) / 100;
      const rows = Array.from({ length: n }, (_, i) => ({
        ...base,
        valor: i === n - 1 ? Math.round((valorTotal - valorParcela * (n - 1)) * 100) / 100 : valorParcela,
        data_vencimento: format(addMonths(dataBase, i), "yyyy-MM-dd"),
        grupo_id,
        parcela_numero: i + 1,
        parcela_total: n,
        recorrencia: null,
        status: "pendente",
        data_pagamento: null,
        descricao: `${base.descricao} (${i + 1}/${n})`,
      }));
      onSave(rows);
    } else if (form.modo === "recorrente") {
      const meses = Math.max(1, Math.min(120, parseInt(form.meses_recorrencia) || 12));
      const rows = Array.from({ length: meses }, (_, i) => {
        const data = form.recorrencia === "semanal"
          ? addWeeks(dataBase, i)
          : form.recorrencia === "quinzenal"
          ? addWeeks(dataBase, i * 2)
          : addMonths(dataBase, i);
        return {
          ...base,
          valor: valorTotal,
          data_vencimento: format(data, "yyyy-MM-dd"),
          grupo_id,
          parcela_numero: null,
          parcela_total: null,
          recorrencia: form.recorrencia,
          status: "pendente",
          data_pagamento: null,
        };
      });
      onSave(rows);
    } else {
      onSave({ ...base, valor: valorTotal, data_vencimento: form.data_vencimento });
    }
  };

  const isReceita = form.tipo === "receita";
  const accentColor = isReceita ? "emerald" : "orange";
  const valorNum = parseFloat(form.valor) || 0;
  const nParcelas = parseInt(form.parcelas) || 2;
  const nRecorrencia = parseInt(form.meses_recorrencia) || 12;

  // Preview de resumo
  const resumo = (() => {
    if (!valorNum || editId) return null;
    if (form.modo === "parcelado") {
      const pv = Math.round(valorNum / nParcelas * 100) / 100;
      return `${nParcelas}× de ${fmt(pv)} mensais — total ${fmt(valorNum)}`;
    }
    if (form.modo === "recorrente") {
      const freq = form.recorrencia === "semanal" ? "semanais" : form.recorrencia === "quinzenal" ? "quinzenais" : "mensais";
      return `${nRecorrencia} lançamentos ${freq} de ${fmt(valorNum)}`;
    }
    return null;
  })();

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg p-0 rounded-3xl border border-black/5 dark:border-border shadow-premium overflow-hidden">

        {/* Header colorido */}
        <div className={cn(
          "px-7 pt-7 pb-6",
          isReceita
            ? "bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent"
            : "bg-gradient-to-br from-orange-500/10 via-orange-500/5 to-transparent"
        )}>
          {/* Tipo toggle */}
          {!editId && (
            <div className="flex gap-2 mb-5">
              {([
                { value: "receita", label: "Receita", Icon: TrendingUp },
                { value: "despesa", label: "Despesa", Icon: TrendingDown },
              ] as const).map(({ value, label, Icon }) => (
                <button key={value} type="button"
                  onClick={() => { set("tipo", value); set("categoria", NONE); }}
                  className={cn(
                    "flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-widest border transition-all duration-200",
                    form.tipo === value
                      ? value === "receita"
                        ? "bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/25"
                        : "bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-500/25"
                      : "border-black/10 dark:border-border text-muted-foreground hover:border-foreground/20 bg-background/50"
                  )}>
                  <Icon className="h-3.5 w-3.5" />{label}
                </button>
              ))}
            </div>
          )}

          <DialogHeader>
            <DialogTitle className="text-2xl font-black tracking-tight">
              {editId
                ? `Editar ${isReceita ? "Receita" : "Despesa"}`
                : isReceita ? "Nova Receita" : "Nova Despesa"}
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-0.5">
              {editId ? "Altere os dados do lançamento." : isReceita
                ? "Registre um valor a receber ou recebido."
                : "Registre uma despesa ou custo do escritório."}
            </p>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit} className="px-7 pb-7 space-y-5 mt-1">

          {/* Descrição */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Descrição *</Label>
            <Input required value={form.descricao}
              onChange={(e) => set("descricao", e.target.value)}
              className="rounded-xl h-11 text-sm font-medium"
              placeholder={isReceita ? "Ex: Honorários advocatícios" : "Ex: Custas processuais"} />
          </div>

          {/* Valor + Vencimento */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Valor *</Label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-black text-muted-foreground">R$</span>
                <Input required type="number" min="0" step="0.01" value={form.valor}
                  onChange={(e) => set("valor", e.target.value)}
                  className={cn(
                    "rounded-xl h-11 pl-9 text-sm font-bold tabular-nums",
                    valorNum > 0 && (isReceita ? "text-emerald-500" : "text-orange-500")
                  )}
                  placeholder="0,00" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Vencimento *</Label>
              <Input required type="date" value={form.data_vencimento}
                onChange={(e) => set("data_vencimento", e.target.value)}
                className="rounded-xl h-11 text-sm" />
            </div>
          </div>

          {/* Modo lançamento */}
          {!editId && (
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Tipo de lançamento</Label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { value: "unico",      label: "Único",      Icon: DollarSign, desc: "Um lançamento" },
                  { value: "parcelado",  label: "Parcelado",  Icon: Layers,     desc: "Divide em parcelas" },
                  { value: "recorrente", label: "Recorrente", Icon: Repeat,     desc: "Repete periodicamente" },
                ] as const).map(({ value, label, Icon, desc }) => (
                  <button key={value} type="button"
                    onClick={() => set("modo", value)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 p-3 rounded-2xl border text-center transition-all duration-200",
                      form.modo === value
                        ? isReceita
                          ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                          : "bg-orange-500/10 border-orange-500/40 text-orange-600 dark:text-orange-400"
                        : "border-black/8 dark:border-border text-muted-foreground hover:border-foreground/20 hover:bg-muted/30"
                    )}>
                    <Icon className="h-4 w-4" />
                    <span className="text-[11px] font-black uppercase tracking-wide leading-none">{label}</span>
                    <span className="text-[10px] opacity-60 leading-tight">{desc}</span>
                  </button>
                ))}
              </div>

              {/* Parcelado config */}
              {form.modo === "parcelado" && (
                <div className={cn(
                  "rounded-2xl p-4 space-y-3 border",
                  isReceita ? "bg-emerald-500/5 border-emerald-500/20" : "bg-orange-500/5 border-orange-500/20"
                )}>
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Nº de parcelas</Label>
                    {resumo && <span className={cn("text-xs font-bold", isReceita ? "text-emerald-500" : "text-orange-500")}>{resumo}</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    {[2,3,4,6,10,12].map((n) => (
                      <button key={n} type="button"
                        onClick={() => set("parcelas", String(n))}
                        className={cn(
                          "w-9 h-9 rounded-xl text-xs font-black border transition-all",
                          form.parcelas === String(n)
                            ? isReceita ? "bg-emerald-500 text-white border-emerald-500" : "bg-orange-500 text-white border-orange-500"
                            : "border-black/10 dark:border-border text-muted-foreground hover:border-foreground/20"
                        )}>{n}x</button>
                    ))}
                    <Input type="number" min={2} max={120} value={form.parcelas}
                      onChange={(e) => set("parcelas", e.target.value)}
                      className="rounded-xl h-9 w-16 text-center text-xs font-bold" />
                  </div>
                </div>
              )}

              {/* Recorrente config */}
              {form.modo === "recorrente" && (
                <div className={cn(
                  "rounded-2xl p-4 space-y-3 border",
                  isReceita ? "bg-emerald-500/5 border-emerald-500/20" : "bg-orange-500/5 border-orange-500/20"
                )}>
                  {resumo && <p className={cn("text-xs font-bold", isReceita ? "text-emerald-500" : "text-orange-500")}>{resumo}</p>}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Frequência</Label>
                      <Select value={form.recorrencia} onValueChange={(v) => set("recorrencia", v as RecorrenciaTipo)}>
                        <SelectTrigger className="rounded-xl h-9 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mensal">Mensal</SelectItem>
                          <SelectItem value="quinzenal">Quinzenal</SelectItem>
                          <SelectItem value="semanal">Semanal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Gerar por</Label>
                      <div className="flex items-center gap-2">
                        <Input type="number" min={1} max={120} value={form.meses_recorrencia}
                          onChange={(e) => set("meses_recorrencia", e.target.value)}
                          className="rounded-xl h-9 text-center text-sm font-bold" />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {form.recorrencia === "semanal" ? "sem." : form.recorrencia === "quinzenal" ? "quinz." : "meses"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Categoria + Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Categoria</Label>
              <Select value={form.categoria} onValueChange={(v) => set("categoria", v)}>
                <SelectTrigger className="rounded-xl h-11 text-sm"><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Nenhuma</SelectItem>
                  {categorias.filter(c => c && c.trim()).map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v as StatusType)}>
                <SelectTrigger className="rounded-xl h-11 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="vencido">Vencido</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Cliente + Processo */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cliente</Label>
              <Select value={form.cliente_id} onValueChange={(v) => { set("cliente_id", v); set("processo_id", NONE); }}>
                <SelectTrigger className="rounded-xl h-11 text-sm"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Nenhum</SelectItem>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {clienteSelecionado && (
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Processo</Label>
                <Select value={form.processo_id} onValueChange={(v) => set("processo_id", v)}>
                  <SelectTrigger className="rounded-xl h-11 text-sm"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Nenhum</SelectItem>
                    {processos.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.titulo}{p.numero && p.numero !== p.titulo ? ` — ${p.numero}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Botões */}
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" onClick={onClose}
              className="flex-1 rounded-xl h-11 font-black uppercase text-[10px] tracking-widest">
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}
              className={cn(
                "flex-1 rounded-xl h-11 font-black uppercase text-[10px] tracking-widest text-white",
                isReceita
                  ? "bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/25"
                  : "bg-orange-500 hover:bg-orange-600 shadow-lg shadow-orange-500/25"
              )}>
              {loading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : editId
                  ? "Salvar alterações"
                  : form.modo === "parcelado"
                    ? `Criar ${nParcelas} parcelas`
                    : form.modo === "recorrente"
                      ? `Criar ${nRecorrencia} lançamentos`
                      : isReceita ? "Registrar receita" : "Registrar despesa"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// ─── Row ─────────────────────────────────────────────────────────────────────

const FinanceiroRow: React.FC<{
  item: FinanceiroItem;
  onMarkPago: (id: string) => void;
  onEdit: (item: FinanceiroItem) => void;
  onDelete: (id: string) => void;
  onCancelarGrupo: (grupoId: string) => void;
  loadingId: string | null;
}> = ({ item, onMarkPago, onEdit, onDelete, onCancelarGrupo, loadingId }) => {
  const isVencido = item.status === "vencido";
  const cfg = statusConfig[item.status] ?? statusConfig.cancelado;
  const isParcela = !!item.parcela_total;
  const isRecorrente = !!item.recorrencia && !isParcela;

  return (
    <div className={cn(
      "glass-card hover-lift p-5 rounded-2xl border bg-card/40 shadow-premium group flex flex-col sm:flex-row items-start sm:items-center gap-4 transition-all",
      isVencido ? "border-red-500/30" : "border-black/5 dark:border-border"
    )}>
      <div className={cn(
        "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300",
        item.tipo === "receita"
          ? "bg-emerald-500/10 text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white"
          : "bg-orange-500/10 text-orange-500 group-hover:bg-orange-500 group-hover:text-white"
      )}>
        {item.tipo === "receita" ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-black text-base tracking-tight truncate group-hover:text-primary transition-colors">
            {item.descricao}
          </p>
          {isParcela && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-primary/10 text-primary text-[9px] font-black uppercase tracking-widest border border-primary/20">
              <Layers className="h-3 w-3" />
              {item.parcela_numero}/{item.parcela_total}
            </span>
          )}
          {isRecorrente && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-violet-500/10 text-violet-500 text-[9px] font-black uppercase tracking-widest border border-violet-500/20">
              <Repeat className="h-3 w-3" />
              {item.recorrencia}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2 mt-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">
          {item.clientes?.nome && <span>{item.clientes.nome}</span>}
          {item.categoria && item.clientes?.nome && <span className="opacity-40">·</span>}
          {item.categoria && <span>{item.categoria}</span>}
          <span className="opacity-40">·</span>
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3 text-primary" />
            {format(parseISO(item.data_vencimento), "dd/MM/yyyy")}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:ml-auto shrink-0">
        <p className={cn("text-xl font-black tracking-tighter", item.tipo === "receita" ? "text-emerald-500" : "text-orange-500")}>
          {item.tipo === "despesa" && "- "}{fmt(item.valor)}
        </p>

        <Badge className={cn("px-3 py-1 rounded-xl text-[9px] uppercase tracking-widest", cfg.className)}>
          {isVencido && <AlertCircle className="h-3 w-3 mr-1" />}
          {cfg.label}
        </Badge>

        <div className="flex gap-1">
          {item.status !== "pago" && item.status !== "cancelado" && (
            <Button size="icon" variant="ghost"
              className="h-8 w-8 rounded-xl hover:bg-emerald-500/10 hover:text-emerald-500"
              onClick={() => onMarkPago(item.id)} disabled={loadingId === item.id} title="Marcar como pago">
              {loadingId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            </Button>
          )}
          <Button size="icon" variant="ghost"
            className="h-8 w-8 rounded-xl hover:bg-primary/10 hover:text-primary"
            onClick={() => onEdit(item)} title="Editar">
            <Pencil className="h-4 w-4" />
          </Button>
          {item.grupo_id && item.status === "pendente" && (
            <Button size="icon" variant="ghost"
              className="h-8 w-8 rounded-xl hover:bg-red-500/10 hover:text-red-500"
              onClick={() => onCancelarGrupo(item.grupo_id!)} title="Cancelar lançamentos futuros do grupo">
              <X className="h-4 w-4" />
            </Button>
          )}
          <Button size="icon" variant="ghost"
            className="h-8 w-8 rounded-xl hover:bg-red-500/10 hover:text-red-500"
            onClick={() => onDelete(item.id)} title="Excluir">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

// ─── Empty State ──────────────────────────────────────────────────────────────

const EmptyState: React.FC<{ label: string; onNew: () => void }> = ({ label, onNew }) => (
  <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
    <div className="h-16 w-16 rounded-3xl bg-muted/30 flex items-center justify-center">
      <DollarSign className="h-8 w-8 text-muted-foreground/40" />
    </div>
    <p className="text-lg font-black text-muted-foreground/60">{label}</p>
    <Button className="rounded-xl font-black uppercase text-[10px] tracking-widest shadow-premium" onClick={onNew}>
      <Plus className="h-4 w-4 mr-2" />Criar primeiro registro
    </Button>
  </div>
);

const LoadingSkeleton = () => (
  <div className="space-y-3">
    {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}
  </div>
);

// ─── Hook de categorias (persiste em offices.settings no Supabase) ───────────

const useFinanceiroCategorias = (officeId: string) => {
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["office-settings", officeId],
    enabled: !!officeId,
    queryFn: async () => {
      const { data } = await supabase
        .from("offices")
        .select("settings")
        .eq("id", officeId)
        .single();
      const s = (data?.settings as any) ?? {};
      return {
        receita: (s.fin_categorias_receita as string[]) ?? DEFAULT_CATEGORIAS_RECEITA,
        despesa: (s.fin_categorias_despesa as string[]) ?? DEFAULT_CATEGORIAS_DESPESA,
      };
    },
  });

  const save = useCallback(async (receita: string[], despesa: string[]) => {
    const { data: cur } = await supabase.from("offices").select("settings").eq("id", officeId).single();
    const merged = { ...(cur?.settings as any ?? {}), fin_categorias_receita: receita, fin_categorias_despesa: despesa };
    await supabase.from("offices").update({ settings: merged }).eq("id", officeId);
    queryClient.invalidateQueries({ queryKey: ["office-settings", officeId] });
  }, [officeId, queryClient]);

  return {
    categoriasReceita: data?.receita ?? DEFAULT_CATEGORIAS_RECEITA,
    categoriasDespesa: data?.despesa ?? DEFAULT_CATEGORIAS_DESPESA,
    save,
  };
};

// ─── Page ────────────────────────────────────────────────────────────────────

const Financeiro = () => {
  const { user, office } = useAuth();
  const officeId = office?.id ?? user?.office_id ?? "";

  const { query, create, update, remove, markPago, cancelarGrupo } = useFinanceiro(officeId);
  const items = query.data ?? [];

  const { categoriasReceita, categoriasDespesa, save: saveCategorias } = useFinanceiroCategorias(officeId);

  const handleSaveCategorias = async (receita: string[], despesa: string[]) => {
    await saveCategorias(receita, despesa);
  };

  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<FinanceiroItem | null>(null);
  const [defaultTipo, setDefaultTipo] = useState<TipoType>("receita");
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Stats
  const hoje = new Date();
  const mesStart = startOfMonth(hoje);
  const mesEnd = endOfMonth(hoje);

  const stats = useMemo(() => {
    const receitaMes = items
      .filter((i) => i.tipo === "receita"
        && !isBefore(parseISO(i.data_vencimento), mesStart)
        && !isAfter(parseISO(i.data_vencimento), mesEnd))
      .reduce((acc, i) => acc + i.valor, 0);

    const aReceber = items
      .filter((i) => i.tipo === "receita" && (i.status === "pendente" || i.status === "vencido"))
      .reduce((acc, i) => acc + i.valor, 0);

    const aPagar = items
      .filter((i) => i.tipo === "despesa" && (i.status === "pendente" || i.status === "vencido"))
      .reduce((acc, i) => acc + i.valor, 0);

    const saldo = items
      .filter((i) => i.status === "pago" && i.data_pagamento
        && !isBefore(parseISO(i.data_pagamento), mesStart)
        && !isAfter(parseISO(i.data_pagamento), mesEnd))
      .reduce((acc, i) => acc + (i.tipo === "receita" ? i.valor : -i.valor), 0);

    return { receitaMes, aReceber, aPagar, saldo };
  }, [items]);

  // Categorias dinâmicas usadas nos registros (para o filtro)
  const todasCategorias = useMemo(() => {
    const cats = new Set(
      items.map((i) => i.categoria).filter((c): c is string => !!c && c.trim() !== "")
    );
    return Array.from(cats);
  }, [items]);

  const filtered = useMemo(() => items.filter((i) => {
    const q = busca.toLowerCase();
    const matchBusca = !busca || i.descricao.toLowerCase().includes(q) || (i.clientes?.nome?.toLowerCase().includes(q) ?? false);
    const matchStatus = filtroStatus === "todos" || i.status === filtroStatus;
    const matchCat = filtroCategoria === "todas" || i.categoria === filtroCategoria;
    return matchBusca && matchStatus && matchCat;
  }), [items, busca, filtroStatus, filtroCategoria]);

  const receber = filtered.filter((i) => i.tipo === "receita");
  const pagar = filtered.filter((i) => i.tipo === "despesa");

  const openNew = (tipo: TipoType) => {
    setEditItem(null);
    setDefaultTipo(tipo);
    setDialogOpen(true);
  };

  const openEdit = (item: FinanceiroItem) => {
    setEditItem(item);
    setDefaultTipo(item.tipo);
    setDialogOpen(true);
  };

  const handleSave = (data: any) => {
    create.mutate(data, { onSuccess: () => setDialogOpen(false) });
  };

  const handleUpdate = (data: any) => {
    update.mutate(data, { onSuccess: () => setDialogOpen(false) });
  };

  const handleMarkPago = (id: string) => {
    setLoadingId(id);
    markPago.mutate(id, { onSettled: () => setLoadingId(null) });
  };

  const handleDelete = (id: string) => {
    if (!confirm("Confirmar exclusão?")) return;
    remove.mutate(id);
  };

  const formInitial: FormState = editItem
    ? {
        tipo: editItem.tipo,
        descricao: editItem.descricao,
        valor: String(editItem.valor),
        data_vencimento: editItem.data_vencimento,
        status: editItem.status,
        categoria: toNull(editItem.categoria) ?? NONE,
        cliente_id: toNull(editItem.cliente_id) ?? NONE,
        processo_id: toNull(editItem.processo_id) ?? NONE,
        modo: "unico",
        parcelas: "2",
        recorrencia: "mensal",
        meses_recorrencia: "12",
      }
    : defaultForm(defaultTipo);

  const handleCancelarGrupo = (grupoId: string) => {
    if (!confirm("Cancelar todos os lançamentos futuros pendentes deste grupo?")) return;
    cancelarGrupo.mutate(grupoId);
  };

  return (
    <PermissionGuard permission="canViewFinanceiro" showDeniedMessage>
      <div className="flex-1 p-4 md:p-8 space-y-8 md:space-y-12 overflow-x-hidden entry-animate">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10">
                <DollarSign className="h-6 w-6 md:h-8 md:w-8 text-primary" />
              </div>
              <h1 className="text-3xl md:text-5xl font-black tracking-tight">Gestão Financeira</h1>
            </div>
            <p className="text-sm md:text-lg text-muted-foreground font-medium max-w-2xl">
              Visualize o fluxo de caixa, honorários e a saúde financeira do seu escritório.
            </p>
          </div>

          <div className="flex items-center gap-2 glass-morphism p-2 rounded-2xl border border-black/5 dark:border-border bg-black/[0.02] dark:bg-muted/30 shadow-premium">
            <Button size="icon" variant="ghost" className="h-11 w-11 rounded-xl" onClick={() => setCatDialogOpen(true)} title="Gerenciar categorias">
              <Settings2 className="h-5 w-5 text-muted-foreground" />
            </Button>
            <Button size="lg"
              className="rounded-xl h-11 px-5 font-black uppercase text-xs tracking-widest bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/20"
              onClick={() => openNew("despesa")}>
              <TrendingDown className="mr-2 h-4 w-4" />Nova Despesa
            </Button>
            <Button size="lg"
              className="rounded-xl h-11 px-7 font-black uppercase text-xs tracking-widest bg-primary hover:bg-primary/90 shadow-premium"
              onClick={() => openNew("receita")}>
              <Plus className="mr-2 h-5 w-5" />Nova Receita
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {([
            { label: "Receita do Mês", value: stats.receitaMes, Icon: TrendingUp, colorClass: "bg-emerald-500/10 text-emerald-500" },
            { label: "A Receber",      value: stats.aReceber,   Icon: CreditCard,  colorClass: "bg-primary/10 text-primary" },
            { label: "A Pagar",        value: stats.aPagar,     Icon: TrendingDown, colorClass: "bg-orange-500/10 text-orange-500" },
            { label: "Saldo do Mês",   value: stats.saldo,      Icon: DollarSign,  colorClass: "bg-primary/10 text-primary" },
          ] as const).map(({ label, value, Icon, colorClass }) => (
            <div key={label} className="glass-card p-6 rounded-3xl shadow-premium border border-black/5 dark:border-border bg-card/40 hover-lift group">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{label}</p>
                <div className={cn("p-2 rounded-xl", colorClass)}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              {query.isLoading
                ? <Skeleton className="h-8 w-28 rounded-xl" />
                : <p className={cn("text-3xl font-black tracking-tighter", value < 0 ? "text-red-500" : "text-foreground")}>{fmt(value)}</p>
              }
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
            <Input placeholder="Buscar por descrição ou cliente..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9 rounded-xl" />
          </div>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-full sm:w-44 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="pago">Pago</SelectItem>
              <SelectItem value="vencido">Vencido</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
            <SelectTrigger className="w-full sm:w-52 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as categorias</SelectItem>
              {todasCategorias.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="todos" className="w-full space-y-8">
          <div className="glass-card p-2 rounded-3xl inline-flex h-auto border border-black/5 dark:border-border bg-black/[0.02] dark:bg-muted/30 shadow-inner">
            <TabsList className="bg-transparent h-auto p-0 gap-1">
              {[
                { value: "receber", label: `A Receber (${receber.length})` },
                { value: "pagar",   label: `A Pagar (${pagar.length})` },
                { value: "todos",   label: `Todos (${filtered.length})` },
              ].map(({ value, label }) => (
                <TabsTrigger key={value} value={value}
                  className="rounded-2xl px-6 py-3 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-foreground data-[state=active]:shadow-lg transition-all">
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {([
            { value: "receber", data: receber, emptyLabel: "Nenhuma receita encontrada", tipo: "receita" as TipoType },
            { value: "pagar",   data: pagar,   emptyLabel: "Nenhuma despesa encontrada", tipo: "despesa" as TipoType },
            { value: "todos",   data: filtered, emptyLabel: "Nenhum registro encontrado", tipo: "receita" as TipoType },
          ]).map(({ value, data, emptyLabel, tipo }) => (
            <TabsContent key={value} value={value} className="space-y-4 entry-animate">
              {query.isLoading ? <LoadingSkeleton /> : data.length === 0
                ? <EmptyState label={emptyLabel} onNew={() => openNew(tipo)} />
                : data.map((item) => (
                    <FinanceiroRow key={item.id} item={item}
                      onMarkPago={handleMarkPago} onEdit={openEdit}
                      onDelete={handleDelete} onCancelarGrupo={handleCancelarGrupo}
                      loadingId={loadingId} />
                  ))
              }
            </TabsContent>
          ))}
        </Tabs>

        {/* Dialog criar/editar */}
        {dialogOpen && (
          <FormDialog
            open={dialogOpen}
            onClose={() => setDialogOpen(false)}
            initial={formInitial}
            editId={editItem?.id}
            officeId={officeId}
            userId={user?.id ?? ""}
            categoriasReceita={categoriasReceita}
            categoriasDespesa={categoriasDespesa}
            onSave={handleSave}
            onUpdate={handleUpdate}
            loading={create.isPending || update.isPending}
          />
        )}

        {/* Dialog categorias */}
        <GerenciarCategoriasDialog
          open={catDialogOpen}
          onClose={() => setCatDialogOpen(false)}
          categoriasReceita={categoriasReceita}
          categoriasDespesa={categoriasDespesa}
          onSave={handleSaveCategorias}
        />
      </div>
    </PermissionGuard>
  );
};

export default Financeiro;
