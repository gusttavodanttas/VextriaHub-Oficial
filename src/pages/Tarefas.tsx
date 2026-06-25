import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CheckSquare, Plus, Search, Trash2, Pencil, MoreHorizontal, User, Calendar,
  ListChecks, AlertTriangle, CheckCircle2, Flame, Clock,
} from "lucide-react";
import { DeleteConfirmDialog } from "@/components/ui/DeleteConfirmDialog";
import { NovaTarefaDialog } from "@/components/Tarefas/NovaTarefaDialog";
import { useMultiSelect } from "@/hooks/useMultiSelect";
import { useTarefas, type Tarefa, type TarefaInput } from "@/hooks/useTarefas";
import { useClientes } from "@/hooks/useClientes";
import { useOpenItemFromSearch } from "@/hooks/useOpenItemFromSearch";
import { cn } from "@/lib/utils";
import { format, isToday, isTomorrow, isThisWeek, isPast, parseISO, differenceInCalendarDays } from "date-fns";
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
  const { tarefas, isLoading, create, update, toggle, remove } = useTarefas();
  const { data: clientesData } = useClientes();
  const clientes = useMemo(() => (clientesData || []).map((c: any) => ({ id: c.id, nome: c.nome })), [clientesData]);

  const [search, setSearch] = useState("");
  const [prioridadeFilter, setPrioridadeFilter] = useState("todas");
  const [statusFilter, setStatusFilter] = useState("pendentes");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Tarefa | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const filtered = useMemo(() => tarefas.filter(t => {
    const q = search.toLowerCase();
    const matchesSearch = !q || t.titulo?.toLowerCase().includes(q) || (t.cliente_nome || "").toLowerCase().includes(q) || (t.descricao || "").toLowerCase().includes(q);
    const matchesPrio = prioridadeFilter === "todas" || t.prioridade === prioridadeFilter;
    const matchesStatus = statusFilter === "todas" || (statusFilter === "pendentes" ? !t.concluida : t.concluida);
    return matchesSearch && matchesPrio && matchesStatus;
  }), [tarefas, search, prioridadeFilter, statusFilter]);

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

  useOpenItemFromSearch("/tarefas", !isLoading && tarefas.length > 0);

  const handleSubmit = async (input: TarefaInput, id?: string) => {
    if (id) await update.mutateAsync({ id, input });
    else await create.mutateAsync(input);
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

      <NovaTarefaDialog open={dialogOpen} onOpenChange={setDialogOpen} clientes={clientes} tarefa={editTarget} onSubmit={handleSubmit} />

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
