import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Clock, Play, Pause, Square, Timer, Plus, TrendingUp,
  FileText, Users, Phone, Gavel, Scale, Search, BookOpen,
  CalendarDays, CalendarClock, Link2, ChevronDown, ChevronUp,
  AlertCircle, CheckSquare, Calendar
} from "lucide-react";
import { useTimesheet } from "@/hooks/useTimesheet";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { TIMESHEET_CATEGORIAS, type TimesheetCategoria } from "@/types/timesheet";
import { cn } from "@/lib/utils";

// ─── Categoria config ──────────────────────────────────────────────────────────

const CATEGORIA_CONFIG: Record<TimesheetCategoria, { label: string; Icon: React.FC<any>; color: string }> = {
  atendimento:    { label: "Atendimento",    Icon: Phone,      color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  processo:       { label: "Processo",       Icon: Scale,      color: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  reuniao:        { label: "Reunião",        Icon: Users,      color: "bg-teal-500/10 text-teal-600 dark:text-teal-400" },
  administrativa: { label: "Administrativa", Icon: FileText,   color: "bg-orange-500/10 text-orange-600 dark:text-orange-400" },
  audiencia:      { label: "Audiência",      Icon: Gavel,      color: "bg-red-500/10 text-red-600 dark:text-red-400" },
  peticao:        { label: "Petição",        Icon: FileText,   color: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" },
  consulta:       { label: "Consulta",       Icon: BookOpen,   color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  pesquisa:       { label: "Pesquisa",       Icon: Search,     color: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
};

// ─── Referência config ────────────────────────────────────────────────────────

type ReferenciaTipo = "atendimento" | "audiencia" | "prazo" | "tarefa";

const REFERENCIA_CONFIG: Record<ReferenciaTipo, { label: string; Icon: React.FC<any>; color: string; table: string; labelField: string; dateField?: string }> = {
  atendimento: { label: "Atendimento",  Icon: Phone,         color: "bg-blue-500/10 text-blue-600 dark:text-blue-400",    table: "atendimentos", labelField: "observacoes",    dateField: "data_atendimento" },
  audiencia:   { label: "Audiência",    Icon: Gavel,         color: "bg-red-500/10 text-red-600 dark:text-red-400",       table: "audiencias",   labelField: "titulo",         dateField: "data_audiencia" },
  prazo:       { label: "Prazo",        Icon: AlertCircle,   color: "bg-orange-500/10 text-orange-600 dark:text-orange-400", table: "prazos",    labelField: "titulo",         dateField: "data_vencimento" },
  tarefa:      { label: "Tarefa",       Icon: CheckSquare,   color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", table: "tarefas", labelField: "titulo",        dateField: "data_vencimento" },
};

interface ReferenciaItem { id: string; label: string; sublabel?: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatSeconds(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
}
function formatMinutes(min: number) {
  const h = Math.floor(min / 60), m = min % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}
function formatDateHeader(dateStr: string) {
  const d = new Date(dateStr), today = new Date(), yst = new Date(today);
  yst.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Hoje";
  if (d.toDateString() === yst.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
}

function StatCard({ label, value, Icon, color }: { label: string; value: string; Icon: React.FC<any>; color: string }) {
  return (
    <div className="glass-card rounded-2xl border border-black/5 dark:border-border bg-card/40 shadow-premium p-5 flex items-center gap-4">
      <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0", color)}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{label}</p>
        <p className="text-2xl font-black tracking-tight">{value}</p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Timesheet() {
  const { user } = useAuth();
  const { data: timesheets, loading, activeTimer, startTimer, pauseTimer, stopTimer, getTodayStats, getWeekStats } = useTimesheet();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [saving, setSaving] = useState(false);

  // Form
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState<TimesheetCategoria | "">("");

  // Vinculação
  const [mostrarVinculo, setMostrarVinculo] = useState(false);
  const [refTipo, setRefTipo] = useState<ReferenciaTipo | "">("");
  const [refItems, setRefItems] = useState<ReferenciaItem[]>([]);
  const [refLoading, setRefLoading] = useState(false);
  const [refId, setRefId] = useState("");
  const [refLabel, setRefLabel] = useState("");

  // Cronômetro
  useEffect(() => {
    if (!activeTimer || activeTimer.status !== "ativo") { setElapsedTime(0); return; }
    const tick = () => setElapsedTime(Math.floor((Date.now() - new Date(activeTimer.data_inicio).getTime()) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [activeTimer]);

  // Buscar itens ao selecionar tipo de referência
  useEffect(() => {
    if (!refTipo || !user) return;
    const cfg = REFERENCIA_CONFIG[refTipo];
    setRefItems([]);
    setRefId("");
    setRefLabel("");
    setRefLoading(true);

    const fetchItems = async () => {
      try {
        const { data } = await (supabase as any)
          .from(cfg.table)
          .select(`id, ${cfg.labelField}${cfg.dateField ? `, ${cfg.dateField}` : ""}`)
          .eq("user_id", user.id)
          .eq("deletado", false)
          .order(cfg.dateField || "created_at", { ascending: false })
          .limit(50);

        if (data) {
          setRefItems(data.map((row: any) => ({
            id: row.id,
            label: row[cfg.labelField] || "Sem título",
            sublabel: cfg.dateField ? new Date(row[cfg.dateField]).toLocaleDateString("pt-BR") : undefined,
          })));
        }
      } finally {
        setRefLoading(false);
      }
    };
    fetchItems();
  }, [refTipo, user]);

  const resetDialog = () => {
    setDescricao(""); setCategoria("");
    setMostrarVinculo(false); setRefTipo(""); setRefItems([]); setRefId(""); setRefLabel("");
  };

  const handleStart = async () => {
    if (!descricao || !categoria) return;
    setSaving(true);
    await startTimer(
      descricao,
      categoria as TimesheetCategoria,
      undefined,
      undefined,
      refTipo || undefined,
      refId || undefined,
      refLabel || undefined,
    );
    resetDialog();
    setDialogOpen(false);
    setSaving(false);
  };

  const todayStats = getTodayStats();
  const weekStats = getWeekStats();

  const grouped = timesheets
    .filter((t) => t.status !== "ativo")
    .reduce<Record<string, typeof timesheets>>((acc, t) => {
      const day = new Date(t.data_inicio).toDateString();
      if (!acc[day]) acc[day] = [];
      acc[day].push(t);
      return acc;
    }, {});

  const groupedEntries = Object.entries(grouped).sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime());

  const catCfg = activeTimer ? CATEGORIA_CONFIG[activeTimer.categoria as TimesheetCategoria] : null;

  // Badge de referência do timer ativo
  const activeRefCfg = activeTimer?.referencia_tipo ? REFERENCIA_CONFIG[activeTimer.referencia_tipo as ReferenciaTipo] : null;

  return (
    <div className="flex-1 p-4 md:p-8 space-y-8 overflow-x-hidden entry-animate">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            <Clock className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight">Timesheet</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Controle o tempo gasto em suas atividades jurídicas.</p>
          </div>
        </div>
        <Button size="lg" onClick={() => setDialogOpen(true)} disabled={!!activeTimer}
          className="rounded-xl h-11 px-6 font-black uppercase text-xs tracking-widest shadow-premium">
          <Plus className="mr-2 h-4 w-4" />Novo Timer
        </Button>
      </div>

      {/* Stats */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Hoje" value={todayStats.totalMinutos > 0 ? formatMinutes(todayStats.totalMinutos) : "0m"} Icon={CalendarDays} color="bg-primary/10 text-primary" />
          <StatCard label="Esta semana" value={weekStats.totalMinutos > 0 ? formatMinutes(weekStats.totalMinutos) : "0m"} Icon={CalendarClock} color="bg-violet-500/10 text-violet-500" />
          <StatCard label="Média diária" value={weekStats.totalRegistros > 0 ? formatMinutes(Math.round(weekStats.totalMinutos / 7)) : "0m"} Icon={TrendingUp} color="bg-emerald-500/10 text-emerald-500" />
        </div>
      )}

      {/* Timer ativo */}
      <div className={cn(
        "rounded-2xl border shadow-premium overflow-hidden transition-all duration-300",
        activeTimer ? "border-primary/30 bg-primary/[0.03]" : "border-black/5 dark:border-border bg-card/40"
      )}>
        {activeTimer ? (
          <div className="p-8 flex flex-col items-center gap-5">
            <div className="flex items-center gap-2 flex-wrap justify-center">
              {catCfg && (
                <div className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest", catCfg.color)}>
                  <catCfg.Icon className="h-3.5 w-3.5" />{catCfg.label}
                </div>
              )}
              {activeRefCfg && activeTimer.referencia_label && (
                <div className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest", activeRefCfg.color)}>
                  <activeRefCfg.Icon className="h-3.5 w-3.5" />{activeTimer.referencia_label}
                </div>
              )}
            </div>

            <p className="text-lg font-bold text-center text-foreground/80 max-w-md">{activeTimer.tarefa_descricao}</p>

            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
              <span className="relative text-7xl md:text-9xl font-black tracking-tighter tabular-nums text-foreground drop-shadow-[0_0_20px_rgba(var(--primary),0.25)]">
                {formatSeconds(elapsedTime)}
              </span>
            </div>

            {activeTimer.status === "ativo" && (
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-primary/70">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                </span>
                Em andamento
              </div>
            )}

            <div className="flex items-center gap-3">
              {activeTimer.status === "ativo" && (
                <Button variant="outline" onClick={() => pauseTimer(activeTimer.id)}
                  className="h-11 px-6 rounded-xl font-black text-xs uppercase tracking-wider border-black/10 dark:border-border">
                  <Pause className="h-4 w-4 mr-2" />Pausar
                </Button>
              )}
              <Button variant="destructive" onClick={() => stopTimer(activeTimer.id)}
                className="h-11 px-8 rounded-xl font-black text-xs uppercase tracking-wider shadow-premium">
                <Square className="h-4 w-4 mr-2 fill-current" />Finalizar
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-10 flex flex-col items-center gap-4 text-center">
            <div className="h-16 w-16 rounded-2xl bg-muted/20 border border-dashed border-border flex items-center justify-center">
              <Timer className="h-8 w-8 text-muted-foreground/30" />
            </div>
            <div>
              <p className="font-bold text-muted-foreground">Nenhum timer ativo</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Clique em "Novo Timer" para começar a registrar</p>
            </div>
            <Button onClick={() => setDialogOpen(true)} size="lg"
              className="mt-2 h-11 px-8 rounded-xl font-black text-xs uppercase tracking-widest shadow-premium">
              <Play className="h-4 w-4 mr-2 fill-current" />Iniciar Atividade
            </Button>
          </div>
        )}
      </div>

      {/* Registros */}
      <div className="space-y-6">
        <h2 className="text-lg font-black tracking-tight">Registros recentes</h2>
        {loading ? (
          <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
        ) : groupedEntries.length === 0 ? (
          <div className="rounded-2xl border border-black/5 dark:border-border bg-card/40 p-10 text-center">
            <Clock className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm font-bold text-muted-foreground">Nenhum registro ainda</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Inicie o timer para registrar suas atividades</p>
          </div>
        ) : (
          groupedEntries.map(([dayKey, entries]) => (
            <div key={dayKey} className="space-y-2">
              <div className="flex items-center gap-3">
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground/60 capitalize">
                  {formatDateHeader(entries[0].data_inicio)}
                </p>
                <div className="flex-1 h-px bg-border" />
                <p className="text-xs font-black text-muted-foreground/50">
                  {formatMinutes(entries.reduce((s,e) => s + (e.duracao_minutos || 0), 0))}
                </p>
              </div>

              {entries.map((t) => {
                const cfg = CATEGORIA_CONFIG[t.categoria as TimesheetCategoria];
                const rCfg = t.referencia_tipo ? REFERENCIA_CONFIG[t.referencia_tipo as ReferenciaTipo] : null;
                return (
                  <div key={t.id}
                    className="flex items-center gap-4 p-4 rounded-xl bg-card/60 border border-black/5 dark:border-border hover:border-primary/20 hover:shadow-sm transition-all">
                    {cfg ? (
                      <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", cfg.color)}>
                        <cfg.Icon className="h-4 w-4" />
                      </div>
                    ) : (
                      <div className="h-9 w-9 rounded-lg bg-muted/30 flex items-center justify-center shrink-0">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">{t.tarefa_descricao}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {cfg && <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{cfg.label}</span>}
                        {rCfg && t.referencia_label && (
                          <span className={cn("flex items-center gap-1 text-[10px] font-black px-1.5 py-0.5 rounded-md", rCfg.color)}>
                            <rCfg.Icon className="h-2.5 w-2.5" />{t.referencia_label}
                          </span>
                        )}
                        {t.status === "pausado" && (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-black uppercase border-amber-400/30 text-amber-600 dark:text-amber-400 bg-amber-500/10">
                            Pausado
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="font-mono font-black text-sm">{t.duracao_minutos ? formatMinutes(t.duracao_minutos) : "—"}</p>
                      <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                        {new Date(t.data_inicio).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* Dialog Novo Timer */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) resetDialog(); }}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-black">
              <Timer className="h-5 w-5 text-primary" />Iniciar Timer
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Descrição */}
            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground/70">Atividade *</Label>
              <Input
                placeholder="Ex: Elaboração de petição inicial..."
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                className="h-10 rounded-xl"
                onKeyDown={(e) => e.key === "Enter" && handleStart()}
              />
            </div>

            {/* Categoria */}
            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground/70">Categoria *</Label>
              <Select value={categoria} onValueChange={(v) => setCategoria(v as TimesheetCategoria)}>
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent>
                  {TIMESHEET_CATEGORIAS.map((cat) => {
                    const cfg = CATEGORIA_CONFIG[cat];
                    return (
                      <SelectItem key={cat} value={cat}>
                        <div className="flex items-center gap-2">
                          {cfg && <cfg.Icon className="h-3.5 w-3.5 text-muted-foreground" />}
                          {cfg?.label ?? cat}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Vinculação colapsável */}
            <div className="rounded-xl border border-black/8 dark:border-border overflow-hidden">
              <button
                type="button"
                onClick={() => setMostrarVinculo(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-xs font-black uppercase tracking-widest text-muted-foreground/70 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Link2 className="h-3.5 w-3.5" />
                  Vincular a (opcional)
                  {refLabel && <span className="text-primary normal-case font-bold tracking-normal">— {refLabel}</span>}
                </span>
                {mostrarVinculo ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>

              {mostrarVinculo && (
                <div className="px-4 pb-4 pt-2 space-y-3 border-t border-black/5 dark:border-border bg-black/[0.01] dark:bg-white/[0.01]">
                  {/* Tipo de referência */}
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Tipo</Label>
                    <Select value={refTipo} onValueChange={(v) => setRefTipo(v as ReferenciaTipo)}>
                      <SelectTrigger className="h-9 rounded-lg text-xs">
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.entries(REFERENCIA_CONFIG) as [ReferenciaTipo, typeof REFERENCIA_CONFIG[ReferenciaTipo]][]).map(([key, cfg]) => (
                          <SelectItem key={key} value={key}>
                            <div className="flex items-center gap-2">
                              <cfg.Icon className="h-3.5 w-3.5 text-muted-foreground" />{cfg.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Item específico */}
                  {refTipo && (
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                        {REFERENCIA_CONFIG[refTipo].label}
                      </Label>
                      {refLoading ? (
                        <Skeleton className="h-9 rounded-lg" />
                      ) : refItems.length === 0 ? (
                        <p className="text-xs text-muted-foreground/60 py-2 px-3 rounded-lg bg-muted/10 border border-black/5 dark:border-border">
                          Nenhum item encontrado
                        </p>
                      ) : (
                        <Select value={refId} onValueChange={(v) => {
                          setRefId(v);
                          const item = refItems.find(i => i.id === v);
                          setRefLabel(item ? item.label : "");
                        }}>
                          <SelectTrigger className="h-9 rounded-lg text-xs">
                            <SelectValue placeholder={`Selecionar ${REFERENCIA_CONFIG[refTipo].label.toLowerCase()}`} />
                          </SelectTrigger>
                          <SelectContent>
                            {refItems.map((item) => (
                              <SelectItem key={item.id} value={item.id}>
                                <div className="flex flex-col">
                                  <span className="text-xs font-semibold truncate max-w-[200px]">{item.label}</span>
                                  {item.sublabel && <span className="text-[10px] text-muted-foreground">{item.sublabel}</span>}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => { setDialogOpen(false); resetDialog(); }} className="rounded-xl">
              Cancelar
            </Button>
            <Button onClick={handleStart} disabled={!descricao || !categoria || saving}
              className="rounded-xl font-black shadow-premium">
              <Play className="h-4 w-4 mr-2 fill-current" />
              {saving ? "Iniciando..." : "Iniciar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
