import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DeleteConfirmDialog } from "@/components/ui/DeleteConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Clock, Plus, TrendingUp, Users, Search,
  CalendarDays, CalendarClock, UserCircle, ExternalLink, ArrowRight,
  Pencil, Trash2, MoreVertical, DollarSign, Receipt, PlayCircle, PenLine,
  Settings2, BadgeCheck, AlertTriangle,
} from "lucide-react";
import { useTimesheet } from "@/hooks/useTimesheet";
import { useTimesheetConfig, roundMinutes } from "@/hooks/useTimesheetConfig";
import { useOfficeUsers } from "@/hooks/useOfficeUsers";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { TIMESHEET_CATEGORIAS, type TimesheetCategoria } from "@/types/timesheet";
import { cn } from "@/lib/utils";

// Módulos extraídos deste arquivo (desmonte do god-component) — comportamento idêntico
import {
  CATEGORIA_CONFIG, REFERENCIA_CONFIG, PERIODOS,
  formatMinutes, formatBRL, valorDe, formatDateHeader,
  type ReferenciaTipo,
} from "@/components/Timesheet/shared";
import { StatCard, TimesheetSettingsDialog } from "@/components/Timesheet/SettingsDialog";
import { TimerAtivoCard } from "@/components/Timesheet/TimerAtivoCard";
import { NovoTimerDialog } from "@/components/Timesheet/NovoTimerDialog";
import { ManualEntryDialog } from "@/components/Timesheet/ManualEntryDialog";
import { GerarCobrancaDialog, EstornoDialog, FinalizarTimerDialog } from "@/components/Timesheet/CobrancaDialogs";
import { useTimesheetManualEntry } from "@/hooks/useTimesheetManualEntry";
import { useTimesheetFilters } from "@/hooks/useTimesheetFilters";
import { useTimesheetTimer } from "@/hooks/useTimesheetTimer";
import { usePermissions } from "@/hooks/usePermissions";
import { PermissionGuard } from "@/components/Auth/PermissionGuard";
import { useQueryClient } from "@tanstack/react-query";
import { getErrorMessage } from "@/lib/errors";
import { planQuotaMessage } from "@/lib/planQuotaError";

export default function Timesheet() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canManageTimesheet, canManageFinanceiro, canManageOfficeSettings } = usePermissions();
  // "Gerar cobrança" cria receitas no Financeiro; as configurações de valor/hora gravam
  // em offices.settings (só admin). Os botões ficavam abertos a qualquer canViewTimesheet.
  const canGerarCobranca = canManageTimesheet && canManageFinanceiro;
  const canConfigurarFaturamento = canManageTimesheet && canManageOfficeSettings;
  const {
    data: timesheets, loading, error: timesheetsError, fetchData: refetchTimesheets, activeTimer,
    periodDays, setPeriodDays, scope, setScope,
    startTimer, pauseTimer, resumeTimer, stopTimer, addManual, update, remove, marcarFaturado, estornarCobranca,
    getTodayStats, getWeekStats,
  } = useTimesheet();

  const officeId = user?.office_id ?? "";
  const { config, error: configError, save: saveConfig } = useTimesheetConfig(officeId);
  const arred = config.arredondamento;

  const { users: officeUsers } = useOfficeUsers();
  const membroMap = useMemo(() => Object.fromEntries(officeUsers.map(u => [u.user_id, u.profile?.full_name || u.profile?.email || "Membro"])), [officeUsers]);

  // Config / cobrança / faturamento
  const [settingsOpen, setSettingsOpen] = useState(false);
  type Breakdown = "cliente" | "categoria" | "vinculo" | "membro";
  const [breakdown, setBreakdown] = useState<Breakdown>("cliente");
  const [cobrarOpen, setCobrarOpen] = useState(false);
  const [cobrando, setCobrando] = useState(false);
  const [finalizeId, setFinalizeId] = useState<string | null>(null);
  const [finalizeObs, setFinalizeObs] = useState("");
  const [estornoId, setEstornoId] = useState<string | null>(null);

  const rateParaCliente = (cid?: string | null) =>
    (cid && config.valorClientes[cid] != null) ? config.valorClientes[cid] : config.valorPadrao;

  // Lançamento manual / edição — state + handlers extraídos p/ hook.
  const manual = useTimesheetManualEntry({ config, update, addManual });
  const { openManual, openEdit } = manual;

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [clientes, setClientes] = useState<{ id: string; nome: string }[]>([]);

  // Timer ao vivo (form + cronômetro + referências) — extraído p/ hook.
  const timer = useTimesheetTimer({ activeTimer, startTimer, config, user, navigate });
  const { elapsedTime, openTimer, navigateToRef } = timer;

  // Filtros
  const { fSearch, setFSearch, fCategoria, setFCategoria, fCliente, setFCliente, fFaturado, setFFaturado, grouped } = useTimesheetFilters(timesheets);

  // Clientes (carregados ao montar, para filtros e formulários)
  useEffect(() => {
    if (!user?.office_id) return;
    supabase.from("clientes").select("id, nome")
      .eq("office_id", user.office_id).eq("deletado", false)
      .order("nome").limit(500)
      .then(({ data, error }) => {
        // Falha aqui esvaziava os seletores de cliente sem aviso.
        if (error) {
          toast({ title: "Não foi possível carregar os clientes", description: getErrorMessage(error), variant: "destructive" });
          return;
        }
        setClientes(data || []);
      });
  }, [user?.office_id, toast]);

  // Timer: cronômetro, carga de referências e handlers (start/reset/open/navigate) → useTimesheetTimer.

  const todayStats = getTodayStats();
  const weekStats = getWeekStats();

  // Faturamento pendente do período (exclui já faturados; aplica arredondamento)
  const billing = useMemo(() => {
    const pend = timesheets.filter((t) => t.status === "finalizado" && t.faturado !== true && valorDe(t, arred) > 0);
    let totalValor = 0, totalMin = 0;
    const grupos: Record<string, number> = {};
    pend.forEach((t) => {
      const v = valorDe(t, arred);
      totalValor += v; totalMin += roundMinutes(t.duracao_minutos || 0, arred);
      let key: string;
      if (breakdown === "categoria") key = CATEGORIA_CONFIG[t.categoria as TimesheetCategoria]?.label || t.categoria || "—";
      else if (breakdown === "vinculo") key = t.referencia_label || "Sem vínculo";
      else if (breakdown === "membro") key = membroMap[t.user_id] || "Membro";
      else key = t.clientes?.nome || "Sem cliente";
      grupos[key] = (grupos[key] || 0) + v;
    });
    return { totalValor, totalMin, pend, grupos: Object.entries(grupos).sort((a, b) => b[1] - a[1]) };
  }, [timesheets, arred, breakdown, membroMap]);

  const breakdownOpts: { k: Breakdown; l: string }[] = [
    { k: "cliente", l: "Cliente" }, { k: "categoria", l: "Categoria" }, { k: "vinculo", l: "Vínculo" },
    ...(scope === "office" ? [{ k: "membro" as const, l: "Membro" }] : []),
  ];

  // Gera lançamentos de receita no Financeiro a partir das horas faturáveis pendentes
  const gerarCobranca = async () => {
    if (!canGerarCobranca) return;
    setCobrando(true);
    try {
      const porCliente: Record<string, { valor: number; min: number; ids: string[] }> = {};
      billing.pend.forEach((t) => {
        const cid = t.cliente_id || "__sem__";
        const g = (porCliente[cid] ||= { valor: 0, min: 0, ids: [] });
        g.valor += valorDe(t, arred); g.min += roundMinutes(t.duracao_minutos || 0, arred); g.ids.push(t.id);
      });
      const hoje = new Date();
      const hojeYmd = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
      let ok = 0, falhas = 0;
      const causas: string[] = [];
      const receitasOrfas: string[] = [];
      for (const [cid, g] of Object.entries(porCliente)) {
        const valor = Math.round(g.valor * 100) / 100;
        if (valor <= 0) continue;
        const { data: novo, error } = await supabase.from("financeiro").insert({
          tipo: "receita",
          descricao: `Honorários — Timesheet (${formatMinutes(g.min)})`,
          valor,
          data_vencimento: hojeYmd,
          status: "pendente",
          categoria: "Honorários",
          cliente_id: cid === "__sem__" ? null : cid,
          office_id: officeId,
          user_id: user!.id,
        }).select("id").single();
        // Só marca como faturado se a RECEITA foi criada — senão as horas sumiriam do
        // "Faturável" sem nenhum lançamento no Financeiro (perda silenciosa de receita).
        if (error || !novo) {
          falhas++;
          causas.push(planQuotaMessage(error)?.description ?? getErrorMessage(error, "receita não criada"));
          continue;
        }
        const receitaId = (novo as { id: string }).id;
        const marcado = await marcarFaturado(g.ids, true, receitaId);
        if (!marcado) {
          // Compensa: a receita nasceu mas as horas NÃO foram marcadas faturadas → apaga
          // a receita pra não gerar cobrança EM DOBRO na próxima "Gerar cobrança". A
          // compensação também precisa ser conferida: se ela falhar (ou a RLS barrar em
          // silêncio), a receita fica e o usuário precisa saber para excluí-la à mão.
          const { data: comp, error: compErr } = await supabase.from("financeiro").update({ deletado: true }).eq("id", receitaId).select("id");
          if (compErr || !comp?.length) receitasOrfas.push(receitaId);
          falhas++; continue;
        }
        ok++;
      }
      if (ok > 0 || receitasOrfas.length > 0) {
        // Sem isto a tela Financeiro seguia mostrando dados velhos até o refetch natural.
        queryClient.invalidateQueries({ queryKey: ["financeiro"] });
      }
      if (receitasOrfas.length > 0) {
        toast({
          title: "Atenção: receita sem horas vinculadas",
          description: `${receitasOrfas.length} receita(s) foram criadas no Financeiro, mas as horas não puderam ser marcadas como faturadas e a receita não pôde ser removida. Exclua-as no Financeiro antes de gerar a cobrança de novo, para não cobrar em dobro.`,
          variant: "destructive",
        });
      } else if (falhas > 0) {
        const motivo = causas.length ? ` Motivo: ${[...new Set(causas)].join("; ")}.` : "";
        toast({
          title: ok > 0 ? "Cobrança parcial" : "Falha ao gerar cobrança",
          description: `${ok} grupo(s) faturado(s), ${falhas} falharam — as horas que falharam continuam em "Faturável".${motivo}`,
          variant: "destructive",
        });
      } else if (ok > 0) {
        toast({ title: "Cobrança gerada", description: `${ok} lançamento(s) de receita criado(s) no Financeiro.` });
      }
    } finally {
      setCobrando(false); setCobrarOpen(false);
    }
  };

  // Filtros + agrupamento por dia → useTimesheetFilters.



  // Lançamento manual: state + openManual/openEdit/saveManual foram para useTimesheetManualEntry.

  return (
    <PermissionGuard permission="canViewTimesheet" showDeniedMessage>
    <div className="flex-1 p-4 md:p-8 space-y-6 md:space-y-8 overflow-x-hidden entry-animate">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            <Clock className="h-6 w-6 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Timesheet</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Controle o tempo gasto em suas atividades jurídicas.</p>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          {canConfigurarFaturamento && (
            <Button variant="outline" size="icon" onClick={() => setSettingsOpen(true)}
              className="rounded-xl h-11 w-11 shrink-0" title="Configurações de faturamento" aria-label="Configurações de faturamento">
              <Settings2 className="h-4 w-4" />
            </Button>
          )}
          {canManageTimesheet && (
            <>
              <Button variant="outline" size="lg" onClick={openManual}
                className="flex-1 sm:flex-none rounded-xl h-11 px-3 sm:px-5 font-black uppercase text-xs tracking-widest">
                <PenLine className="mr-1.5 sm:mr-2 h-4 w-4" />Manual
              </Button>
              <Button size="lg" onClick={openTimer} disabled={!!activeTimer}
                className="flex-1 sm:flex-none rounded-xl h-11 px-3 sm:px-6 font-black uppercase text-xs tracking-widest shadow-premium">
                <Plus className="mr-1.5 sm:mr-2 h-4 w-4" />Novo Timer
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Erro de busca — antes uma falha de rede/RLS virava estatística/lista vazia sem aviso */}
      {timesheetsError && (
        <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold">Não foi possível carregar os registros de timesheet</p>
            <p className="text-xs opacity-80">{timesheetsError}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetchTimesheets()} className="rounded-xl font-bold shrink-0">
            Tentar novamente
          </Button>
        </div>
      )}

      {/* Stats */}
      {timesheetsError ? null : loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard label="Hoje" value={formatMinutes(todayStats.totalMinutos) || "0m"} sub={`${todayStats.totalRegistros} registro${todayStats.totalRegistros !== 1 ? "s" : ""}`} Icon={CalendarDays} color="bg-primary/10 text-primary" />
          <StatCard label="Esta semana" value={formatMinutes(weekStats.totalMinutos) || "0m"} sub={`${weekStats.totalRegistros} registros`} Icon={CalendarClock} color="bg-violet-500/10 text-violet-500" />
          <StatCard label="Média diária" value={weekStats.totalRegistros > 0 ? formatMinutes(Math.round(weekStats.totalMinutos / 7)) : "0m"} sub="Últimos 7 dias" Icon={TrendingUp} color="bg-emerald-500/10 text-emerald-500" />
          <StatCard label="Faturável" value={formatBRL(billing.totalValor)} sub={`${formatMinutes(billing.totalMin)} no período`} Icon={DollarSign} color="bg-amber-500/10 text-amber-600" />
        </div>
      )}

      {/* Timer ativo */}
      <TimerAtivoCard activeTimer={activeTimer} elapsedTime={elapsedTime} canManageTimesheet={canManageTimesheet}
        onPause={(id) => pauseTimer(id)} onFinalizar={(id) => { setFinalizeId(id); setFinalizeObs(""); }}
        onNovo={openTimer} navigate={navigate} navigateToRef={navigateToRef} />

      {/* Resumo para cobrança */}
      {billing.totalValor > 0 && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-black"><Receipt className="h-4 w-4 text-amber-600" /> Resumo para cobrança</div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-amber-700 dark:text-amber-400">{formatBRL(billing.totalValor)} · {formatMinutes(billing.totalMin)}</span>
              {canGerarCobranca && (
                <Button size="sm" onClick={() => setCobrarOpen(true)} className="rounded-lg h-8 px-3 font-black uppercase text-[10px] tracking-widest bg-amber-500 hover:bg-amber-600 text-white gap-1.5">
                  <DollarSign className="h-3.5 w-3.5" />Gerar cobrança
                </Button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {breakdownOpts.map(opt => (
              <button key={opt.k} onClick={() => setBreakdown(opt.k)}
                className={cn("px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors", breakdown === opt.k ? "bg-amber-500/20 text-amber-700 dark:text-amber-400" : "text-muted-foreground/60 hover:bg-muted/40")}>
                {opt.l}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
            {billing.grupos.slice(0, 8).map(([nome, valor]) => (
              <div key={nome} className="flex items-center justify-between text-xs border-b border-black/5 dark:border-border/50 py-1">
                <span className="text-muted-foreground truncate">{nome}</span>
                <span className="font-bold tabular-nums">{formatBRL(valor)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="space-y-3">
        {/* Linha 1: escopo + período + busca */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center rounded-xl border border-black/8 dark:border-border bg-card/60 p-0.5 w-full sm:w-auto">
            <Button size="sm" variant={scope === "me" ? "secondary" : "ghost"} onClick={() => setScope("me")} className="flex-1 sm:flex-none h-9 rounded-lg px-3 text-xs font-black gap-1.5"><UserCircle className="h-3.5 w-3.5" />Eu</Button>
            <Button size="sm" variant={scope === "office" ? "secondary" : "ghost"} onClick={() => setScope("office")} className="flex-1 sm:flex-none h-9 rounded-lg px-3 text-xs font-black gap-1.5"><Users className="h-3.5 w-3.5" />Equipe</Button>
          </div>
          <Select value={String(periodDays)} onValueChange={(v) => setPeriodDays(Number(v))}>
            <SelectTrigger className="w-full sm:w-32 h-11 rounded-xl bg-card/60 border-black/8 dark:border-border text-sm font-bold"><SelectValue /></SelectTrigger>
            <SelectContent>{PERIODOS.map(p => <SelectItem key={p.v} value={String(p.v)}>{p.l}</SelectItem>)}</SelectContent>
          </Select>
          <div className="relative w-full sm:flex-1 sm:min-w-[180px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
            <Input value={fSearch} onChange={(e) => setFSearch(e.target.value)} placeholder="Buscar atividade ou cliente..." className="pl-10 rounded-xl h-11 bg-card/60 border-black/8 dark:border-border" />
          </div>
        </div>
        {/* Linha 2: categoria + cliente + faturamento */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <Select value={fCategoria} onValueChange={setFCategoria}>
            <SelectTrigger className="h-11 rounded-xl bg-card/60 border-black/8 dark:border-border text-sm font-bold"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas categorias</SelectItem>
              {TIMESHEET_CATEGORIAS.map(c => <SelectItem key={c} value={c}>{CATEGORIA_CONFIG[c].label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fCliente} onValueChange={setFCliente}>
            <SelectTrigger className="h-11 rounded-xl bg-card/60 border-black/8 dark:border-border text-sm font-bold"><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="todos">Todos clientes</SelectItem>
              {clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fFaturado} onValueChange={setFFaturado}>
            <SelectTrigger className="col-span-2 lg:col-span-1 h-11 rounded-xl bg-card/60 border-black/8 dark:border-border text-sm font-bold"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Faturados e não</SelectItem>
              <SelectItem value="pendente">Não faturados</SelectItem>
              <SelectItem value="faturado">Faturados</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Registros */}
      <div className="space-y-6">
        <h2 className="text-lg font-black tracking-tight">Registros recentes</h2>
        {timesheetsError ? null : loading ? (
          <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
        ) : grouped.length === 0 ? (
          <div className="rounded-2xl border border-black/5 dark:border-border bg-card/40 p-10 text-center">
            <Clock className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm font-bold text-muted-foreground">Nenhum registro encontrado</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Inicie o timer, lance manualmente ou ajuste os filtros</p>
          </div>
        ) : (
          grouped.map(([dayKey, entries]) => (
            <div key={dayKey} className="space-y-2">
              <div className="flex items-center gap-3">
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground/60 capitalize">{formatDateHeader(entries[0].data_inicio)}</p>
                <div className="flex-1 h-px bg-border" />
                <p className="text-xs font-black tabular-nums text-muted-foreground/50">{formatMinutes(entries.reduce((s, e) => s + (e.duracao_minutos || 0), 0))}</p>
              </div>

              {entries.map((t) => {
                const cfg = CATEGORIA_CONFIG[t.categoria as TimesheetCategoria];
                const rCfg = t.referencia_tipo ? REFERENCIA_CONFIG[t.referencia_tipo as ReferenciaTipo] : null;
                const clienteNome = t.clientes?.nome;
                const v = valorDe(t, arred);
                const mine = t.user_id === user?.id;

                return (
                  <div key={t.id}
                    className={cn("flex items-center gap-2.5 sm:gap-4 p-3 sm:p-4 rounded-xl bg-card/60 border border-black/5 dark:border-border hover:border-primary/20 hover:shadow-sm transition-all border-l-4", cfg?.border ?? "border-l-muted")}>
                    {cfg ? (
                      <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", cfg.color)}><cfg.Icon className="h-4 w-4" /></div>
                    ) : (
                      <div className="h-9 w-9 rounded-lg bg-muted/30 flex items-center justify-center shrink-0"><Clock className="h-4 w-4 text-muted-foreground" /></div>
                    )}

                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">{t.tarefa_descricao}</p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {cfg && <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">{cfg.label}</span>}

                        {scope === "office" && (
                          <>
                            <span className="text-muted-foreground/30 text-[10px]">·</span>
                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-primary/10 text-primary">{membroMap[t.user_id] || "Membro"}</span>
                          </>
                        )}

                        {clienteNome && (
                          <>
                            <span className="text-muted-foreground/30 text-[10px]">·</span>
                            <button onClick={() => navigate(`/clientes?openId=${t.cliente_id}`)}
                              className="flex items-center gap-1 text-[10px] font-black px-1.5 py-0.5 rounded-md bg-slate-500/10 text-slate-600 dark:text-slate-400 hover:bg-slate-500/20 transition-colors">
                              <UserCircle className="h-2.5 w-2.5" />{clienteNome}
                            </button>
                          </>
                        )}

                        {rCfg && t.referencia_label && (
                          <>
                            <ArrowRight className="h-2.5 w-2.5 text-muted-foreground/30" />
                            <button onClick={() => navigateToRef(t.referencia_tipo!, t.referencia_id)}
                              className={cn("flex items-center gap-1 text-[10px] font-black px-1.5 py-0.5 rounded-md hover:opacity-80 transition-opacity", rCfg.color)}>
                              <rCfg.Icon className="h-2.5 w-2.5" />{t.referencia_label}
                              <ExternalLink className="h-2 w-2 opacity-60" />
                            </button>
                          </>
                        )}

                        {t.status === "pausado" && (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-black uppercase border-amber-400/30 text-amber-600 dark:text-amber-400 bg-amber-500/10">Pausado</Badge>
                        )}
                        {t.faturavel === false && (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-black uppercase border-muted-foreground/20 text-muted-foreground/60">Não fat.</Badge>
                        )}
                        {t.faturado && (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-black uppercase border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 gap-1"><BadgeCheck className="h-2.5 w-2.5" />Faturado</Badge>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="font-mono font-black text-sm tabular-nums">{t.duracao_minutos ? formatMinutes(t.duracao_minutos) : "—"}</p>
                      {v > 0
                        ? <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 mt-0.5">{formatBRL(v)}</p>
                        : <p className="text-[10px] text-muted-foreground/50 mt-0.5">{new Date(t.data_inicio).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>}
                    </div>

                    {mine && canManageTimesheet && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg shrink-0" aria-label="Mais opções do registro"><MoreVertical className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl w-40">
                          {t.status === "pausado" && (
                            <DropdownMenuItem className="rounded-lg gap-2" disabled={!!activeTimer} onClick={() => resumeTimer(t.id)}>
                              <PlayCircle className="h-4 w-4" /> Retomar
                            </DropdownMenuItem>
                          )}
                          {t.status === "finalizado" && !t.faturado && (
                            <DropdownMenuItem className="rounded-lg gap-2" onClick={() => marcarFaturado([t.id], true)}>
                              <BadgeCheck className="h-4 w-4" /> Marcar faturado
                            </DropdownMenuItem>
                          )}
                          {t.faturado && t.financeiro_id && (
                            <DropdownMenuItem className="rounded-lg gap-2" onClick={() => setEstornoId(t.financeiro_id)}>
                              <Receipt className="h-4 w-4" /> Estornar cobrança
                            </DropdownMenuItem>
                          )}
                          {t.faturado && !t.financeiro_id && (
                            <DropdownMenuItem className="rounded-lg gap-2" onClick={() => marcarFaturado([t.id], false)}>
                              <BadgeCheck className="h-4 w-4" /> Reabrir faturamento
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem className="rounded-lg gap-2" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /> Editar</DropdownMenuItem>
                          <DropdownMenuItem className="rounded-lg gap-2 text-destructive focus:text-destructive" onClick={() => setDeleteTarget(t.id)}><Trash2 className="h-4 w-4" /> Excluir</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* Dialog Novo Timer */}
      <NovoTimerDialog timer={timer} clientes={clientes} rateParaCliente={rateParaCliente} />

      {/* Dialog Lançar / Editar manual */}
      <ManualEntryDialog manual={manual} clientes={clientes} rateParaCliente={rateParaCliente} />

      {/* Configurações de faturamento */}
      <TimesheetSettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} config={config} clientes={clientes} error={configError} onSave={saveConfig} />

      {/* Confirmar geração de cobrança / estorno / finalizar com observação */}
      <GerarCobrancaDialog cobrarOpen={cobrarOpen} setCobrarOpen={setCobrarOpen} cobrando={cobrando}
        totalValor={billing.totalValor} pendentes={billing.pend.length} gerarCobranca={gerarCobranca} />
      <EstornoDialog estornoId={estornoId} setEstornoId={setEstornoId} estornarCobranca={estornarCobranca} />
      <FinalizarTimerDialog finalizeId={finalizeId} setFinalizeId={setFinalizeId} finalizeObs={finalizeObs}
        setFinalizeObs={setFinalizeObs} elapsedTime={elapsedTime} stopTimer={stopTimer} />

      {/* Confirmar exclusão */}
      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
        onConfirm={async () => { if (deleteTarget) { setRemoving(true); await remove(deleteTarget); setRemoving(false); setDeleteTarget(null); } }}
        isLoading={removing}
        title="Excluir registro"
        description="Esta ação não pode ser desfeita. O registro de tempo será removido."
      />
    </div>
    </PermissionGuard>
  );
}
