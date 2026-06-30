import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams, useLocation, useNavigate } from "react-router-dom";
import { Calendar, Clock, Users, MapPin, Plus, CalendarCheck, AlertCircle, ArrowRight, CalendarClock, MessageSquare, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { NovoCompromissoDialog } from "@/components/Agenda/NovoCompromissoDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FullScreenCalendar } from "@/components/ui/fullscreen-calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { format, isToday, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAgendaEvents, AgendaEvent } from "@/hooks/useAgendaEvents";
import { AgendaItemDialog, AgendaType } from "@/components/Dashboard/AgendaItemDialog";

const typeMeta: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  audiencia:   { label: "Audiência", icon: Users, color: "text-orange-500", bg: "bg-orange-500/10" },
  prazo:       { label: "Prazo", icon: AlertCircle, color: "text-rose-500", bg: "bg-rose-500/10" },
  atendimento: { label: "Atendimento", icon: MessageSquare, color: "text-blue-500", bg: "bg-blue-500/10" },
  reuniao:     { label: "Reunião", icon: Calendar, color: "text-blue-500", bg: "bg-blue-500/10" },
  tarefa:      { label: "Tarefa", icon: CalendarCheck, color: "text-purple-500", bg: "bg-purple-500/10" },
};

const statusColor = (s: string) =>
  s === "confirmado" || s === "concluido" ? "text-emerald-600 bg-emerald-500/10" :
  s === "cancelado" ? "text-rose-600 bg-rose-500/10" :
  "text-amber-600 bg-amber-500/10";

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

export default function Agenda() {
  const [novoOpen, setNovoOpen] = useState(false);
  const [selectedDateForNew, setSelectedDateForNew] = useState<Date>(new Date());
  const [currentViewMonth, setCurrentViewMonth] = useState(new Date());
  const [typeFilter, setTypeFilter] = useState<string>("todos");
  const [search, setSearch] = useState("");
  const [dayDetail, setDayDetail] = useState<Date | null>(null);
  const [openItem, setOpenItem] = useState<{ type: AgendaType; id: string } | null>(null);

  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const { events, loading, getEventsForDay, refresh } = useAgendaEvents(currentViewMonth);

  // Busca global: vai ao mês do evento (?date) e destaca (?openId)
  useEffect(() => {
    const dateStr = searchParams.get("date");
    if (dateStr) setCurrentViewMonth(new Date(dateStr));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  useEffect(() => {
    const openId = searchParams.get("openId");
    if (!openId || loading) return;
    const t = setTimeout(() => {
      const el = document.getElementById(`item-${openId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("search-highlight");
        setTimeout(() => el.classList.remove("search-highlight"), 2400);
      }
      navigate("/agenda", { replace: true });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, events, location.search]);

  const handleMonthChange = useCallback((date: Date) => {
    setCurrentViewMonth(prev =>
      prev.getFullYear() === date.getFullYear() && prev.getMonth() === date.getMonth() ? prev : date
    );
  }, []);

  const filteredEvents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter(e => {
      const matchesType = typeFilter === "todos" || e.type === typeFilter;
      const matchesSearch = !q || e.name.toLowerCase().includes(q) || (e.client || "").toLowerCase().includes(q);
      return matchesType && matchesSearch;
    });
  }, [events, typeFilter, search]);

  const monthData = useMemo(() => {
    const days = eachDayOfInterval({ start: startOfMonth(currentViewMonth), end: endOfMonth(currentViewMonth) });
    return days.map(day => ({ day, events: filteredEvents.filter(e => isSameDay(new Date(e.datetime), day)) }));
  }, [currentViewMonth, filteredEvents]);

  // Próximos: a partir de hoje, ordenados
  const proximos = useMemo(() => {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    return filteredEvents.filter(e => new Date(e.datetime) >= now);
  }, [filteredEvents]);

  // Agrupar próximos por dia
  const proximosPorDia = useMemo(() => {
    const map: Record<string, AgendaEvent[]> = {};
    for (const e of proximos) {
      const k = format(new Date(e.datetime), "yyyy-MM-dd");
      (map[k] ||= []).push(e);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [proximos]);

  const stats = useMemo(() => {
    const today = new Date();
    const in7 = new Date(Date.now() + 7 * 86400000);
    return {
      hoje: events.filter(e => isSameDay(new Date(e.datetime), today)).length,
      semana: events.filter(e => { const d = new Date(e.datetime); return d >= today && d <= in7; }).length,
      audiencias: events.filter(e => e.type === "audiencia").length,
      prazos: events.filter(e => e.type === "prazo").length,
    };
  }, [events]);

  // Clicar num evento abre o modal in-place (não navega) — igual ao dashboard
  const goToSource = (e: AgendaEvent) => {
    const type = (e.type === "reuniao" ? "atendimento" : e.type) as AgendaType;
    setOpenItem({ type, id: String(e.id) });
  };

  const handleNewEvent = (date: Date) => { setSelectedDateForNew(date); setNovoOpen(true); };

  const EventRow = ({ e }: { e: AgendaEvent }) => {
    const m = typeMeta[e.type] || typeMeta.reuniao;
    return (
      <button id={`item-${e.id}`} onClick={() => goToSource(e)}
        className="w-full flex items-center gap-3 p-3 rounded-xl border border-black/5 dark:border-border bg-card/40 hover:shadow-md hover:border-black/10 dark:hover:border-white/15 transition-all text-left group">
        <div className={cn("p-2 rounded-lg shrink-0", m.bg)}><m.icon className={cn("h-4 w-4", m.color)} /></div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold truncate group-hover:text-primary transition-colors">{e.name}</p>
          <div className="flex flex-wrap items-center gap-x-3 text-[11px] text-muted-foreground font-medium mt-0.5">
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{e.time}</span>
            {e.client && <span className="truncate">{e.client}</span>}
            {e.location && <span className="flex items-center gap-1 truncate"><MapPin className="h-3 w-3 shrink-0" />{e.location}</span>}
          </div>
        </div>
        <Badge variant="outline" className={cn("shrink-0 rounded-lg text-[9px] font-black uppercase tracking-widest px-2 py-0.5", m.color, m.bg)}>{m.label}</Badge>
        <ArrowRight className="h-4 w-4 text-muted-foreground/20 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
      </button>
    );
  };

  const typeChips = [
    { value: "todos", label: "Todos" },
    { value: "audiencia", label: "Audiências" },
    { value: "prazo", label: "Prazos" },
    { value: "atendimento", label: "Atendimentos" },
    { value: "tarefa", label: "Tarefas" },
  ];

  return (
    <div className="flex-1 p-4 md:p-6 space-y-5 overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20"><Calendar className="h-5 w-5" /></div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Agenda</h1>
            <p className="text-sm text-muted-foreground">Audiências, prazos, reuniões e tarefas em um só lugar.</p>
          </div>
        </div>
        <Button onClick={() => handleNewEvent(new Date())} className="rounded-xl h-10 gap-2 font-bold shadow-sm">
          <Plus className="h-4 w-4" /> Novo Compromisso
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <StatCard icon={Calendar} label="Hoje" value={stats.hoje} color="text-primary" bg="bg-primary/10" />
        <StatCard icon={CalendarClock} label="Próximos 7 dias" value={stats.semana} color="text-blue-500" bg="bg-blue-500/10" />
        <StatCard icon={Users} label="Audiências no mês" value={stats.audiencias} color="text-orange-500" bg="bg-orange-500/10" />
        <StatCard icon={AlertCircle} label="Prazos no mês" value={stats.prazos} color="text-rose-500" bg="bg-rose-500/10" />
      </div>

      {/* Busca + filtro por tipo */}
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="relative md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
          <Input placeholder="Buscar por título ou cliente..." value={search}
            onChange={(e) => setSearch(e.target.value)} className="pl-10 h-10 rounded-xl bg-card/40 border-black/5 dark:border-border" />
        </div>
        <div className="flex flex-wrap gap-2">
          {typeChips.map(c => (
            <button key={c.value} onClick={() => setTypeFilter(c.value)}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border",
                typeFilter === c.value ? "bg-primary text-primary-foreground border-primary" : "bg-card/40 border-black/5 dark:border-border hover:border-black/10 dark:hover:border-white/15"
              )}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Legenda de cores */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1">
        {[
          { label: "Audiências", c: "bg-orange-500" },
          { label: "Prazos", c: "bg-rose-500" },
          { label: "Atendimentos", c: "bg-blue-500" },
          { label: "Tarefas", c: "bg-purple-500" },
        ].map(l => (
          <span key={l.label} className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
            <span className={cn("h-2.5 w-2.5 rounded-full", l.c)} /> {l.label}
          </span>
        ))}
      </div>

      <Tabs defaultValue="lista" className="space-y-4">
        <TabsList className="rounded-xl bg-card/40 border border-black/5 dark:border-border p-1 h-auto">
          <TabsTrigger value="lista" className="rounded-lg px-6 py-2 text-xs font-black uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Lista</TabsTrigger>
          <TabsTrigger value="calendario" className="rounded-lg px-6 py-2 text-xs font-black uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Calendário</TabsTrigger>
        </TabsList>

        {/* LISTA */}
        <TabsContent value="lista" className="space-y-5">
          {loading ? (
            <div className="space-y-2.5">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 rounded-xl bg-black/[0.03] dark:bg-muted/20 animate-pulse" />)}</div>
          ) : proximosPorDia.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-20 gap-4">
              <div className="p-5 rounded-full bg-primary/10 text-primary"><Calendar className="h-10 w-10 opacity-70" /></div>
              <div>
                <p className="font-black text-lg">Agenda livre</p>
                <p className="text-sm text-muted-foreground mt-1">Nenhum compromisso futuro {typeFilter !== "todos" ? "deste tipo " : ""}neste mês.</p>
              </div>
              <Button onClick={() => handleNewEvent(new Date())} className="rounded-xl gap-2 font-bold"><Plus className="h-4 w-4" /> Novo Compromisso</Button>
            </div>
          ) : (
            proximosPorDia.map(([dayKey, items]) => {
              const d = parseISO(dayKey);
              return (
                <div key={dayKey} className="space-y-2">
                  <p className={cn("text-[10px] font-black uppercase tracking-widest px-1 flex items-center gap-2", isToday(d) ? "text-primary" : "text-muted-foreground/50")}>
                    {format(d, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                    {isToday(d) && <Badge className="bg-primary text-primary-foreground text-[8px] px-1.5 py-0 rounded-full uppercase">Hoje</Badge>}
                    <span className="text-muted-foreground/30">·</span><span className="opacity-70">{items.length}</span>
                  </p>
                  <div className="space-y-2">{items.map(e => <EventRow key={e.id} e={e} />)}</div>
                </div>
              );
            })
          )}
        </TabsContent>

        {/* CALENDÁRIO */}
        <TabsContent value="calendario" className="m-0">
          <div className="rounded-2xl border border-black/5 dark:border-border bg-card/40 overflow-hidden">
            <FullScreenCalendar data={monthData} onEventClick={goToSource} onNewEvent={handleNewEvent} onMonthChange={handleMonthChange} onDayClick={setDayDetail} />
          </div>
        </TabsContent>
      </Tabs>

      <NovoCompromissoDialog open={novoOpen} onOpenChange={setNovoOpen} selectedDate={selectedDateForNew} onCreated={refresh} />

      <AgendaItemDialog item={openItem} onOpenChange={(o) => !o && setOpenItem(null)} onChanged={refresh} />

      {/* Detalhe do dia (ao clicar num dia / "+N mais" no calendário) */}
      <Dialog open={!!dayDetail} onOpenChange={(o) => !o && setDayDetail(null)}>
        <DialogContent className="max-w-lg rounded-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-black capitalize">
              {dayDetail ? format(dayDetail, "EEEE, dd 'de' MMMM", { locale: ptBR }) : ""}
            </DialogTitle>
            <DialogDescription>Compromissos do dia.</DialogDescription>
          </DialogHeader>
          {(() => {
            if (!dayDetail) return null;
            const dayEvents = filteredEvents
              .filter(e => isSameDay(new Date(e.datetime), dayDetail))
              .sort((a, b) => a.datetime.localeCompare(b.datetime));
            if (dayEvents.length === 0) {
              return (
                <div className="flex flex-col items-center text-center py-8 gap-3">
                  <div className="p-4 rounded-full bg-primary/10 text-primary"><Calendar className="h-8 w-8 opacity-70" /></div>
                  <p className="text-sm text-muted-foreground font-semibold">Nenhum compromisso neste dia</p>
                  <Button onClick={() => { handleNewEvent(dayDetail); setDayDetail(null); }} className="rounded-xl gap-2 font-bold">
                    <Plus className="h-4 w-4" /> Novo Compromisso
                  </Button>
                </div>
              );
            }
            return (
              <div className="space-y-2">
                {dayEvents.map(e => <EventRow key={e.id} e={e} />)}
                <Button variant="outline" onClick={() => { handleNewEvent(dayDetail); setDayDetail(null); }} className="w-full rounded-xl gap-2 font-bold mt-2">
                  <Plus className="h-4 w-4" /> Adicionar neste dia
                </Button>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
