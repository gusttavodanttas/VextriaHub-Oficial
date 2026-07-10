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

// Módulos extraídos deste arquivo (desmonte do god-component) — comportamento idêntico
import {
  NONE, fmt, defaultForm, statusConfig,
  type FinanceiroItem, type FormState, type StatusType, type TipoType,
} from "@/components/Financeiro/shared";
import { useFinanceiro, useFinanceiroCategorias } from "@/hooks/useFinanceiro";
import { GerenciarCategoriasDialog } from "@/components/Financeiro/GerenciarCategoriasDialog";
import { FormDialog } from "@/components/Financeiro/FinanceiroFormDialog";
import { FinanceiroRow, EmptyState, LoadingSkeleton } from "@/components/Financeiro/FinanceiroRow";
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
  const dBusca = useDeferredValue(busca);
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
    const q = dBusca.toLowerCase();
    const matchBusca = !dBusca || i.descricao.toLowerCase().includes(q) || (i.clientes?.nome?.toLowerCase().includes(q) ?? false);
    const matchStatus = filtroStatus === "todos" || i.status === filtroStatus;
    const matchCat = filtroCategoria === "todas" || i.categoria === filtroCategoria;
    return matchBusca && matchStatus && matchCat;
  }), [items, dBusca, filtroStatus, filtroCategoria]);

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
