import { useMemo, useState, useDeferredValue } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CheckSquare, Plus, Search, Trash2, Pencil, MoreHorizontal, User, FileText, MessageSquare,
  ListChecks, AlertTriangle, CheckCircle2, Flame, Clock, Trophy, Target, Repeat, X,
} from "lucide-react";
import { DeleteConfirmDialog } from "@/components/ui/DeleteConfirmDialog";
import { NovaTarefaDialog } from "@/components/Tarefas/NovaTarefaDialog";
import { useMultiSelect } from "@/hooks/useMultiSelect";
import { useTarefas, type Tarefa, type TarefaInput } from "@/hooks/useTarefas";
import { useOfficeUsers } from "@/hooks/useOfficeUsers";
import { useClientes } from "@/hooks/useClientes";
import { useProcessosV2 } from "@/hooks/useProcessosV2";
import { useOpenItemFromSearch } from "@/hooks/useOpenItemFromSearch";
import { continueOccurrences, recorrenciaLabel, type RecRule } from "@/lib/recorrencia";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { format, isToday, isTomorrow, isThisWeek, isPast, parseISO, differenceInCalendarDays, startOfWeek, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

const prioMeta: Record<string, { label: string; cls: string; dot: string }> = {
  alta:  { label: "Alta",  cls: "border-rose-500/30 text-rose-600 dark:text-rose-400 bg-rose-500/10", dot: "bg-rose-500" },
  media: { label: "Média", cls: "border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10", dot: "bg-amber-500" },
  baixa: { label: "Baixa", cls: "border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10", dot: "bg-emerald-500" },
};

function StatCard({ icon: Icon, label, value, color, bg }: { icon: React.ElementType; label: string; value: number; color: string; bg: string }) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-2xl border border-black/5 dark:border-border bg-card/40">
      <div className={cn("p-2.5 rounded-xl shrink-0", bg)}><Icon className={cn("h-5 w-5", color)} /></div>
      <div className="min-w-0">
        <p className="text-2xl font-black leading-none">{value}</p>
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mt-1">{label}</p>
      </div>
    </div>
  );
}

const Tarefas = () => {
  const { tarefas, isLoading, create, createMany, update, toggle, remove } = useTarefas();
  const { data: clientesData } = useClientes();
  const { data: processosData } = useProcessosV2();
  const { users: officeUsers } = useOfficeUsers();
  const { user } = useAuth();

  const { data: atendimentosData } = useQuery({
    queryKey: ["atendimentos-opts", user?.office_id],
    queryFn: async () => {
      if (!user?.office_id) return [];
      const { data } = await supabase.from("atendimentos")
        .select("id, tipo_atendimento, data_atendimento")
        .eq("office_id", user.office_id).eq("deletado", false)
        .order("data_atendimento", { ascending: false }).limit(100);
      return data || [];
    },
    enabled: !!user?.office_id,
  });

  const clientes = useMemo(() => (clientesData || []).map((c: any) => ({ id: c.id, label: c.nome })), [clientesData]);
  const membros = useMemo(() => officeUsers.map(u => ({ id: u.user_id, label: u.profile?.full_name || u.profile?.email || "Membro" })), [officeUsers]);
  const processos = useMemo(() => (processosData || []).map((p: any) => ({ id: p.id, label: p.numeroProcesso ? `${p.titulo} · ${p.numeroProcesso}` : p.titulo })), [processosData]);
  const atendimentos = useMemo(() => (atendimentosData || []).map((a: any) => ({ id: a.id, label: `${a.tipo_atendimento}${a.data_atendimento ? " · " + format(parseISO(a.data_atendimento), "dd/MM/yy") : ""}` })), [atendimentosData]);
  const processoMap = useMemo(() => Object.fromEntries(processos.map(p => [p.id, p.label])), [processos]);
  const atendimentoMap = useMemo(() => Object.fromEntries(atendimentos.map(a => [a.id, a.label])), [atendimentos]);

  const [search, setSearch] = useState("");
  const dSearch = useDeferredValue(search);
  const [prioridadeFilter, setPrioridadeFilter] = useState("todas");
  const [statusFilter, setStatusFilter] = useState("pendentes");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Tarefa | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const filtered = useMemo(() => tarefas.filter(t => {
    const q = dSearch.toLowerCase();
    const matchesSearch = !q || t.titulo?.toLowerCase().includes(q) || (t.cliente_nome || "").toLowerCase().includes(q) || (t.descricao || "").toLowerCase().includes(q);
    const matchesPrio = prioridadeFilter === "todas" || t.prioridade === prioridadeFilter;
    const matchesStatus = statusFilter === "todas" || (statusFilter === "pendentes" ? !t.concluida : t.concluida);
    return matchesSearch && matchesPrio && matchesStatus;
  }), [tarefas, dSearch, prioridadeFilter, statusFilter]);

  const multiSelect = useMultiSelect(filtered);

  const stats = useMemo(() => {
    const pendentes = tarefas.filter(t => !t.concluida);
    const atrasadas = pendentes.filter(t => t.data_vencimento && isPast(parseISO(t.data_vencimento)) && !isToday(parseISO(t.data_vencimento)));
    const concluidas = tarefas.filter(t => t.concluida);
    return {
      pendentes: pendentes.length,
      atrasadas: atrasadas.length,
      hoje: pendentes.filter(t => t.data_vencimento && isToday(parseISO(t.data_vencimento))).length,
      concluidas: concluidas.length,
    };
  }, [tarefas]);

  // Agrupamento por vencimento (somente pendentes; concluídas vão num grupo único)
  const groups = useMemo(() => {
    const g: Record<string, Tarefa[]> = { Atrasadas: [], Hoje: [], Amanhã: [], "Esta semana": [], Futuras: [], "Sem prazo": [], Concluídas: [] };
    for (const t of filtered) {
      if (t.concluida) { g.Concluídas.push(t); continue; }
      if (!t.data_vencimento) { g["Sem prazo"].push(t); continue; }
      const d = parseISO(t.data_vencimento);
      if (isToday(d)) g.Hoje.push(t);
      else if (isPast(d)) g.Atrasadas.push(t);
      else if (isTomorrow(d)) g.Amanhã.push(t);
      else if (isThisWeek(d, { weekStartsOn: 1 })) g["Esta semana"].push(t);
      else g.Futuras.push(t);
    }
    return g;
  }, [filtered]);

  const groupColor: Record<string, string> = {
    Atrasadas: "text-rose-500", Hoje: "text-orange-500", Amanhã: "text-amber-500",
    "Esta semana": "text-blue-500", Futuras: "text-muted-foreground/50", "Sem prazo": "text-muted-foreground/50", Concluídas: "text-emerald-500",
  };

  // Gamificação (dados reais)
  const game = useMemo(() => {
    const concluidas = tarefas.filter(t => t.concluida && t.updated_at);
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const concluidasSemana = concluidas.filter(t => parseISO(t.updated_at!) >= weekStart).length;
    const totalConcluidas = tarefas.filter(t => t.concluida).length;
    const pontos = totalConcluidas * 10;
    const nivel = Math.floor(pontos / 100) + 1;
    // Sequência (streak): dias consecutivos com ao menos 1 tarefa concluída
    const dias = new Set(concluidas.map(t => format(parseISO(t.updated_at!), "yyyy-MM-dd")));
    let streak = 0;
    let cursor = new Date();
    if (!dias.has(format(cursor, "yyyy-MM-dd"))) cursor = subDays(cursor, 1);
    while (dias.has(format(cursor, "yyyy-MM-dd"))) { streak++; cursor = subDays(cursor, 1); }
    const metaSemanal = 10;
    return { concluidasSemana, pontos, nivel, streak, metaSemanal, progresso: Math.min(100, Math.round((concluidasSemana / metaSemanal) * 100)) };
  }, [tarefas]);

  useOpenItemFromSearch("/tarefas", !isLoading && tarefas.length > 0);

  const handleSubmit = async (input: TarefaInput, id?: string) => {
    if (id) await update.mutateAsync({ id, input });
    else await create.mutateAsync(input);
  };
  const handleSubmitMany = async (inputs: TarefaInput[]) => {
    await createMany.mutateAsync(inputs);
  };

  // Séries de recorrência acabando (poucas ocorrências futuras restantes)
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("tarefa_series_dismissed") || "[]")); } catch { return new Set(); }
  });
  const persistDismissed = (s: Set<string>) => {
    setDismissed(new Set(s));
    try { localStorage.setItem("tarefa_series_dismissed", JSON.stringify([...s])); } catch { /* ignore */ }
  };

  const seriesAcabando = useMemo(() => {
    const byGroup: Record<string, Tarefa[]> = {};
    for (const t of tarefas) {
      if (!t.recorrencia_grupo) continue;
      (byGroup[t.recorrencia_grupo] ||= []).push(t);
    }
    const out: { grupo: string; titulo: string; regra: string; restantes: number }[] = [];
    for (const [grupo, items] of Object.entries(byGroup)) {
      if (items.length < 3) continue; // só séries de verdade
      const restantes = items.filter(t => !t.concluida).length;
      if (restantes > 0 && restantes <= 2 && !dismissed.has(grupo)) {
        out.push({ grupo, titulo: items[0].titulo, regra: items[0].recorrencia_regra || "semanal", restantes });
      }
    }
    return out;
  }, [tarefas, dismissed]);

  const handleExtend = async (grupo: string) => {
    const items = tarefas.filter(t => t.recorrencia_grupo === grupo);
    if (!items.length) return;
    const template = items[items.length - 1]; // tarefas vêm ordenadas por vencimento asc
    const regra = (template.recorrencia_regra || "semanal") as RecRule;
    const last = template.data_vencimento ? new Date(`${template.data_vencimento}T12:00:00`) : new Date();
    const datas = continueOccurrences(last, regra, 4);
    const inputs: TarefaInput[] = datas.map(d => ({
      titulo: template.titulo,
      descricao: template.descricao,
      data_vencimento: format(d, "yyyy-MM-dd"),
      prioridade: template.prioridade || "media",
      cliente_id: template.cliente_id,
      processo_id: template.processo_id,
      atendimento_id: template.atendimento_id,
      recorrencia_grupo: grupo,
      recorrencia_regra: regra,
    }));
    await createMany.mutateAsync(inputs);
  };
  const openNew = () => { setEditTarget(null); setDialogOpen(true); };
  const openEdit = (t: Tarefa) => { setEditTarget(t); setDialogOpen(true); };
  const handleConfirmDelete = async () => {
    await remove.mutateAsync(multiSelect.getSelectedItems().map(i => i.id));
    multiSelect.clearSelection();
    setDeleteDialogOpen(false);
  };

  const dueLabel = (dateStr: string) => {
    const d = parseISO(dateStr);
    const diff = differenceInCalendarDays(d, new Date());
    if (diff === 0) return { label: "Hoje", cls: "text-orange-500 font-bold" };
    if (diff === 1) return { label: "Amanhã", cls: "text-amber-500 font-bold" };
    if (diff < 0) return { label: `${Math.abs(diff)}d atrasada`, cls: "text-rose-500 font-black" };
    return { label: format(d, "dd/MM", { locale: ptBR }), cls: "text-muted-foreground font-semibold" };
  };

  const renderCard = (t: Tarefa) => {
    const meta = prioMeta[t.prioridade || "media"] || prioMeta.media;
    const selected = multiSelect.isSelected(t.id);
    const due = t.data_vencimento ? dueLabel(t.data_vencimento) : null;
    return (
      <div key={t.id} id={`item-${t.id}`}
        className={cn(
          "group flex items-center gap-3 p-3.5 rounded-2xl border bg-card/40 transition-all hover:shadow-md",
          selected ? "border-primary/40 ring-2 ring-primary/10 bg-primary/[0.02]" : "border-black/5 dark:border-border hover:border-black/10 dark:hover:border-white/15",
          t.concluida && "opacity-60"
        )}>
        {/* Checkbox concluir */}
        <button
          onClick={() => toggle.mutate({ id: t.id, concluida: !t.concluida })}
          className={cn(
            "shrink-0 h-6 w-6 rounded-lg border-2 flex items-center justify-center transition-all",
            t.concluida ? "bg-emerald-500 border-emerald-500 text-white" : "border-muted-foreground/30 hover:border-emerald-500 hover:bg-emerald-500/10"
          )}
          title={t.concluida ? "Reabrir" : "Concluir"}
        >
          {t.concluida && <CheckCircle2 className="h-4 w-4" />}
        </button>

        {/* Selecionar */}
        <Checkbox checked={selected} onCheckedChange={() => multiSelect.toggleItem(t.id)} className="rounded-md shrink-0" />

        {/* Conteúdo */}
        <div className="flex-1 min-w-0">
          <p className={cn("font-bold truncate", t.concluida && "line-through text-muted-foreground")}>{t.titulo}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-[11px] text-muted-foreground font-medium">
            {t.cliente_nome && <span className="flex items-center gap-1 truncate"><User className="h-3 w-3 shrink-0" />{t.cliente_nome}</span>}
            {t.processo_id && processoMap[t.processo_id] && <span className="flex items-center gap-1 truncate max-w-[180px]"><FileText className="h-3 w-3 shrink-0" />{processoMap[t.processo_id]}</span>}
            {t.atendimento_id && atendimentoMap[t.atendimento_id] && <span className="flex items-center gap-1 truncate"><MessageSquare className="h-3 w-3 shrink-0" />{atendimentoMap[t.atendimento_id]}</span>}
            {due && <span className={cn("flex items-center gap-1", due.cls)}><Clock className="h-3 w-3" />{due.label}</span>}
          </div>
        </div>

        {/* Prioridade */}
        {!t.concluida && (
          <Badge variant="outline" className={cn("shrink-0 rounded-lg px-2 py-0.5 text-[9px] font-black uppercase tracking-widest", meta.cls)}>{meta.label}</Badge>
        )}

        {/* Ações */}
        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg" onClick={() => openEdit(t)}><Pencil className="h-3.5 w-3.5" /></Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg"><MoreHorizontal className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl w-40">
              <DropdownMenuItem className="rounded-lg gap-2" onClick={() => toggle.mutate({ id: t.id, concluida: !t.concluida })}>
                <CheckCircle2 className="h-4 w-4" /> {t.concluida ? "Reabrir" : "Concluir"}
              </DropdownMenuItem>
              <DropdownMenuItem className="rounded-lg gap-2 text-destructive focus:text-destructive" onClick={() => { multiSelect.clearSelection(); multiSelect.toggleItem(t.id); setDeleteDialogOpen(true); }}>
                <Trash2 className="h-4 w-4" /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 p-4 md:p-6 space-y-5 overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500 border border-purple-500/20"><CheckSquare className="h-5 w-5" /></div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Tarefas</h1>
            <p className="text-sm text-muted-foreground">Organize e acompanhe seus afazeres.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!multiSelect.isNoneSelected && (
            <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)} className="rounded-xl h-10 gap-2 font-bold">
              <Trash2 className="h-4 w-4" /> Excluir ({multiSelect.selectedCount})
            </Button>
          )}
          <Button onClick={openNew} className="rounded-xl h-10 gap-2 font-bold shadow-sm">
            <Plus className="h-4 w-4" /> Nova Tarefa
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <StatCard icon={ListChecks} label="Pendentes" value={stats.pendentes} color="text-purple-500" bg="bg-purple-500/10" />
        <StatCard icon={AlertTriangle} label="Atrasadas" value={stats.atrasadas} color="text-rose-500" bg="bg-rose-500/10" />
        <StatCard icon={Flame} label="Vencem hoje" value={stats.hoje} color="text-orange-500" bg="bg-orange-500/10" />
        <StatCard icon={CheckCircle2} label="Concluídas" value={stats.concluidas} color="text-emerald-500" bg="bg-emerald-500/10" />
      </div>

      {/* Gamificação */}
      <div className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.06] to-transparent p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary"><Trophy className="h-5 w-5" /></div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-primary/60">Nível {game.nivel}</p>
              <p className="text-lg font-black leading-none">{game.pontos} <span className="text-xs font-bold text-muted-foreground">pts</span></p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 px-3 py-1.5 rounded-xl bg-orange-500/10 text-orange-500">
            <Flame className="h-4 w-4" />
            <span className="text-sm font-black">{game.streak}</span>
            <span className="text-[10px] font-bold uppercase tracking-widest">dia{game.streak === 1 ? "" : "s"} seguidos</span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest mb-1.5">
              <span className="text-muted-foreground/70 flex items-center gap-1.5"><Target className="h-3 w-3" /> Meta semanal</span>
              <span className="text-primary">{game.concluidasSemana} / {game.metaSemanal}</span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-black/5 dark:bg-muted/30 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-500" style={{ width: `${game.progresso}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Avisos de série de recorrência acabando */}
      {seriesAcabando.map((s) => (
        <div key={s.grupo} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3.5 rounded-2xl border border-amber-500/30 bg-amber-500/[0.06]">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0"><Repeat className="h-4 w-4" /></div>
            <p className="text-sm font-semibold min-w-0">
              A recorrência <span className="font-black">"{s.titulo}"</span> ({recorrenciaLabel(s.regra)}) está acabando —
              resta{s.restantes === 1 ? "" : "m"} <span className="font-black text-amber-600 dark:text-amber-400">{s.restantes}</span>.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" onClick={() => handleExtend(s.grupo)} disabled={createMany.isPending}
              className="rounded-xl h-9 gap-1.5 font-bold bg-amber-500 hover:bg-amber-600 text-white">
              <Plus className="h-3.5 w-3.5" /> Estender +4
            </Button>
            <Button size="sm" variant="ghost" onClick={() => persistDismissed(new Set(dismissed).add(s.grupo))}
              className="rounded-xl h-9 gap-1.5 font-bold text-muted-foreground">
              <X className="h-3.5 w-3.5" /> Dispensar
            </Button>
          </div>
        </div>
      ))}

      {/* Filtros */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
          <Input placeholder="Buscar por título, cliente ou descrição..." value={search}
            onChange={(e) => setSearch(e.target.value)} className="pl-10 h-11 rounded-xl bg-card/40 border-black/5 dark:border-border" />
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-36 h-11 rounded-xl bg-card/40 border-black/5 dark:border-border font-bold"><SelectValue /></SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="pendentes">Pendentes</SelectItem>
              <SelectItem value="concluidas">Concluídas</SelectItem>
              <SelectItem value="todas">Todas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={prioridadeFilter} onValueChange={setPrioridadeFilter}>
            <SelectTrigger className="w-full md:w-36 h-11 rounded-xl bg-card/40 border-black/5 dark:border-border font-bold"><SelectValue placeholder="Prioridade" /></SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="todas">Toda prioridade</SelectItem>
              <SelectItem value="alta">Alta</SelectItem>
              <SelectItem value="media">Média</SelectItem>
              <SelectItem value="baixa">Baixa</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-2.5">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 rounded-2xl bg-black/[0.03] dark:bg-muted/20 animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-20 gap-4">
          <div className="p-5 rounded-full bg-purple-500/10 text-purple-500"><CheckSquare className="h-10 w-10 opacity-70" /></div>
          <div>
            <p className="font-black text-lg">Nenhuma tarefa {tarefas.length > 0 ? "encontrada" : "cadastrada"}</p>
            <p className="text-sm text-muted-foreground mt-1">{tarefas.length > 0 ? "Ajuste a busca ou os filtros." : "Comece criando sua primeira tarefa."}</p>
          </div>
          {tarefas.length === 0 && <Button onClick={openNew} className="rounded-xl gap-2 font-bold"><Plus className="h-4 w-4" /> Nova Tarefa</Button>}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center gap-3 px-1">
            <Checkbox checked={multiSelect.isAllSelected} onCheckedChange={() => multiSelect.isAllSelected ? multiSelect.clearSelection() : multiSelect.selectAll()} className="rounded-md" />
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
              {multiSelect.selectedCount > 0 ? `${multiSelect.selectedCount} selecionada(s)` : "Selecionar todas"}
            </span>
          </div>
          {Object.entries(groups).map(([label, items]) =>
            items.length === 0 ? null : (
              <div key={label} className="space-y-2">
                <p className={cn("text-[10px] font-black uppercase tracking-widest px-1 flex items-center gap-2", groupColor[label])}>
                  {label} <span className="text-muted-foreground/30">·</span> <span className="opacity-70">{items.length}</span>
                </p>
                <div className="space-y-2">{items.map(renderCard)}</div>
              </div>
            )
          )}
        </div>
      )}

      <NovaTarefaDialog open={dialogOpen} onOpenChange={setDialogOpen}
        clientes={clientes} processos={processos} atendimentos={atendimentos}
        membros={membros}
        tarefa={editTarget} onSubmit={handleSubmit} onSubmitMany={handleSubmitMany} />

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        title="Excluir Tarefas"
        description={`Tem certeza que deseja excluir ${multiSelect.selectedCount} tarefa(s)? Esta ação pode ser desfeita na lixeira.`}
        isLoading={remove.isPending}
      />
    </div>
  );
};

export default Tarefas;
