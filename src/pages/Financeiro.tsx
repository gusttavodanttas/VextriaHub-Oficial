import React, { useState, useMemo, useEffect, useCallback, useDeferredValue } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { PermissionGuard } from "@/components/Auth/PermissionGuard";
import { toNull } from "@/components/Financeiro/shared";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/rows";
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
  AlertTriangle,
  Calendar,
  Loader2,
  Settings2,
  X,
  Repeat,
  Layers,
  Building2,
  User,
  ListOrdered,
  ArrowRight,
  FileSpreadsheet,
  Download,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  parseISO,
  isAfter,
  isBefore,
  isSameMonth,
  addMonths,
  addWeeks,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

// Módulos extraídos deste arquivo (desmonte do god-component) — comportamento idêntico
import {
  NONE, fmt, defaultForm, statusConfig, escopoConfig, prioridadeAccentClassName, findPrioridadeGrupo,
  valorPago, saldoRestante,
  type FinanceiroItem, type FormState, type StatusType, type TipoType, type EscopoType,
} from "@/components/Financeiro/shared";
import { useFinanceiro, useFinanceiroCategorias, useFinanceiroGruposPrioridade } from "@/hooks/useFinanceiro";
import { GerenciarCategoriasDialog } from "@/components/Financeiro/GerenciarCategoriasDialog";
import { GerenciarPrioridadesDialog } from "@/components/Financeiro/GerenciarPrioridadesDialog";
import { FormDialog } from "@/components/Financeiro/FinanceiroFormDialog";
import { FinanceiroRow, EmptyState, LoadingSkeleton, RegistrarPagamentoPopover } from "@/components/Financeiro/FinanceiroRow";
import { ImportarPlanilhaDialog } from "@/components/Financeiro/ImportarPlanilhaDialog";
import { DiligenciasFinanceiroPanel } from "@/components/Correspondentes/DiligenciasFinanceiroPanel";
// ─── Page ────────────────────────────────────────────────────────────────────

const Financeiro = () => {
  const { user, office } = useAuth();
  const officeId = office?.id ?? user?.office_id ?? "";

  const { query, create, update, remove, registrarPagamento, cancelarGrupo } = useFinanceiro(officeId);
  const items = query.data ?? [];

  const { categoriasReceita, categoriasDespesa, save: saveCategorias } = useFinanceiroCategorias(officeId);
  const { gruposPrioridade, save: saveGruposPrioridade } = useFinanceiroGruposPrioridade(officeId);

  const handleSaveCategorias = async (receita: string[], despesa: string[]) => {
    await saveCategorias(receita, despesa);
  };

  const [busca, setBusca] = useState("");
  const dBusca = useDeferredValue(busca);
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [filtroEscopo, setFiltroEscopo] = useState<"todos" | EscopoType>("todos");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [prioridadeDialogOpen, setPrioridadeDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<FinanceiroItem | null>(null);
  const [defaultTipo, setDefaultTipo] = useState<TipoType>("receita");
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Mês em visualização — navegável (não trava no mês corrente), afeta os
  // cards "do Mês" e as listas (Priorização fica de fora, é um work-list vivo).
  const [mesRef, setMesRef] = useState(() => startOfMonth(new Date()));
  const mesStart = startOfMonth(mesRef);
  const mesEnd = endOfMonth(mesRef);
  const isMesAtual = isSameMonth(mesRef, new Date());
  const mesAnterior = () => setMesRef((d) => addMonths(d, -1));
  const proximoMes = () => setMesRef((d) => addMonths(d, 1));
  const irParaHoje = () => setMesRef(startOfMonth(new Date()));

  const stats = useMemo(() => {
    const receitaMes = items
      .filter((i) => i.tipo === "receita" && i.status !== "cancelado"
        && !isBefore(parseISO(i.data_vencimento), mesStart)
        && !isAfter(parseISO(i.data_vencimento), mesEnd))
      .reduce((acc, i) => acc + i.valor, 0);

    // "A receber"/"A pagar" contam o saldo ainda em aberto DO MÊS em visualização
    // (não o total histórico) — para um lançamento "parcial" isso é o restante,
    // não o valor total original.
    const aReceber = items
      .filter((i) => i.tipo === "receita" && (i.status === "pendente" || i.status === "vencido" || i.status === "parcial")
        && !isBefore(parseISO(i.data_vencimento), mesStart)
        && !isAfter(parseISO(i.data_vencimento), mesEnd))
      .reduce((acc, i) => acc + saldoRestante(i), 0);

    const aPagar = items
      .filter((i) => i.tipo === "despesa" && (i.status === "pendente" || i.status === "vencido" || i.status === "parcial")
        && !isBefore(parseISO(i.data_vencimento), mesStart)
        && !isAfter(parseISO(i.data_vencimento), mesEnd))
      .reduce((acc, i) => acc + saldoRestante(i), 0);

    // Movimentação de caixa do mês: valor efetivamente pago/recebido (não o valor
    // total do lançamento) — pra "pago" isso já é o valor cheio.
    const saldo = items
      .filter((i) => (i.status === "pago" || i.status === "parcial") && i.data_pagamento
        && !isBefore(parseISO(i.data_pagamento), mesStart)
        && !isAfter(parseISO(i.data_pagamento), mesEnd))
      .reduce((acc, i) => acc + (i.tipo === "receita" ? valorPago(i) : -valorPago(i)), 0);

    return { receitaMes, aReceber, aPagar, saldo };
  }, [items, mesStart, mesEnd]);

  // Índice de mistura patrimonial: % das despesas (não canceladas) que são
  // pessoais (PF) — sinal de risco fiscal quando o caixa do escritório está
  // sendo usado pra pagar contas do titular (desconsideração da personalidade jurídica).
  const mixing = useMemo(() => {
    const despesas = items.filter((i) => i.tipo === "despesa" && i.status !== "cancelado");
    const total = despesas.reduce((acc, i) => acc + i.valor, 0);
    const pf = despesas.filter((i) => i.escopo === "pf").reduce((acc, i) => acc + i.valor, 0);
    const index = total > 0 ? (pf / total) * 100 : 0;
    return { index, pf, total };
  }, [items]);

  const mixingStatus = useMemo(() => {
    const i = mixing.index;
    if (i === 0) return { label: "Excelente", className: "text-emerald-600 bg-emerald-500/10 border-emerald-500/30", barClass: "bg-emerald-500", text: "Nenhuma despesa pessoal registrada no caixa do escritório." };
    if (i < 10) return { label: "Sob Controle", className: "text-amber-600 bg-amber-500/10 border-amber-500/30", barClass: "bg-amber-400", text: "Baixo nível de mistura. Priorize pagar contas pessoais fora do caixa PJ." };
    if (i < 20) return { label: "Alerta", className: "text-orange-600 bg-orange-500/10 border-orange-500/30", barClass: "bg-orange-500", text: "Risco fiscal moderado — despesas pessoais estão poluindo o caixa do escritório." };
    return { label: "Risco Alto", className: "text-red-600 bg-red-500/10 border-red-500/30", barClass: "bg-red-500", text: "Confusão patrimonial relevante. Alto volume de despesas pessoais pagas pelo escritório." };
  }, [mixing.index]);

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
    const matchEscopo = filtroEscopo === "todos" || i.escopo === filtroEscopo;
    const matchMes = !isBefore(parseISO(i.data_vencimento), mesStart) && !isAfter(parseISO(i.data_vencimento), mesEnd);
    return matchBusca && matchStatus && matchCat && matchEscopo && matchMes;
  }), [items, dBusca, filtroStatus, filtroCategoria, filtroEscopo, mesStart, mesEnd]);

  const receber = filtered.filter((i) => i.tipo === "receita");
  const pagar = filtered.filter((i) => i.tipo === "despesa");

  // Priorização: despesas ainda em aberto (pendente/vencida/parcial), agrupadas
  // pelos grupos de prioridade configurados pelo escritório — ajuda a decidir o
  // que pagar primeiro quando o caixa aperta.
  const pendentesPagar = useMemo(
    () => items.filter((i) => i.tipo === "despesa" && (i.status === "pendente" || i.status === "vencido" || i.status === "parcial")),
    [items]
  );
  const SEM_CLASSIFICACAO = "sem_classificacao";
  const pendentesPorGrupo = useMemo(() => {
    const buckets: Record<string, FinanceiroItem[]> = { [SEM_CLASSIFICACAO]: [] };
    gruposPrioridade.forEach((g) => { buckets[g.id] = []; });
    pendentesPagar.forEach((i) => {
      const bucket = i.prioridade && buckets[i.prioridade] ? i.prioridade : SEM_CLASSIFICACAO;
      buckets[bucket].push(i);
    });
    return buckets;
  }, [pendentesPagar, gruposPrioridade]);
  // Soma o saldo em aberto (não o valor total) — relevante pra contas parciais.
  const somaGrupo = (arr: FinanceiroItem[]) => arr.reduce((acc, i) => acc + saldoRestante(i), 0);

  // Exporta os lançamentos visíveis (respeita os filtros ativos). `descricao`
  // é obrigatório no schema — toda linha exportada tem descrição preenchida.
  const exportCSV = () => {
    const header = ["Tipo", "Descrição", "Categoria", "Valor", "Valor Pago", "Saldo", "Vencimento", "Pagamento", "Status", "Escopo", "Prioridade", "Cliente"];
    const linhas = filtered.map((i) => [
      i.tipo === "receita" ? "Receita" : "Despesa",
      i.descricao,
      i.categoria ?? "",
      fmt(i.valor),
      fmt(valorPago(i)),
      fmt(saldoRestante(i)),
      format(parseISO(i.data_vencimento), "dd/MM/yyyy"),
      i.data_pagamento ? format(parseISO(i.data_pagamento), "dd/MM/yyyy") : "",
      statusConfig[i.status].label,
      escopoConfig[i.escopo].label,
      findPrioridadeGrupo(gruposPrioridade, i.prioridade)?.label ?? "",
      i.clientes?.nome ?? "",
    ]);
    const csv = [header, ...linhas]
      .map((r) => r.map((f) => `"${String(f ?? "").replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `financeiro_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

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

  // Converte um lançamento avulso em série: só cria as parcelas/ocorrências
  // futuras depois que a atualização do próprio lançamento (virando a 1ª) confirmar.
  const handleConvertToSerie = (
    updatePayload: TablesUpdate<"financeiro"> & { id: string },
    novasLinhas: TablesInsert<"financeiro">[],
  ) => {
    update.mutate(updatePayload, {
      onSuccess: () => create.mutate(novasLinhas, { onSuccess: () => setDialogOpen(false) }),
    });
  };

  const handleRegistrarPagamento = (item: FinanceiroItem, valor: number) => {
    setLoadingId(item.id);
    registrarPagamento.mutate({ item, valor }, { onSettled: () => setLoadingId(null) });
  };

  const handlePrioridadeChange = (id: string, prioridade: string | null) => {
    update.mutate({ id, prioridade });
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
        escopo: editItem.escopo ?? "pj",
        prioridade: editItem.prioridade ?? NONE,
        valor_pago: editItem.valor_pago != null ? String(editItem.valor_pago) : "",
        modo: "unico",
        parcelas: "2",
        recorrencia: "mensal",
        meses_recorrencia: "12",
      }
    : defaultForm(defaultTipo, isMesAtual ? new Date() : mesRef);

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
            <Button size="icon" variant="ghost" className="h-11 w-11 rounded-xl" onClick={() => setCatDialogOpen(true)} title="Gerenciar categorias" aria-label="Gerenciar categorias">
              <Settings2 className="h-5 w-5 text-muted-foreground" />
            </Button>
            <Button size="icon" variant="ghost" className="h-11 w-11 rounded-xl" onClick={() => setPrioridadeDialogOpen(true)} title="Gerenciar grupos de prioridade" aria-label="Gerenciar grupos de prioridade">
              <ListOrdered className="h-5 w-5 text-muted-foreground" />
            </Button>
            <Button size="icon" variant="ghost" className="h-11 w-11 rounded-xl" onClick={() => setImportDialogOpen(true)} title="Importar planilha (Excel/CSV)" aria-label="Importar planilha">
              <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
            </Button>
            <Button size="icon" variant="ghost" className="h-11 w-11 rounded-xl" onClick={exportCSV} disabled={filtered.length === 0} title="Exportar lançamentos (CSV)" aria-label="Exportar lançamentos">
              <Download className="h-5 w-5 text-muted-foreground" />
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

        {/* Navegação de mês — afeta os cards "do Mês" e as listas abaixo */}
        <div className="flex items-center gap-2">
          <Button size="icon" variant="outline" className="h-9 w-9 rounded-xl" onClick={mesAnterior} title="Mês anterior" aria-label="Mês anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="outline" className="h-9 w-9 rounded-xl" onClick={proximoMes} title="Próximo mês" aria-label="Próximo mês">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <p className="text-sm font-black tracking-tight capitalize w-40">{format(mesRef, "MMMM yyyy", { locale: ptBR })}</p>
          {!isMesAtual && (
            <Button variant="outline" className="h-9 rounded-xl px-3 text-[10px] font-black uppercase tracking-widest" onClick={irParaHoje}>
              Hoje
            </Button>
          )}
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

        {/* Índice de mistura patrimonial PJ/PF */}
        {!query.isLoading && mixing.total > 0 && (
          <div className="glass-card p-6 rounded-3xl shadow-premium border border-black/5 dark:border-border bg-card/40 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Índice de Mistura Patrimonial (PJ x PF)</p>
                <Badge className={cn("px-2.5 py-0.5 rounded-lg text-[9px] uppercase tracking-widest border", mixingStatus.className)}>
                  {mixingStatus.label}
                </Badge>
              </div>
              <span className="text-2xl font-black tracking-tighter">{mixing.index.toFixed(1)}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-muted/40 overflow-hidden">
              <div className={cn("h-full rounded-full transition-all", mixingStatus.barClass)} style={{ width: `${Math.min(mixing.index, 100)}%` }} />
            </div>
            <p className="text-xs text-muted-foreground flex items-start gap-2">
              {mixing.index >= 10 && <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-orange-500" />}
              <span>{mixingStatus.text} <span className="font-bold text-foreground">{fmt(mixing.pf)}</span> de despesas pessoais registradas no caixa do escritório.</span>
            </p>
          </div>
        )}

        {/* Resumo de diligências (custo com correspondentes) */}
        <DiligenciasFinanceiroPanel />

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
              <SelectItem value="parcial">Parcial</SelectItem>
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
          <Select value={filtroEscopo} onValueChange={(v) => setFiltroEscopo(v as "todos" | EscopoType)}>
            <SelectTrigger className="w-full sm:w-40 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">PJ + PF</SelectItem>
              <SelectItem value="pj">Só Escritório</SelectItem>
              <SelectItem value="pf">Só Pessoal</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="todos" className="w-full space-y-8">
          <div className="glass-card p-2 rounded-3xl inline-flex h-auto border border-black/5 dark:border-border bg-black/[0.02] dark:bg-muted/30 shadow-inner overflow-x-auto max-w-full">
            <TabsList className="bg-transparent h-auto p-0 gap-1">
              {[
                { value: "receber", label: `A Receber (${receber.length})` },
                { value: "pagar",   label: `A Pagar (${pagar.length})` },
                { value: "priorizacao", label: `Priorização (${pendentesPagar.length})` },
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
                      onRegistrarPagamento={handleRegistrarPagamento} onEdit={openEdit}
                      onDelete={handleDelete} onCancelarGrupo={handleCancelarGrupo}
                      onPrioridadeChange={handlePrioridadeChange} gruposPrioridade={gruposPrioridade}
                      loadingId={loadingId} />
                  ))
              }
            </TabsContent>
          ))}

          {/* Priorização: despesas em aberto agrupadas pelos grupos configurados */}
          <TabsContent value="priorizacao" className="space-y-6 entry-animate">
            {query.isLoading ? <LoadingSkeleton /> : pendentesPagar.length === 0 ? (
              <EmptyState label="Nenhuma despesa pendente para priorizar" onNew={() => openNew("despesa")} />
            ) : (
              ([
                ...gruposPrioridade.map((g, i) => ({ key: g.id, label: g.label, accent: prioridadeAccentClassName(i) })),
                { key: SEM_CLASSIFICACAO, label: "Sem Classificação", accent: "border-muted/40 bg-muted/10" },
              ]).map(({ key, label, accent }) => {
                const grupoItens = pendentesPorGrupo[key] ?? [];
                return (
                  <div key={key} className={cn("rounded-3xl border p-5 space-y-3", accent)}>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <p className="text-xs font-black uppercase tracking-widest">{label}</p>
                      <span className="text-sm font-black tabular-nums">{fmt(somaGrupo(grupoItens))} · {grupoItens.length} conta{grupoItens.length === 1 ? "" : "s"}</span>
                    </div>
                    {grupoItens.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground/60 py-2">Vazio.</p>
                    ) : (
                      <div className="space-y-2">
                        {grupoItens.map((item) => {
                          const escopoCfg = escopoConfig[item.escopo] ?? escopoConfig.pj;
                          return (
                            <div key={item.id} className="flex flex-col sm:flex-row sm:items-center gap-3 bg-card/60 rounded-2xl p-3.5 border border-black/5 dark:border-border">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-bold text-sm truncate">{item.descricao}</p>
                                  <Badge className={cn("px-2 py-0.5 rounded-lg text-[9px] uppercase tracking-widest", escopoCfg.className)}>{escopoCfg.label}</Badge>
                                  {item.status === "vencido" && (
                                    <Badge className="px-2 py-0.5 rounded-lg text-[9px] uppercase tracking-widest border-red-500/50 text-red-500 bg-red-500/10 font-bold">
                                      <AlertCircle className="h-3 w-3 mr-1" />Vencido
                                    </Badge>
                                  )}
                                  {item.status === "parcial" && (
                                    <Badge className={cn("px-2 py-0.5 rounded-lg text-[9px] uppercase tracking-widest", statusConfig.parcial.className)}>
                                      {fmt(valorPago(item))} de {fmt(item.valor)}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                  Vence em {format(parseISO(item.data_vencimento), "dd/MM/yyyy")}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="font-black tabular-nums text-orange-500">{fmt(saldoRestante(item))}</span>
                                <Select value={item.prioridade ?? NONE} onValueChange={(v) => handlePrioridadeChange(item.id, v === NONE ? null : v)}>
                                  <SelectTrigger className="w-[132px] h-8 rounded-lg text-[10px]"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value={NONE}>Não classificada</SelectItem>
                                    {gruposPrioridade.map((g) => (
                                      <SelectItem key={g.id} value={g.id}>{g.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <RegistrarPagamentoPopover item={item} loading={loadingId === item.id}
                                  onConfirm={(valor) => handleRegistrarPagamento(item, valor)}>
                                  <Button size="sm" className="h-8 rounded-lg text-[10px] font-black uppercase tracking-wide bg-emerald-500 hover:bg-emerald-600 text-white"
                                    disabled={loadingId === item.id}>
                                    {loadingId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><CheckCircle2 className="h-3.5 w-3.5 mr-1" />Pagar</>}
                                  </Button>
                                </RegistrarPagamentoPopover>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </TabsContent>
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
            gruposPrioridade={gruposPrioridade}
            permiteConverterSerie={!!editItem && !editItem.grupo_id}
            onSave={handleSave}
            onUpdate={handleUpdate}
            onConvertToSerie={handleConvertToSerie}
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

        {/* Dialog grupos de prioridade */}
        <GerenciarPrioridadesDialog
          open={prioridadeDialogOpen}
          onClose={() => setPrioridadeDialogOpen(false)}
          grupos={gruposPrioridade}
          onSave={saveGruposPrioridade}
        />

        {/* Dialog importar planilha */}
        <ImportarPlanilhaDialog
          open={importDialogOpen}
          onClose={() => setImportDialogOpen(false)}
          officeId={officeId}
          userId={user?.id ?? ""}
          categoriasReceita={categoriasReceita}
          categoriasDespesa={categoriasDespesa}
          importing={create.isPending}
          onImport={(rows) => create.mutate(rows, { onSuccess: () => setImportDialogOpen(false) })}
        />
      </div>
    </PermissionGuard>
  );
};

export default Financeiro;
