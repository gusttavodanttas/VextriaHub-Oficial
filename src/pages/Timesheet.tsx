import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DeleteConfirmDialog } from "@/components/ui/DeleteConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Clock, Play, Pause, Square, Timer, Plus, TrendingUp,
  FileText, Users, Phone, Gavel, Scale, Search, BookOpen,
  CalendarDays, CalendarClock, AlertCircle, CheckSquare,
  UserCircle, MessageSquareText, ExternalLink, ArrowRight,
  Pencil, Trash2, MoreVertical, DollarSign, Receipt, PlayCircle, PenLine,
  Settings2, BadgeCheck, Layers, AlertTriangle, Loader2,
} from "lucide-react";
import { useTimesheet } from "@/hooks/useTimesheet";
import { useTimesheetConfig, roundMinutes, type Arredondamento, type TimesheetConfig } from "@/hooks/useTimesheetConfig";
import { useOfficeUsers } from "@/hooks/useOfficeUsers";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { TIMESHEET_CATEGORIAS, type TimesheetCategoria } from "@/types/timesheet";
import { cn } from "@/lib/utils";

// ─── Configs ──────────────────────────────────────────────────────────────────

const CATEGORIA_CONFIG: Record<TimesheetCategoria, { label: string; Icon: React.FC<any>; color: string; border: string }> = {
  atendimento:    { label: "Atendimento",    Icon: Phone,      color: "bg-blue-500/10 text-blue-600 dark:text-blue-400",       border: "border-l-blue-500" },
  processo:       { label: "Processo",       Icon: Scale,      color: "bg-violet-500/10 text-violet-600 dark:text-violet-400", border: "border-l-violet-500" },
  reuniao:        { label: "Reunião",        Icon: Users,      color: "bg-teal-500/10 text-teal-600 dark:text-teal-400",       border: "border-l-teal-500" },
  administrativa: { label: "Administrativa", Icon: FileText,   color: "bg-orange-500/10 text-orange-600 dark:text-orange-400", border: "border-l-orange-500" },
  audiencia:      { label: "Audiência",      Icon: Gavel,      color: "bg-red-500/10 text-red-600 dark:text-red-400",          border: "border-l-red-500" },
  peticao:        { label: "Petição",        Icon: FileText,   color: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400", border: "border-l-indigo-500" },
  consulta:       { label: "Consulta",       Icon: BookOpen,   color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", border: "border-l-emerald-500" },
  pesquisa:       { label: "Pesquisa",       Icon: Search,     color: "bg-amber-500/10 text-amber-600 dark:text-amber-400",    border: "border-l-amber-500" },
};

type ReferenciaTipo = "atendimento" | "audiencia" | "prazo" | "tarefa" | "consultivo";

const REFERENCIA_CONFIG: Record<ReferenciaTipo, {
  label: string; Icon: React.FC<any>; color: string;
  table: string; labelField: string; dateField?: string;
  clienteField?: string; route: string;
}> = {
  atendimento: { label: "Atendimento", Icon: Phone,             color: "bg-blue-500/10 text-blue-600 dark:text-blue-400",          table: "atendimentos", labelField: "observacoes", dateField: "data_atendimento", clienteField: "cliente_id", route: "/atendimentos" },
  audiencia:   { label: "Audiência",   Icon: Gavel,             color: "bg-red-500/10 text-red-600 dark:text-red-400",             table: "audiencias",   labelField: "titulo",      dateField: "data_audiencia",   clienteField: "cliente_id", route: "/audiencias" },
  prazo:       { label: "Prazo",       Icon: AlertCircle,       color: "bg-orange-500/10 text-orange-600 dark:text-orange-400",    table: "prazos",       labelField: "titulo",      dateField: "data_vencimento",  route: "/prazos" },
  tarefa:      { label: "Tarefa",      Icon: CheckSquare,       color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", table: "tarefas",      labelField: "titulo",      dateField: "data_vencimento",  clienteField: "cliente_id", route: "/tarefas" },
  consultivo:  { label: "Consultivo",  Icon: MessageSquareText, color: "bg-teal-500/10 text-teal-600 dark:text-teal-400",          table: "processos",    labelField: "titulo",      dateField: "created_at",       clienteField: "cliente_id", route: "/consultivo" },
};

interface ReferenciaItem { id: string; label: string; sublabel?: string }

const CATEGORIA_TO_REF: Partial<Record<TimesheetCategoria, ReferenciaTipo>> = {
  atendimento: "atendimento", audiencia: "audiencia", processo: "consultivo", peticao: "consultivo", consulta: "atendimento",
};
const REF_LIVRES: ReferenciaTipo[] = ["prazo", "tarefa"];

const PERIODOS = [
  { v: 7, l: "7 dias" }, { v: 30, l: "30 dias" }, { v: 90, l: "90 dias" }, { v: 365, l: "1 ano" },
];

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
const formatBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const valorDe = (t: any, arred: Arredondamento = "nenhum") =>
  t.faturavel !== false && t.valor_hora && t.duracao_minutos
    ? (roundMinutes(t.duracao_minutos, arred) / 60) * t.valor_hora
    : 0;

function formatDateHeader(dateStr: string) {
  const d = new Date(dateStr), today = new Date(), yst = new Date(today);
  yst.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Hoje";
  if (d.toDateString() === yst.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
}

function StatCard({ label, value, sub, Icon, color }: { label: string; value: string; sub?: string; Icon: React.FC<any>; color: string }) {
  return (
    <div className="glass-card rounded-2xl border border-black/5 dark:border-border bg-card/40 shadow-premium p-3.5 sm:p-5 flex items-center gap-3 sm:gap-4">
      <div className={cn("h-9 w-9 sm:h-10 sm:w-10 rounded-xl flex items-center justify-center shrink-0", color)}>
        <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 truncate">{label}</p>
        <p className="text-lg sm:text-2xl font-black tracking-tight truncate">{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground/50 mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  );
}

const NONE = "__none__";

// ─── Settings Dialog (faturamento) ──────────────────────────────────────────────

const TimesheetSettingsDialog: React.FC<{
  open: boolean; onClose: () => void;
  config: TimesheetConfig; clientes: { id: string; nome: string }[];
  onSave: (cfg: Partial<TimesheetConfig>) => Promise<void>;
}> = ({ open, onClose, config, clientes, onSave }) => {
  const [padrao, setPadrao] = useState("");
  const [arred, setArred] = useState<Arredondamento>("nenhum");
  const [mapa, setMapa] = useState<Record<string, number>>({});
  const [novoCli, setNovoCli] = useState("");
  const [novoRate, setNovoRate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPadrao(config.valorPadrao != null ? String(config.valorPadrao) : "");
    setArred(config.arredondamento);
    setMapa({ ...config.valorClientes });
    setNovoCli(""); setNovoRate("");
  }, [open, config]);

  const nomeCli = (id: string) => clientes.find(c => c.id === id)?.nome || id;
  const addRate = () => { if (!novoCli || !novoRate) return; setMapa(m => ({ ...m, [novoCli]: Number(novoRate) })); setNovoCli(""); setNovoRate(""); };
  const salvar = async () => { setSaving(true); await onSave({ valorPadrao: padrao ? Number(padrao) : null, arredondamento: arred, valorClientes: mapa }); setSaving(false); onClose(); };

  const disponiveis = clientes.filter(c => mapa[c.id] == null);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-md rounded-2xl p-0 overflow-hidden max-h-[90vh] flex flex-col">
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-5 pt-5 pb-4 border-b border-black/5 dark:border-border shrink-0">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-black text-base">
              <div className="h-7 w-7 rounded-lg bg-primary/15 flex items-center justify-center"><Settings2 className="h-3.5 w-3.5 text-primary" /></div>
              Configurações de faturamento
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Valor/hora padrão</Label>
              <Input type="number" min={0} step="0.01" value={padrao} onChange={e => setPadrao(e.target.value)} placeholder="Ex: 350" className="h-10 rounded-xl text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Arredondamento</Label>
              <Select value={arred} onValueChange={(v) => setArred(v as Arredondamento)}>
                <SelectTrigger className="h-10 rounded-xl text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhum">Sem arredondar</SelectItem>
                  <SelectItem value="6">6 min (0,1h)</SelectItem>
                  <SelectItem value="15">15 min</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Valor/hora por cliente</Label>
            {Object.keys(mapa).length === 0 && <p className="text-xs text-muted-foreground/40 italic">Nenhum valor específico. Usa o padrão.</p>}
            <div className="space-y-1.5">
              {Object.entries(mapa).map(([cid, rate]) => (
                <div key={cid} className="flex items-center gap-2 rounded-lg border border-black/5 dark:border-border px-3 py-1.5">
                  <span className="flex-1 text-sm font-semibold truncate">{nomeCli(cid)}</span>
                  <span className="text-sm font-bold tabular-nums">{rate.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/h</span>
                  <button onClick={() => setMapa(m => { const n = { ...m }; delete n[cid]; return n; })} className="text-muted-foreground/40 hover:text-rose-500"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Select value={novoCli} onValueChange={setNovoCli}>
                <SelectTrigger className="h-9 rounded-lg text-sm flex-1"><SelectValue placeholder="Cliente" /></SelectTrigger>
                <SelectContent className="max-h-60">{disponiveis.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
              </Select>
              <Input type="number" min={0} step="0.01" value={novoRate} onChange={e => setNovoRate(e.target.value)} placeholder="R$/h" className="h-9 rounded-lg text-sm w-24" />
              <Button size="sm" onClick={addRate} disabled={!novoCli || !novoRate} className="h-9 rounded-lg px-3"><Plus className="h-4 w-4" /></Button>
            </div>
          </div>
        </div>

        <div className="px-5 pb-5 flex gap-2 justify-end border-t border-black/5 dark:border-border pt-3 shrink-0">
          <Button variant="ghost" onClick={onClose} className="rounded-xl">Cancelar</Button>
          <Button onClick={salvar} disabled={saving} className="rounded-xl font-black px-6">{saving ? "Salvando..." : "Salvar"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Timesheet() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    data: timesheets, loading, activeTimer,
    periodDays, setPeriodDays, scope, setScope,
    startTimer, pauseTimer, resumeTimer, stopTimer, addManual, update, remove, marcarFaturado, estornarCobranca,
    getTodayStats, getWeekStats,
  } = useTimesheet();

  const officeId = user?.office_id ?? "";
  const { config, save: saveConfig } = useTimesheetConfig(officeId);
  const arred = config.arredondamento;

  const { users: officeUsers } = useOfficeUsers();
  const membroMap = useMemo(() => Object.fromEntries(officeUsers.map(u => [u.user_id, u.profile?.full_name || u.profile?.email || "Membro"])), [officeUsers]);

  // Config / cobrança / faturamento
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [breakdown, setBreakdown] = useState<"cliente" | "categoria" | "vinculo" | "membro">("cliente");
  const [cobrarOpen, setCobrarOpen] = useState(false);
  const [cobrando, setCobrando] = useState(false);
  const [finalizeId, setFinalizeId] = useState<string | null>(null);
  const [finalizeObs, setFinalizeObs] = useState("");
  const [estornoId, setEstornoId] = useState<string | null>(null);

  const rateParaCliente = (cid?: string | null) =>
    (cid && config.valorClientes[cid] != null) ? config.valorClientes[cid] : config.valorPadrao;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("new")) {
      setDialogOpen(true);
      window.history.replaceState({}, "", "/timesheet");
    }
  }, []);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [saving, setSaving] = useState(false);

  // Form: timer ao vivo
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState<TimesheetCategoria | "">("");
  const [clienteId, setClienteId] = useState("");
  const [faturavel, setFaturavel] = useState(true);
  const [valorHora, setValorHora] = useState("");
  const [clientes, setClientes] = useState<{ id: string; nome: string }[]>([]);

  // Vinculação
  const [refTipo, setRefTipo] = useState<ReferenciaTipo | "">("");
  const [refItems, setRefItems] = useState<ReferenciaItem[]>([]);
  const [refLoading, setRefLoading] = useState(false);
  const [refId, setRefId] = useState("");
  const [refLabel, setRefLabel] = useState("");

  // Filtros
  const [fSearch, setFSearch] = useState("");
  const [fCategoria, setFCategoria] = useState("todas");
  const [fCliente, setFCliente] = useState("todos");
  const [fFaturado, setFFaturado] = useState("todos");

  // Cronômetro
  useEffect(() => {
    if (!activeTimer || activeTimer.status !== "ativo") { setElapsedTime(0); return; }
    const tick = () => setElapsedTime(Math.floor((Date.now() - new Date(activeTimer.data_inicio).getTime()) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [activeTimer]);

  // Clientes (carregados ao montar, para filtros e formulários)
  useEffect(() => {
    if (!user?.office_id) return;
    supabase.from("clientes").select("id, nome")
      .eq("office_id", user.office_id).eq("deletado", false)
      .order("nome").limit(500)
      .then(({ data }) => setClientes(data || []));
  }, [user?.office_id]);

  // Itens de referência (timer ao vivo)
  useEffect(() => {
    if (!refTipo || !user) return;
    const cfg = REFERENCIA_CONFIG[refTipo];
    setRefItems([]); setRefId(""); setRefLabel(""); setRefLoading(true);
    const fetchItems = async () => {
      try {
        if (refTipo === "prazo" && clienteId) {
          const { data: processos } = await supabase.from("processos").select("id").eq("cliente_id", clienteId).eq("deletado", false);
          const ids = (processos || []).map((p: any) => p.id);
          if (ids.length === 0) { setRefItems([]); return; }
          const { data } = await supabase.from("prazos").select("id, titulo, data_vencimento")
            .in("processo_id", ids).eq("deletado", false).order("data_vencimento", { ascending: true }).limit(50);
          setRefItems((data || []).map((r: any) => ({ id: r.id, label: r.titulo || "Sem título", sublabel: r.data_vencimento ? `Vence ${new Date(r.data_vencimento).toLocaleDateString("pt-BR")}` : undefined })));
          return;
        }
        let q = (supabase as any).from(cfg.table)
          .select(`id, ${cfg.labelField}${cfg.dateField ? `, ${cfg.dateField}` : ""}`)
          .eq("user_id", user.id).eq("deletado", false)
          .order(cfg.dateField || "created_at", { ascending: false }).limit(50);
        if (clienteId && cfg.clienteField) q = q.eq(cfg.clienteField, clienteId);
        const { data } = await q;
        setRefItems((data || []).map((r: any) => ({ id: r.id, label: r[cfg.labelField] || "Sem título", sublabel: cfg.dateField ? new Date(r[cfg.dateField]).toLocaleDateString("pt-BR") : undefined })));
      } finally { setRefLoading(false); }
    };
    fetchItems();
  }, [refTipo, clienteId, user]);

  const handleSetCategoria = (cat: TimesheetCategoria) => {
    setCategoria(cat); setRefId(""); setRefLabel(""); setRefItems([]);
    setRefTipo(CATEGORIA_TO_REF[cat] ?? "");
  };

  const resetDialog = () => {
    setDescricao(""); setCategoria(""); setClienteId(""); setFaturavel(true); setValorHora("");
    setRefTipo(""); setRefItems([]); setRefId(""); setRefLabel("");
  };

  const openTimer = () => {
    setValorHora(config.valorPadrao != null ? String(config.valorPadrao) : "");
    setDialogOpen(true);
  };

  const handleStart = async () => {
    if (!descricao || !categoria) return;
    setSaving(true);
    await startTimer(descricao, categoria as TimesheetCategoria, clienteId || undefined, undefined,
      refTipo || undefined, refId || undefined, refLabel || undefined,
      { faturavel, valor_hora: valorHora ? Number(valorHora) : null });
    resetDialog(); setDialogOpen(false); setSaving(false);
  };

  const navigateToRef = (tipo: string, refId?: string | null) => {
    const cfg = REFERENCIA_CONFIG[tipo as ReferenciaTipo];
    if (!cfg) return;
    navigate(refId ? `${cfg.route}?openId=${refId}` : cfg.route);
  };

  const todayStats = getTodayStats();
  const weekStats = getWeekStats();

  // Faturamento pendente do período (exclui já faturados; aplica arredondamento)
  const billing = useMemo(() => {
    const pend = timesheets.filter((t: any) => t.status === "finalizado" && t.faturado !== true && valorDe(t, arred) > 0);
    let totalValor = 0, totalMin = 0;
    const grupos: Record<string, number> = {};
    pend.forEach((t: any) => {
      const v = valorDe(t, arred);
      totalValor += v; totalMin += roundMinutes(t.duracao_minutos || 0, arred);
      let key: string;
      if (breakdown === "categoria") key = CATEGORIA_CONFIG[t.categoria as TimesheetCategoria]?.label || t.categoria || "—";
      else if (breakdown === "vinculo") key = t.referencia_label || "Sem vínculo";
      else if (breakdown === "membro") key = membroMap[t.user_id] || "Membro";
      else key = (t as any).clientes?.nome || "Sem cliente";
      grupos[key] = (grupos[key] || 0) + v;
    });
    return { totalValor, totalMin, pend, grupos: Object.entries(grupos).sort((a, b) => b[1] - a[1]) };
  }, [timesheets, arred, breakdown, membroMap]);

  // Gera lançamentos de receita no Financeiro a partir das horas faturáveis pendentes
  const gerarCobranca = async () => {
    setCobrando(true);
    try {
      const porCliente: Record<string, { valor: number; min: number; ids: string[] }> = {};
      billing.pend.forEach((t: any) => {
        const cid = t.cliente_id || "__sem__";
        const g = (porCliente[cid] ||= { valor: 0, min: 0, ids: [] });
        g.valor += valorDe(t, arred); g.min += roundMinutes(t.duracao_minutos || 0, arred); g.ids.push(t.id);
      });
      for (const [cid, g] of Object.entries(porCliente)) {
        const valor = Math.round(g.valor * 100) / 100;
        if (valor <= 0) continue;
        const { data: novo } = await supabase.from("financeiro").insert({
          tipo: "receita",
          descricao: `Honorários — Timesheet (${formatMinutes(g.min)})`,
          valor,
          data_vencimento: new Date().toISOString().slice(0, 10),
          status: "pendente",
          categoria: "Honorários",
          cliente_id: cid === "__sem__" ? null : cid,
          office_id: officeId,
          user_id: user!.id,
        } as any).select("id").single();
        await marcarFaturado(g.ids, true, (novo as any)?.id ?? null);
      }
    } finally {
      setCobrando(false); setCobrarOpen(false);
    }
  };

  // Registros filtrados + agrupados por dia
  const grouped = useMemo(() => {
    const q = fSearch.toLowerCase();
    const recs = timesheets.filter(t => {
      if (t.status === "ativo") return false;
      const matchSearch = !q || t.tarefa_descricao?.toLowerCase().includes(q) || ((t as any).clientes?.nome || "").toLowerCase().includes(q);
      const matchCat = fCategoria === "todas" || t.categoria === fCategoria;
      const matchCli = fCliente === "todos" || t.cliente_id === fCliente;
      const matchFat = fFaturado === "todos"
        || (fFaturado === "faturado" ? (t as any).faturado === true : (t as any).faturado !== true);
      return matchSearch && matchCat && matchCli && matchFat;
    });
    const acc: Record<string, any[]> = {};
    recs.forEach(t => { const day = new Date(t.data_inicio).toDateString(); (acc[day] ||= []).push(t); });
    return Object.entries(acc).sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime());
  }, [timesheets, fSearch, fCategoria, fCliente, fFaturado]);

  const catCfg = activeTimer ? CATEGORIA_CONFIG[activeTimer.categoria as TimesheetCategoria] : null;
  const activeRefCfg = activeTimer?.referencia_tipo ? REFERENCIA_CONFIG[activeTimer.referencia_tipo as ReferenciaTipo] : null;

  // ── Lançamento manual / edição ──
  const [mDesc, setMDesc] = useState("");
  const [mCat, setMCat] = useState<TimesheetCategoria | "">("");
  const [mCli, setMCli] = useState("");
  const [mData, setMData] = useState("");
  const [mInicio, setMInicio] = useState("");
  const [mFim, setMFim] = useState("");
  const [mFat, setMFat] = useState(true);
  const [mValor, setMValor] = useState("");
  const [mObs, setMObs] = useState("");
  const [mSaving, setMSaving] = useState(false);

  const openManual = () => {
    setEditTarget(null);
    const now = new Date();
    setMDesc(""); setMCat(""); setMCli(""); setMFat(true); setMObs("");
    setMValor(config.valorPadrao != null ? String(config.valorPadrao) : "");
    setMData(now.toISOString().slice(0, 10));
    setMInicio("09:00"); setMFim("10:00");
    setManualOpen(true);
  };

  const openEdit = (t: any) => {
    setEditTarget(t);
    const ini = new Date(t.data_inicio);
    const fim = t.data_fim ? new Date(t.data_fim) : new Date(ini.getTime() + (t.duracao_minutos || 0) * 60000);
    setMDesc(t.tarefa_descricao || "");
    setMCat((t.categoria as TimesheetCategoria) || "");
    setMCli(t.cliente_id || "");
    setMData(ini.toISOString().slice(0, 10));
    setMInicio(ini.toTimeString().slice(0, 5));
    setMFim(fim.toTimeString().slice(0, 5));
    setMFat(t.faturavel !== false);
    setMValor(t.valor_hora != null ? String(t.valor_hora) : "");
    setMObs(t.observacoes || "");
    setManualOpen(true);
  };

  const saveManual = async () => {
    if (!mDesc.trim() || !mCat || !mData || !mInicio || !mFim) return;
    const inicioISO = `${mData}T${mInicio}:00`;
    const fimISO = `${mData}T${mFim}:00`;
    const dur = Math.round((new Date(fimISO).getTime() - new Date(inicioISO).getTime()) / 60000);
    if (dur <= 0) return;
    setMSaving(true);
    const billingFields: any = {};
    if (mValor) billingFields.valor_hora = Number(mValor);
    if (!mFat) billingFields.faturavel = false;
    if (editTarget) {
      await update(editTarget.id, {
        tarefa_descricao: mDesc.trim(), categoria: mCat, cliente_id: mCli || null,
        data_inicio: inicioISO, data_fim: fimISO, duracao_minutos: dur,
        observacoes: mObs.trim() || null, ...billingFields,
      });
    } else {
      await addManual({
        tarefa_descricao: mDesc.trim(), categoria: mCat as TimesheetCategoria, cliente_id: mCli || null,
        data_inicio: inicioISO, data_fim: fimISO, duracao_minutos: dur,
        observacoes: mObs.trim() || null, faturavel: mFat, valor_hora: mValor ? Number(mValor) : null,
      });
    }
    setMSaving(false); setManualOpen(false);
  };

  return (
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
          <Button variant="outline" size="icon" onClick={() => setSettingsOpen(true)}
            className="rounded-xl h-11 w-11 shrink-0" title="Configurações de faturamento">
            <Settings2 className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="lg" onClick={openManual}
            className="flex-1 sm:flex-none rounded-xl h-11 px-3 sm:px-5 font-black uppercase text-xs tracking-widest">
            <PenLine className="mr-1.5 sm:mr-2 h-4 w-4" />Manual
          </Button>
          <Button size="lg" onClick={openTimer} disabled={!!activeTimer}
            className="flex-1 sm:flex-none rounded-xl h-11 px-3 sm:px-6 font-black uppercase text-xs tracking-widest shadow-premium">
            <Plus className="mr-1.5 sm:mr-2 h-4 w-4" />Novo Timer
          </Button>
        </div>
      </div>

      {/* Stats */}
      {loading ? (
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
      <div className={cn(
        "rounded-2xl border shadow-premium overflow-hidden transition-all duration-300",
        activeTimer ? "border-primary/30 bg-gradient-to-br from-primary/[0.04] via-transparent to-transparent" : "border-black/5 dark:border-border bg-card/40"
      )}>
        {activeTimer ? (
          <div className="p-5 sm:p-8 flex flex-col items-center gap-4 sm:gap-5">
            <div className="flex items-center gap-2 flex-wrap justify-center">
              {catCfg && (
                <div className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest", catCfg.color)}>
                  <catCfg.Icon className="h-3.5 w-3.5" />{catCfg.label}
                </div>
              )}
              {(activeTimer as any).clientes?.nome && (
                <button onClick={() => navigate(`/clientes?openId=${activeTimer.cliente_id}`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest bg-slate-500/10 text-slate-600 dark:text-slate-400 hover:bg-slate-500/20 transition-colors">
                  <UserCircle className="h-3.5 w-3.5" />{(activeTimer as any).clientes.nome}
                  <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                </button>
              )}
              {activeRefCfg && activeTimer.referencia_label && (
                <button onClick={() => navigateToRef(activeTimer.referencia_tipo!, activeTimer.referencia_id)}
                  className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest hover:opacity-80 transition-opacity", activeRefCfg.color)}>
                  <activeRefCfg.Icon className="h-3.5 w-3.5" />{activeTimer.referencia_label}
                  <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                </button>
              )}
            </div>

            <p className="text-sm sm:text-base font-bold text-center text-foreground/70 max-w-md px-2">{activeTimer.tarefa_descricao}</p>

            <div className="relative py-2">
              <div className="absolute inset-0 bg-primary/15 blur-3xl rounded-full" />
              <span className="relative text-5xl sm:text-7xl md:text-9xl font-black tracking-tighter tabular-nums text-foreground">
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

            {activeTimer.status === "ativo" && elapsedTime > 28800 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs font-bold">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Este timer já passa de 8h — confira se esqueceu de finalizar.
              </div>
            )}

            <div className="flex items-center gap-3 w-full sm:w-auto max-w-xs sm:max-w-none">
              <Button variant="outline" onClick={() => pauseTimer(activeTimer.id)}
                className="flex-1 sm:flex-none h-11 px-4 sm:px-6 rounded-xl font-black text-xs uppercase tracking-wider border-black/10 dark:border-border">
                <Pause className="h-4 w-4 mr-2" />Pausar
              </Button>
              <Button variant="destructive" onClick={() => { setFinalizeId(activeTimer.id); setFinalizeObs(""); }}
                className="flex-1 sm:flex-none h-11 px-4 sm:px-8 rounded-xl font-black text-xs uppercase tracking-wider shadow-premium">
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
            <Button onClick={openTimer} size="lg"
              className="mt-2 h-11 px-8 rounded-xl font-black text-xs uppercase tracking-widest shadow-premium">
              <Play className="h-4 w-4 mr-2 fill-current" />Iniciar Atividade
            </Button>
          </div>
        )}
      </div>

      {/* Resumo para cobrança */}
      {billing.totalValor > 0 && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-black"><Receipt className="h-4 w-4 text-amber-600" /> Resumo para cobrança</div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-amber-700 dark:text-amber-400">{formatBRL(billing.totalValor)} · {formatMinutes(billing.totalMin)}</span>
              <Button size="sm" onClick={() => setCobrarOpen(true)} className="rounded-lg h-8 px-3 font-black uppercase text-[10px] tracking-widest bg-amber-500 hover:bg-amber-600 text-white gap-1.5">
                <DollarSign className="h-3.5 w-3.5" />Gerar cobrança
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {([{ k: "cliente", l: "Cliente" }, { k: "categoria", l: "Categoria" }, { k: "vinculo", l: "Vínculo" }, ...(scope === "office" ? [{ k: "membro", l: "Membro" }] : [])] as const).map(opt => (
              <button key={opt.k} onClick={() => setBreakdown(opt.k as any)}
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
        {loading ? (
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
                const clienteNome = (t as any).clientes?.nome;
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
                        {(t as any).faturado && (
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

                    {mine && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg shrink-0"><MoreVertical className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl w-40">
                          {t.status === "pausado" && (
                            <DropdownMenuItem className="rounded-lg gap-2" disabled={!!activeTimer} onClick={() => resumeTimer(t.id)}>
                              <PlayCircle className="h-4 w-4" /> Retomar
                            </DropdownMenuItem>
                          )}
                          {t.status === "finalizado" && !(t as any).faturado && (
                            <DropdownMenuItem className="rounded-lg gap-2" onClick={() => marcarFaturado([t.id], true)}>
                              <BadgeCheck className="h-4 w-4" /> Marcar faturado
                            </DropdownMenuItem>
                          )}
                          {(t as any).faturado && (t as any).financeiro_id && (
                            <DropdownMenuItem className="rounded-lg gap-2" onClick={() => setEstornoId((t as any).financeiro_id)}>
                              <Receipt className="h-4 w-4" /> Estornar cobrança
                            </DropdownMenuItem>
                          )}
                          {(t as any).faturado && !(t as any).financeiro_id && (
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

      {/* ── Dialog Novo Timer ───────────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) resetDialog(); }}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-md rounded-2xl p-0 overflow-hidden max-h-[90vh] flex flex-col">
          <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-5 pt-5 pb-4 border-b border-black/5 dark:border-border shrink-0">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-black text-base">
                <div className="h-7 w-7 rounded-lg bg-primary/15 flex items-center justify-center"><Timer className="h-3.5 w-3.5 text-primary" /></div>
                Iniciar Timer
              </DialogTitle>
            </DialogHeader>
          </div>

          <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-1.5"><span className="h-4 w-4 rounded bg-primary/15 text-primary text-[9px] font-black flex items-center justify-center">1</span> Atividade</Label>
              <Input placeholder="Ex: Elaboração de petição inicial..." value={descricao} onChange={e => setDescricao(e.target.value)} className="h-10 rounded-xl" onKeyDown={e => e.key === "Enter" && handleStart()} autoFocus />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-1.5"><span className="h-4 w-4 rounded bg-primary/15 text-primary text-[9px] font-black flex items-center justify-center">2</span> Categoria</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {TIMESHEET_CATEGORIAS.map(cat => {
                  const cfg = CATEGORIA_CONFIG[cat]; const active = categoria === cat;
                  return (
                    <button key={cat} type="button" onClick={() => handleSetCategoria(cat)}
                      className={cn("flex flex-col items-center gap-1 p-2 rounded-lg border text-center transition-all text-[8px] font-black uppercase tracking-wider", active ? cn("border-primary/40 shadow-sm", cfg.color) : "border-black/5 dark:border-border text-muted-foreground/60 hover:border-primary/20 hover:bg-black/[0.02]")}>
                      <cfg.Icon className="h-3.5 w-3.5" />{cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-1.5"><span className="h-4 w-4 rounded bg-primary/15 text-primary text-[9px] font-black flex items-center justify-center">3</span> Cliente / Lead <span className="text-muted-foreground/40 normal-case font-medium tracking-normal">— opcional</span></Label>
              <Select value={clienteId || NONE} onValueChange={v => { const id = v === NONE ? "" : v; setClienteId(id); const r = rateParaCliente(id); if (r != null) setValorHora(String(r)); setRefTipo(CATEGORIA_TO_REF[categoria as TimesheetCategoria] ?? ""); setRefItems([]); setRefId(""); setRefLabel(""); }}>
                <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Selecionar cliente..." /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value={NONE}>Sem cliente</SelectItem>
                  {clientes.map(c => <SelectItem key={c.id} value={c.id}><div className="flex items-center gap-2"><UserCircle className="h-3.5 w-3.5 text-muted-foreground" />{c.nome}</div></SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {categoria && (
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-1.5"><span className="h-4 w-4 rounded bg-primary/15 text-primary text-[9px] font-black flex items-center justify-center">4</span> {CATEGORIA_TO_REF[categoria as TimesheetCategoria] ? `Vincular ${REFERENCIA_CONFIG[CATEGORIA_TO_REF[categoria as TimesheetCategoria]!].label}` : "Vincular a"} <span className="text-muted-foreground/40 normal-case font-medium tracking-normal">— opcional</span></Label>
                {!CATEGORIA_TO_REF[categoria as TimesheetCategoria] && (
                  <div className="flex gap-1.5">
                    {REF_LIVRES.map(key => {
                      const cfg = REFERENCIA_CONFIG[key]; const active = refTipo === key;
                      return (
                        <button key={key} type="button" onClick={() => { setRefTipo(active ? "" : key); setRefId(""); setRefLabel(""); setRefItems([]); }}
                          className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all", active ? cn("border-transparent shadow-sm", cfg.color) : "border-black/8 dark:border-border text-muted-foreground/60 hover:border-primary/20")}>
                          <cfg.Icon className="h-3 w-3" />{cfg.label}
                        </button>
                      );
                    })}
                  </div>
                )}
                {refTipo && (
                  refLoading ? <Skeleton className="h-10 rounded-xl" /> :
                  refItems.length === 0 ? (
                    <p className="text-xs text-muted-foreground/60 py-2.5 px-3 rounded-xl bg-muted/10 border border-black/5 dark:border-border text-center">{clienteId ? "Nenhum item encontrado para este cliente" : "Nenhum item encontrado"}</p>
                  ) : (
                    <Select value={refId} onValueChange={v => { setRefId(v); setRefLabel(refItems.find(i => i.id === v)?.label ?? ""); }}>
                      <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder={`Selecionar ${REFERENCIA_CONFIG[refTipo].label.toLowerCase()}...`} /></SelectTrigger>
                      <SelectContent>
                        {refItems.map(item => <SelectItem key={item.id} value={item.id}><div className="flex flex-col"><span className="text-xs font-semibold">{item.label}</span>{item.sublabel && <span className="text-[10px] text-muted-foreground">{item.sublabel}</span>}</div></SelectItem>)}
                      </SelectContent>
                    </Select>
                  )
                )}
              </div>
            )}

            {/* ⑤ Faturamento */}
            <div className="space-y-2 rounded-xl border border-black/5 dark:border-border bg-card/40 p-3">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5" /> Faturável</Label>
                <Switch checked={faturavel} onCheckedChange={setFaturavel} />
              </div>
              {faturavel && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground">R$/hora</span>
                  <Input type="number" min={0} step="0.01" value={valorHora} onChange={e => setValorHora(e.target.value)} placeholder="Ex: 350" className="h-9 rounded-lg text-sm" />
                </div>
              )}
            </div>
          </div>

          <div className="px-5 pb-5 flex gap-2 justify-end border-t border-black/5 dark:border-border pt-3 shrink-0">
            <Button variant="ghost" onClick={() => { setDialogOpen(false); resetDialog(); }} className="rounded-xl">Cancelar</Button>
            <Button onClick={handleStart} disabled={!descricao || !categoria || saving} className="rounded-xl font-black shadow-premium px-6"><Play className="h-4 w-4 mr-2 fill-current" />{saving ? "Iniciando..." : "Iniciar Timer"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Dialog Lançar / Editar manual ───────────────────────────────────── */}
      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-md rounded-2xl p-0 overflow-hidden max-h-[90vh] flex flex-col">
          <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-5 pt-5 pb-4 border-b border-black/5 dark:border-border shrink-0">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-black text-base">
                <div className="h-7 w-7 rounded-lg bg-primary/15 flex items-center justify-center"><PenLine className="h-3.5 w-3.5 text-primary" /></div>
                {editTarget ? "Editar registro" : "Lançar manualmente"}
              </DialogTitle>
            </DialogHeader>
          </div>

          <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Atividade</Label>
              <Input value={mDesc} onChange={e => setMDesc(e.target.value)} placeholder="Descrição da atividade" className="h-10 rounded-xl" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Categoria</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {TIMESHEET_CATEGORIAS.map(cat => {
                  const cfg = CATEGORIA_CONFIG[cat]; const active = mCat === cat;
                  return (
                    <button key={cat} type="button" onClick={() => setMCat(cat)}
                      className={cn("flex flex-col items-center gap-1 p-2 rounded-lg border text-center transition-all text-[8px] font-black uppercase tracking-wider", active ? cn("border-primary/40 shadow-sm", cfg.color) : "border-black/5 dark:border-border text-muted-foreground/60 hover:border-primary/20")}>
                      <cfg.Icon className="h-3.5 w-3.5" />{cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5 col-span-2 sm:col-span-1">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Data</Label>
                <Input type="date" value={mData} onChange={e => setMData(e.target.value)} className="h-10 rounded-xl text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Início</Label>
                <Input type="time" value={mInicio} onChange={e => setMInicio(e.target.value)} className="h-10 rounded-xl text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Fim</Label>
                <Input type="time" value={mFim} onChange={e => setMFim(e.target.value)} className="h-10 rounded-xl text-sm" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Cliente <span className="text-muted-foreground/40 normal-case font-medium tracking-normal">— opcional</span></Label>
              <Select value={mCli || NONE} onValueChange={v => { const id = v === NONE ? "" : v; setMCli(id); const r = rateParaCliente(id); if (r != null) setMValor(String(r)); }}>
                <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Sem cliente" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value={NONE}>Sem cliente</SelectItem>
                  {clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 rounded-xl border border-black/5 dark:border-border bg-card/40 p-3">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5" /> Faturável</Label>
                <Switch checked={mFat} onCheckedChange={setMFat} />
              </div>
              {mFat && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground">R$/hora</span>
                  <Input type="number" min={0} step="0.01" value={mValor} onChange={e => setMValor(e.target.value)} placeholder="Ex: 350" className="h-9 rounded-lg text-sm" />
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Observações</Label>
              <Textarea value={mObs} onChange={e => setMObs(e.target.value)} rows={2} className="rounded-xl text-sm resize-none" placeholder="Opcional" />
            </div>
          </div>

          <div className="px-5 pb-5 flex gap-2 justify-end border-t border-black/5 dark:border-border pt-3 shrink-0">
            <Button variant="ghost" onClick={() => setManualOpen(false)} className="rounded-xl">Cancelar</Button>
            <Button onClick={saveManual} disabled={!mDesc.trim() || !mCat || mSaving} className="rounded-xl font-black shadow-premium px-6">{mSaving ? "Salvando..." : editTarget ? "Salvar" : "Lançar"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Configurações de faturamento */}
      <TimesheetSettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} config={config} clientes={clientes} onSave={saveConfig} />

      {/* Confirmar geração de cobrança */}
      <Dialog open={cobrarOpen} onOpenChange={(o) => { if (!o && !cobrando) setCobrarOpen(false); }}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-black text-base">
              <div className="h-7 w-7 rounded-lg bg-amber-500/15 flex items-center justify-center"><Receipt className="h-3.5 w-3.5 text-amber-600" /></div>
              Gerar cobrança no Financeiro
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <p className="text-sm text-muted-foreground">
              Serão criadas receitas pendentes no Financeiro (categoria <strong>Honorários</strong>), uma por cliente, totalizando{" "}
              <strong className="text-amber-600">{formatBRL(billing.totalValor)}</strong> ({billing.pend.length} registro{billing.pend.length !== 1 ? "s" : ""}). Os registros são marcados como <strong>faturados</strong>.
            </p>
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="ghost" onClick={() => setCobrarOpen(false)} disabled={cobrando} className="rounded-xl">Cancelar</Button>
              <Button onClick={gerarCobranca} disabled={cobrando} className="rounded-xl font-black px-5 bg-amber-500 hover:bg-amber-600 text-white">
                {cobrando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <DollarSign className="h-4 w-4 mr-2" />}Gerar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmar estorno de cobrança */}
      <Dialog open={!!estornoId} onOpenChange={(o) => { if (!o) setEstornoId(null); }}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-black text-base">
              <div className="h-7 w-7 rounded-lg bg-rose-500/15 flex items-center justify-center"><Receipt className="h-3.5 w-3.5 text-rose-600" /></div>
              Estornar cobrança
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <p className="text-sm text-muted-foreground">
              A receita gerada no Financeiro será <strong>removida</strong> e os registros de timesheet ligados a ela voltam a ficar <strong>não faturados</strong>. Deseja continuar?
            </p>
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="ghost" onClick={() => setEstornoId(null)} className="rounded-xl">Cancelar</Button>
              <Button variant="destructive" onClick={async () => { const id = estornoId!; setEstornoId(null); await estornarCobranca(id); }} className="rounded-xl font-black px-5">
                Estornar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Finalizar com observação */}
      <Dialog open={!!finalizeId} onOpenChange={(o) => { if (!o) setFinalizeId(null); }}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-black text-base">
              <div className="h-7 w-7 rounded-lg bg-primary/15 flex items-center justify-center"><Square className="h-3.5 w-3.5 text-primary fill-current" /></div>
              Finalizar timer
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="text-center text-2xl font-black tabular-nums">{formatSeconds(elapsedTime)}</div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Observação <span className="text-muted-foreground/40 normal-case font-medium tracking-normal">— opcional</span></Label>
              <Textarea value={finalizeObs} onChange={e => setFinalizeObs(e.target.value)} rows={2} className="rounded-xl text-sm resize-none" placeholder="O que foi feito?" />
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="ghost" onClick={() => setFinalizeId(null)} className="rounded-xl">Cancelar</Button>
              <Button variant="destructive" onClick={async () => { const id = finalizeId!; setFinalizeId(null); await stopTimer(id, finalizeObs.trim() || undefined); }} className="rounded-xl font-black px-5">
                <Square className="h-4 w-4 mr-2 fill-current" />Finalizar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
  );
}
