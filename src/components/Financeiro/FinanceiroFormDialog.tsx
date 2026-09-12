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
  Building2,
  User,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { parcelasRows, recorrenciaRows } from "@/lib/financeiroCalc";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/rows";
import {
  NONE, toNull, fmt,
  type StatusType, type TipoType, type EscopoType, type PrioridadeGrupo, type ModoLancamento, type RecorrenciaTipo,
  type FormState, type ClienteOption, type ProcessoOption,
} from "./shared";

type FinanceiroUpdatePayload = TablesUpdate<"financeiro"> & { id: string };

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
  gruposPrioridade: PrioridadeGrupo[];
  // Permite converter um lançamento avulso já existente (sem grupo_id) em
  // parcelado/recorrente, gerando as parcelas/ocorrências futuras a partir de agora.
  permiteConverterSerie?: boolean;
  onSave: (data: any) => void;
  onUpdate: (data: any) => void;
  onConvertToSerie: (updatePayload: FinanceiroUpdatePayload, novasLinhas: TablesInsert<"financeiro">[]) => void;
  loading: boolean;
}

const FormDialog: React.FC<FormDialogProps> = ({
  open, onClose, initial, editId, officeId, userId,
  categoriasReceita, categoriasDespesa, gruposPrioridade, permiteConverterSerie,
  onSave, onUpdate, onConvertToSerie, loading,
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
    const valorPagoNum = form.status === "parcial"
      ? Math.min(valorTotal, Math.max(0, parseFloat(form.valor_pago) || 0))
      : form.status === "pago" ? valorTotal : null;
    const base = {
      tipo: form.tipo,
      descricao: form.descricao.trim(),
      status: form.status,
      categoria: toNull(form.categoria),
      cliente_id: toNull(form.cliente_id),
      processo_id: toNull(form.processo_id),
      escopo: form.escopo,
      prioridade: form.tipo === "despesa" ? toNull(form.prioridade) : null,
      user_id: userId,
      office_id: officeId,
      valor_pago: valorPagoNum,
      data_pagamento: (form.status === "pago" || form.status === "parcial") ? format(new Date(), "yyyy-MM-dd") : null,
    };

    if (editId) {
      if (form.modo === "unico" || !permiteConverterSerie) {
        onUpdate({ id: editId, ...base, valor: valorTotal, data_vencimento: form.data_vencimento });
        return;
      }

      // Converte um lançamento avulso em série: esta edição vira a 1ª parcela/
      // ocorrência, e as futuras são criadas a partir dela (mesmo valor, datas
      // incrementadas), ligadas por um novo grupo_id.
      const grupo_id = crypto.randomUUID();
      if (form.modo === "parcelado") {
        const restantes = Math.max(1, Math.min(119, parseInt(form.parcelas) || 1));
        const parcela_total = restantes + 1;
        const updatePayload = {
          id: editId, ...base, valor: valorTotal, data_vencimento: form.data_vencimento,
          grupo_id, recorrencia: null, parcela_numero: 1, parcela_total,
          descricao: `${base.descricao} (1/${parcela_total})`,
        };
        const novasLinhas = recorrenciaRows(valorTotal, restantes + 1, form.data_vencimento, "mensal")
          .slice(1)
          .map((r, i) => ({
            ...base, grupo_id, recorrencia: null, status: "pendente", data_pagamento: null, valor_pago: null,
            valor: r.valor, data_vencimento: r.data_vencimento,
            parcela_numero: i + 2, parcela_total,
            descricao: `${base.descricao} (${i + 2}/${parcela_total})`,
          }));
        onConvertToSerie(updatePayload, novasLinhas);
      } else {
        const meses = Math.max(1, Math.min(119, parseInt(form.meses_recorrencia) || 1));
        const updatePayload = {
          id: editId, ...base, valor: valorTotal, data_vencimento: form.data_vencimento,
          grupo_id, recorrencia: form.recorrencia, parcela_numero: null, parcela_total: null,
        };
        const novasLinhas = recorrenciaRows(valorTotal, meses + 1, form.data_vencimento, form.recorrencia)
          .slice(1)
          .map((r) => ({
            ...base, grupo_id, parcela_numero: null, parcela_total: null, recorrencia: form.recorrencia,
            status: "pendente", data_pagamento: null, valor_pago: null,
            valor: r.valor, data_vencimento: r.data_vencimento,
          }));
        onConvertToSerie(updatePayload, novasLinhas);
      }
      return;
    }

    const grupo_id = crypto.randomUUID();

    if (form.modo === "parcelado") {
      const n = Math.max(2, Math.min(120, parseInt(form.parcelas) || 2));
      const rows = parcelasRows(valorTotal, n, form.data_vencimento).map((r) => ({
        ...base,
        grupo_id,
        recorrencia: null,
        status: "pendente",
        data_pagamento: null,
        valor_pago: null,
        valor: r.valor,
        data_vencimento: r.data_vencimento,
        parcela_numero: r.parcela_numero,
        parcela_total: r.parcela_total,
        descricao: `${base.descricao} (${r.parcela_numero}/${r.parcela_total})`,
      }));
      onSave(rows);
    } else if (form.modo === "recorrente") {
      const meses = Math.max(1, Math.min(120, parseInt(form.meses_recorrencia) || 12));
      const rows = recorrenciaRows(valorTotal, meses, form.data_vencimento, form.recorrencia).map((r) => ({
        ...base,
        grupo_id,
        parcela_numero: null,
        parcela_total: null,
        recorrencia: form.recorrencia,
        status: "pendente",
        data_pagamento: null,
        valor_pago: null,
        valor: r.valor,
        data_vencimento: r.data_vencimento,
      }));
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

  // Preview de resumo — na criação, o valor digitado é o TOTAL a dividir; na
  // conversão de um lançamento existente, o valor já É o de cada parcela/
  // ocorrência (a que já existe vira a 1ª, as demais têm o mesmo valor).
  const resumo = (() => {
    if (!valorNum) return null;
    if (form.modo === "parcelado") {
      if (editId) return `+ ${nParcelas} parcela${nParcelas === 1 ? "" : "s"} de ${fmt(valorNum)} — total ${nParcelas + 1}×`;
      const pv = Math.round(valorNum / nParcelas * 100) / 100;
      return `${nParcelas}× de ${fmt(pv)} mensais — total ${fmt(valorNum)}`;
    }
    if (form.modo === "recorrente") {
      const freq = form.recorrencia === "semanal" ? "semanais" : form.recorrencia === "quinzenal" ? "quinzenais" : "mensais";
      if (editId) return `+ ${nRecorrencia} lançamentos ${freq} de ${fmt(valorNum)}`;
      return `${nRecorrencia} lançamentos ${freq} de ${fmt(valorNum)}`;
    }
    return null;
  })();

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-sm p-0 rounded-3xl border border-black/5 dark:border-border shadow-premium overflow-hidden max-h-[90vh] flex flex-col">

       <div className="overflow-y-auto">

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

          {/* Modo lançamento (na edição, só aparece pra converter um avulso em série) */}
          {(!editId || permiteConverterSerie) && (
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {editId ? "É fixa ou parcelada?" : "Tipo de lançamento"}
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {([
                  { value: "unico",      label: "Único",      Icon: DollarSign, desc: editId ? "Manter como está" : "Um lançamento" },
                  { value: "parcelado",  label: "Parcelado",  Icon: Layers,     desc: editId ? "Criar parcelas futuras" : "Divide em parcelas" },
                  { value: "recorrente", label: "Recorrente", Icon: Repeat,     desc: editId ? "Criar ocorrências futuras" : "Repete periodicamente" },
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
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      {editId ? "Parcelas restantes" : "Nº de parcelas"}
                    </Label>
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
                    <Input type="number" min={editId ? 1 : 2} max={editId ? 119 : 120} value={form.parcelas}
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
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        {editId ? "Gerar mais" : "Gerar por"}
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input type="number" min={1} max={119} value={form.meses_recorrencia}
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

          {/* Escopo PJ/PF + Prioridade (só despesa) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Escopo</Label>
              <div className="flex bg-muted/30 p-1 rounded-xl border border-black/8 dark:border-border">
                <button type="button" onClick={() => set("escopo", "pj")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wide transition-all",
                    form.escopo === "pj" ? "bg-blue-500 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}>
                  <Building2 className="h-3.5 w-3.5" />PJ
                </button>
                <button type="button" onClick={() => set("escopo", "pf")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wide transition-all",
                    form.escopo === "pf" ? "bg-violet-500 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}>
                  <User className="h-3.5 w-3.5" />PF
                </button>
              </div>
            </div>
            {form.tipo === "despesa" ? (
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Prioridade</Label>
                <Select value={form.prioridade} onValueChange={(v) => set("prioridade", v)}>
                  <SelectTrigger className="rounded-xl h-10 text-sm"><SelectValue placeholder="Não classificada" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Não classificada</SelectItem>
                    {gruposPrioridade.map((g) => (
                      <SelectItem key={g.id} value={g.id}>{g.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : <div />}
          </div>

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
                  <SelectItem value="parcial">Parcial</SelectItem>
                  <SelectItem value="vencido">Vencido</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Valor pago (só quando status = parcial) */}
          {form.status === "parcial" && (
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Valor já pago</Label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-black text-muted-foreground">R$</span>
                <Input type="number" min="0" max={form.valor || undefined} step="0.01" value={form.valor_pago}
                  onChange={(e) => set("valor_pago", e.target.value)}
                  className="rounded-xl h-10 pl-9 text-sm font-bold tabular-nums text-sky-500"
                  placeholder="0,00" />
              </div>
            </div>
          )}

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
                  ? permiteConverterSerie && form.modo === "parcelado"
                    ? `Salvar e criar ${nParcelas} parcelas`
                    : permiteConverterSerie && form.modo === "recorrente"
                      ? `Salvar e criar ${nRecorrencia} lançamentos`
                      : "Salvar alterações"
                  : form.modo === "parcelado"
                    ? `Criar ${nParcelas} parcelas`
                    : form.modo === "recorrente"
                      ? `Criar ${nRecorrencia} lançamentos`
                      : isReceita ? "Registrar receita" : "Registrar despesa"}
            </Button>
          </div>
        </form>
       </div>
      </DialogContent>
    </Dialog>
  );
};

export { FormDialog };
