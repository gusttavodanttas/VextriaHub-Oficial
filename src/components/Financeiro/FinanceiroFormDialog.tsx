// Formulário de lançamento (único/parcelado/recorrente) — extraído de pages/Financeiro.tsx.
import React, { useState, useMemo, useEffect, useCallback, useDeferredValue } from "react";
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
import {
  NONE, toNull, fmt,
  type StatusType, type TipoType, type ModoLancamento, type RecorrenciaTipo,
  type FormState, type ClienteOption, type ProcessoOption,
} from "./shared";

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
      <DialogContent aria-describedby={undefined} className="sm:max-w-sm p-0 rounded-3xl border border-black/5 dark:border-border shadow-premium overflow-hidden">

        {/* Header colorido */}
        <div className={cn(
          "px-5 pt-5 pb-3",
          isReceita
            ? "bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent"
            : "bg-gradient-to-br from-orange-500/10 via-orange-500/5 to-transparent"
        )}>
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className={cn(
                "h-9 w-9 rounded-xl flex items-center justify-center shrink-0",
                isReceita ? "bg-emerald-500/15 text-emerald-500" : "bg-orange-500/15 text-orange-500"
              )}>
                {isReceita ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
              </div>
              <DialogTitle className="text-xl font-black tracking-tight">
                {editId
                  ? `Editar ${isReceita ? "Receita" : "Despesa"}`
                  : isReceita ? "Nova Receita" : "Nova Despesa"}
              </DialogTitle>
            </div>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit} className="px-5 pb-5 space-y-3 mt-1">

          {/* Descrição */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Descrição *</Label>
            <Input required value={form.descricao}
              onChange={(e) => set("descricao", e.target.value)}
              className="rounded-xl h-10 text-sm font-medium"
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
                    "rounded-xl h-10 pl-9 text-sm font-bold tabular-nums",
                    valorNum > 0 && (isReceita ? "text-emerald-500" : "text-orange-500")
                  )}
                  placeholder="0,00" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Vencimento *</Label>
              <Input required type="date" value={form.data_vencimento}
                onChange={(e) => set("data_vencimento", e.target.value)}
                className="rounded-xl h-10 text-sm" />
            </div>
          </div>

          {/* Modo lançamento */}
          {!editId && (
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Tipo de lançamento</Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
                <SelectTrigger className="rounded-xl h-10 text-sm"><SelectValue placeholder="Nenhuma" /></SelectTrigger>
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
                <SelectTrigger className="rounded-xl h-10 text-sm"><SelectValue /></SelectTrigger>
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
                <SelectTrigger className="rounded-xl h-10 text-sm"><SelectValue placeholder="Nenhum" /></SelectTrigger>
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
                  <SelectTrigger className="rounded-xl h-10 text-sm"><SelectValue placeholder="Nenhum" /></SelectTrigger>
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
              className="flex-1 rounded-xl h-10 font-black uppercase text-[10px] tracking-widest">
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}
              className={cn(
                "flex-1 rounded-xl h-10 font-black uppercase text-[10px] tracking-widest text-white",
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

export { FormDialog };
