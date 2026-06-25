import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Calendar, Clock, MapPin, User, Users, Plus, Search, Trash2, Pencil,
  CheckCircle2, XCircle, MoreHorizontal, CalendarCheck, CalendarClock, Gavel, Loader2, Tag,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { DeleteConfirmDialog } from "@/components/ui/DeleteConfirmDialog";
import { NovaAudienciaDialog } from "@/components/Audiencias/NovaAudienciaDialog";
import { GerenciarTiposDialog } from "@/components/Audiencias/GerenciarTiposDialog";
import { useAudienciaTipos } from "@/hooks/useAudienciaTipos";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMultiSelect } from "@/hooks/useMultiSelect";
import { useAudiencias, type Audiencia, type AudienciaInput } from "@/hooks/useAudiencias";
import { useClientes } from "@/hooks/useClientes";
import { cn } from "@/lib/utils";
import { format, isToday, isTomorrow, isThisWeek, isPast, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const statusMeta: Record<string, { label: string; cls: string; dot: string }> = {
  agendada:   { label: "Agendada",   cls: "border-blue-500/30 text-blue-600 dark:text-blue-400 bg-blue-500/10", dot: "bg-blue-500" },
  confirmada: { label: "Confirmada", cls: "border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10", dot: "bg-emerald-500" },
  pendente:   { label: "Pendente",   cls: "border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10", dot: "bg-amber-500" },
  realizada:  { label: "Realizada",  cls: "border-muted/40 text-muted-foreground bg-muted/20", dot: "bg-muted-foreground" },
  cancelada:  { label: "Cancelada",  cls: "border-rose-500/30 text-rose-600 dark:text-rose-400 bg-rose-500/10 line-through", dot: "bg-rose-500" },
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

const Audiencias = () => {
  const { audiencias, isLoading, create, update, updateStatus, remove } = useAudiencias();
  const { data: clientesData } = useClientes();
  const { tipos: tiposCadastrados } = useAudienciaTipos();
  const clientes = useMemo(() => (clientesData || []).map((c: any) => ({ id: c.id, nome: c.nome })), [clientesData]);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("todas");
  const [tipoFilter, setTipoFilter] = useState("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tiposDialogOpen, setTiposDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Audiencia | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [calSelected, setCalSelected] = useState<Date | undefined>(new Date());

  // União dos tipos cadastrados (gerenciáveis) + tipos já usados em audiências
  const tipos = useMemo(() => {
    const set = new Set<string>(tiposCadastrados);
    audiencias.forEach(a => { if (a.tipo) set.add(a.tipo); });
    return Array.from(set);
  }, [tiposCadastrados, audiencias]);

  const filtered = useMemo(() => audiencias.filter(a => {
    const q = searchTerm.toLowerCase();
    const matchesSearch = !q || a.titulo?.toLowerCase().includes(q) || (a.cliente_nome || "").toLowerCase().includes(q) || (a.local || "").toLowerCase().includes(q);
    const matchesStatus = statusFilter === "todas" || a.status === statusFilter;
    const matchesTipo = tipoFilter === "todos" || a.tipo === tipoFilter;
    return matchesSearch && matchesStatus && matchesTipo;
  }), [audiencias, searchTerm, statusFilter, tipoFilter]);

  const multiSelect = useMultiSelect(filtered);

  // Estatísticas
  const stats = useMemo(() => {
    const now = new Date();
    const in7 = new Date(Date.now() + 7 * 86400000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      proximas: audiencias.filter(a => { const d = parseISO(a.data_audiencia); return d >= now && d <= in7 && a.status !== "cancelada"; }).length,
      hoje: audiencias.filter(a => isToday(parseISO(a.data_audiencia)) && a.status !== "cancelada").length,
      confirmadas: audiencias.filter(a => a.status === "confirmada").length,
      realizadasMes: audiencias.filter(a => a.status === "realizada" && parseISO(a.data_audiencia) >= monthStart).length,
    };
  }, [audiencias]);

  // Agrupamento por período (apenas não-passadas em "agenda", passadas no fim)
  const groups = useMemo(() => {
    const g: Record<string, Audiencia[]> = { Hoje: [], Amanhã: [], "Esta semana": [], Futuras: [], Anteriores: [] };
    for (const a of filtered) {
      const d = parseISO(a.data_audiencia);
      if (isToday(d)) g.Hoje.push(a);
      else if (isTomorrow(d)) g.Amanhã.push(a);
      else if (isThisWeek(d, { weekStartsOn: 1 }) && !isPast(d)) g["Esta semana"].push(a);
      else if (isPast(d)) g.Anteriores.push(a);
      else g.Futuras.push(a);
    }
    return g;
  }, [filtered]);

  const markedDays = useMemo(() => audiencias.map(a => parseISO(a.data_audiencia)), [audiencias]);
  const calKey = calSelected ? format(calSelected, "yyyy-MM-dd") : null;
  const calDayEvents = useMemo(() =>
    audiencias.filter(a => calKey && format(parseISO(a.data_audiencia), "yyyy-MM-dd") === calKey)
      .sort((a, b) => a.data_audiencia.localeCompare(b.data_audiencia)),
  [audiencias, calKey]);

  const handleSubmit = async (input: AudienciaInput, id?: string) => {
    if (id) await update.mutateAsync({ id, input });
    else await create.mutateAsync(input);
  };

  const openNew = () => { setEditTarget(null); setDialogOpen(true); };
  const openEdit = (a: Audiencia) => { setEditTarget(a); setDialogOpen(true); };

  const handleConfirmDelete = async () => {
    const ids = multiSelect.getSelectedItems().map(i => i.id);
    await remove.mutateAsync(ids);
    multiSelect.clearSelection();
    setDeleteDialogOpen(false);
  };

  const renderCard = (a: Audiencia) => {
    const d = parseISO(a.data_audiencia);
    const meta = statusMeta[a.status || "agendada"] || statusMeta.agendada;
    const selected = multiSelect.isSelected(a.id);
    return (
      <div key={a.id} id={`item-${a.id}`}
        className={cn(
          "group flex items-stretch gap-4 p-4 rounded-2xl border bg-card/40 transition-all hover:shadow-md",
          selected ? "border-primary/40 ring-2 ring-primary/10 bg-primary/[0.02]" : "border-black/5 dark:border-border hover:border-black/10 dark:hover:border-white/15"
        )}>
        {/* Data */}
        <div className="flex flex-col items-center justify-center shrink-0 w-16 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400">
          <span className="text-[9px] font-black uppercase">{format(d, "MMM", { locale: ptBR })}</span>
          <span className="text-2xl font-black leading-none">{format(d, "dd")}</span>
          <span className="text-[10px] font-bold mt-0.5">{format(d, "HH:mm")}</span>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <Checkbox checked={selected} onCheckedChange={() => multiSelect.toggleItem(a.id)} className="rounded-md mt-1 shrink-0" />
              <div className="min-w-0">
                <h3 className="font-black tracking-tight truncate group-hover:text-primary transition-colors">{a.titulo}</h3>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] text-muted-foreground font-medium">
                  {a.cliente_nome && <span className="flex items-center gap-1 truncate"><User className="h-3 w-3 shrink-0" />{a.cliente_nome}</span>}
                  {a.local && <span className="flex items-center gap-1 truncate"><MapPin className="h-3 w-3 shrink-0" />{a.local}</span>}
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{format(d, "EEEE", { locale: ptBR })}</span>
                </div>
              </div>
            </div>
            <Badge variant="outline" className={cn("shrink-0 rounded-lg px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest", meta.cls)}>{meta.label}</Badge>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            {a.tipo
              ? <Badge variant="outline" className="rounded-lg border-primary/20 text-primary bg-primary/5 text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5">{a.tipo}</Badge>
              : <span />}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button variant="ghost" size="sm" className="h-8 px-2 rounded-lg gap-1 text-xs font-bold" onClick={() => openEdit(a)}>
                <Pencil className="h-3.5 w-3.5" /> Editar
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg"><MoreHorizontal className="h-4 w-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-xl w-44">
                  <DropdownMenuItem className="rounded-lg gap-2 text-emerald-600 focus:text-emerald-600" onClick={() => updateStatus.mutate({ id: a.id, status: "confirmada" })}>
                    <CheckCircle2 className="h-4 w-4" /> Confirmar
                  </DropdownMenuItem>
                  <DropdownMenuItem className="rounded-lg gap-2" onClick={() => updateStatus.mutate({ id: a.id, status: "realizada" })}>
                    <Gavel className="h-4 w-4" /> Marcar realizada
                  </DropdownMenuItem>
                  <DropdownMenuItem className="rounded-lg gap-2 text-rose-600 focus:text-rose-600" onClick={() => updateStatus.mutate({ id: a.id, status: "cancelada" })}>
                    <XCircle className="h-4 w-4" /> Cancelar
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="rounded-lg gap-2 text-destructive focus:text-destructive" onClick={() => { multiSelect.clearSelection(); multiSelect.toggleItem(a.id); setDeleteDialogOpen(true); }}>
                    <Trash2 className="h-4 w-4" /> Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 p-4 md:p-6 space-y-5 overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-orange-500/10 text-orange-500 border border-orange-500/20"><Users className="h-5 w-5" /></div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Audiências</h1>
            <p className="text-sm text-muted-foreground">Gerencie seus compromissos judiciais.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!multiSelect.isNoneSelected && (
            <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)} className="rounded-xl h-10 gap-2 font-bold">
              <Trash2 className="h-4 w-4" /> Excluir ({multiSelect.selectedCount})
            </Button>
          )}
          <Button onClick={openNew} className="rounded-xl h-10 gap-2 font-bold shadow-sm">
            <Plus className="h-4 w-4" /> Nova Audiência
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <StatCard icon={CalendarClock} label="Próximas 7 dias" value={stats.proximas} color="text-orange-500" bg="bg-orange-500/10" />
        <StatCard icon={Calendar} label="Hoje" value={stats.hoje} color="text-blue-500" bg="bg-blue-500/10" />
        <StatCard icon={CheckCircle2} label="Confirmadas" value={stats.confirmadas} color="text-emerald-500" bg="bg-emerald-500/10" />
        <StatCard icon={CalendarCheck} label="Realizadas no mês" value={stats.realizadasMes} color="text-purple-500" bg="bg-purple-500/10" />
      </div>

      {/* Filtros */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
          <Input placeholder="Buscar por título, cliente ou local..." value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 h-11 rounded-xl bg-card/40 border-black/5 dark:border-border" />
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-40 h-11 rounded-xl bg-card/40 border-black/5 dark:border-border font-bold"><SelectValue /></SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="todas">Todos status</SelectItem>
              {Object.entries(statusMeta).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={tipoFilter} onValueChange={setTipoFilter}>
            <SelectTrigger className="w-full md:w-40 h-11 rounded-xl bg-card/40 border-black/5 dark:border-border font-bold"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="todos">Todos tipos</SelectItem>
              {tipos.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => setTiposDialogOpen(true)}
            className="h-11 rounded-xl gap-2 font-bold border-black/5 dark:border-border shrink-0" title="Gerenciar tipos de audiência">
            <Tag className="h-4 w-4" /> <span className="hidden sm:inline">Tipos</span>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="lista" className="space-y-4">
        <TabsList className="rounded-xl bg-card/40 border border-black/5 dark:border-border p-1 h-auto">
          <TabsTrigger value="lista" className="rounded-lg px-6 py-2 text-xs font-black uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Lista</TabsTrigger>
          <TabsTrigger value="calendario" className="rounded-lg px-6 py-2 text-xs font-black uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Calendário</TabsTrigger>
        </TabsList>

        {/* LISTA */}
        <TabsContent value="lista" className="space-y-5">
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 rounded-2xl bg-black/[0.03] dark:bg-muted/20 animate-pulse" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-20 gap-4">
              <div className="p-5 rounded-full bg-orange-500/10 text-orange-500"><Calendar className="h-10 w-10 opacity-70" /></div>
              <div>
                <p className="font-black text-lg">Nenhuma audiência {audiencias.length > 0 ? "encontrada" : "agendada"}</p>
                <p className="text-sm text-muted-foreground mt-1">{audiencias.length > 0 ? "Ajuste os filtros de busca." : "Comece agendando sua primeira audiência."}</p>
              </div>
              {audiencias.length === 0 && <Button onClick={openNew} className="rounded-xl gap-2 font-bold"><Plus className="h-4 w-4" /> Nova Audiência</Button>}
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 px-1">
                <Checkbox checked={multiSelect.isAllSelected} onCheckedChange={() => multiSelect.isAllSelected ? multiSelect.clearSelection() : multiSelect.selectAll()} className="rounded-md" />
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                  {multiSelect.selectedCount > 0 ? `${multiSelect.selectedCount} selecionada(s)` : "Selecionar todas"}
                </span>
              </div>
              {Object.entries(groups).map(([label, items]) =>
                items.length === 0 ? null : (
                  <div key={label} className="space-y-2.5">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 px-1 flex items-center gap-2">
                      {label} <span className="text-muted-foreground/30">·</span> <span className="text-primary/60">{items.length}</span>
                    </p>
                    <div className="space-y-2.5">{items.map(renderCard)}</div>
                  </div>
                )
              )}
            </>
          )}
        </TabsContent>

        {/* CALENDÁRIO */}
        <TabsContent value="calendario">
          <Card className="rounded-2xl border-black/5 dark:border-border bg-card/40">
            <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-5">
              <CalendarUI mode="single" selected={calSelected} onSelect={setCalSelected} locale={ptBR}
                className="w-full rounded-xl border border-black/5 dark:border-border p-2"
                modifiers={{ hasEvents: markedDays }}
                modifiersClassNames={{ hasEvents: "font-black text-orange-500 relative after:absolute after:bottom-0.5 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-orange-500 after:content-['']" }}
              />
              <div className="space-y-2 md:border-l md:border-black/5 md:dark:border-border md:pl-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">
                  {calSelected ? format(calSelected, "dd 'de' MMMM", { locale: ptBR }) : "Selecione um dia"}
                </p>
                {calDayEvents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center py-12 gap-2 text-muted-foreground/40">
                    <Calendar className="h-7 w-7 opacity-50" />
                    <p className="text-xs font-semibold">Sem audiências nesta data</p>
                  </div>
                ) : calDayEvents.map(renderCard)}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <NovaAudienciaDialog open={dialogOpen} onOpenChange={setDialogOpen} clientes={clientes} tipos={tiposCadastrados} audiencia={editTarget} onSubmit={handleSubmit}
        onManageTipos={() => { setDialogOpen(false); setTiposDialogOpen(true); }} />

      <GerenciarTiposDialog open={tiposDialogOpen} onOpenChange={setTiposDialogOpen} />

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        title="Excluir Audiências"
        description={`Tem certeza que deseja excluir ${multiSelect.selectedCount} audiência(s)? Esta ação pode ser desfeita na lixeira.`}
        isLoading={remove.isPending}
      />
    </div>
  );
};

export default Audiencias;
