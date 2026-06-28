import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOfficeTeams } from "@/hooks/useOfficeTeams";
import {
  ArrowLeft, Users, FileText, CheckSquare, Calendar,
  Clock, MessageSquare, BookOpen, TrendingUp, AlertCircle,
  ChevronDown, ChevronUp, Crown, ArrowUpDown, ChevronRight, ExternalLink,
  FolderPlus, Loader2, Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// ─── Drill-down ─────────────────────────────────────────────────────────────
type DetailType = "processos" | "tarefas" | "audiencias" | "prazos" | "atendimentos" | "consultivos";

const DETAIL_CONFIG: Record<DetailType, { title: string; route: string; icon: any; color: string }> = {
  processos:    { title: "Processos ativos",   route: "/processos",  icon: FileText,      color: "text-blue-500" },
  tarefas:      { title: "Tarefas abertas",    route: "/tarefas",    icon: CheckSquare,   color: "text-violet-500" },
  audiencias:   { title: "Audiências (7 dias)", route: "/audiencias", icon: Calendar,      color: "text-emerald-500" },
  prazos:       { title: "Prazos (3 dias)",    route: "/prazos",     icon: AlertCircle,   color: "text-amber-500" },
  atendimentos: { title: "Atendimentos",       route: "/atendimentos", icon: MessageSquare, color: "text-rose-500" },
  consultivos:  { title: "Consultivos",        route: "/consultivo", icon: BookOpen,      color: "text-cyan-500" },
};

function fmtDate(d: string | null | undefined) {
  if (!d) return "";
  try { return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }); }
  catch { return ""; }
}

type Period = "week" | "month" | "quarter" | "year";
type SortKey = "processos" | "tarefasPendentes" | "tarefasConcluidas" | "audiencias" | "atendimentos" | "horasTimesheet";

function getPeriodDates(period: Period) {
  const now = new Date();
  const end = new Date(now);
  let start: Date;
  switch (period) {
    case "week":
      start = new Date(now); start.setDate(now.getDate() - 7); break;
    case "month":
      start = new Date(now.getFullYear(), now.getMonth(), 1); break;
    case "quarter":
      start = new Date(now); start.setMonth(now.getMonth() - 3); break;
    case "year":
      start = new Date(now.getFullYear(), 0, 1); break;
  }
  return { start: start.toISOString(), end: end.toISOString(), startDate: start.toISOString().split("T")[0], endDate: end.toISOString().split("T")[0] };
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface MemberStats {
  user_id: string;
  full_name: string | null;
  email: string | null;
  role: "coordinator" | "member";
  processos: number;
  tarefasPendentes: number;
  tarefasConcluidas: number;
  audiencias: number;
  prazos: number;
  atendimentos: number;
  consultivos: number;
  horasTimesheet: number;
}

interface TeamSummary {
  processos: number;
  tarefasPendentes: number;
  tarefasConcluidas: number;
  audiencias: number;
  prazos: number;
  atendimentos: number;
  consultivos: number;
  horasTimesheet: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "bg-blue-500","bg-violet-500","bg-emerald-500","bg-amber-500",
  "bg-rose-500","bg-cyan-500","bg-fuchsia-500","bg-orange-500",
];

function avatarColor(id: string) {
  let n = 0;
  for (let i = 0; i < id.length; i++) n += id.charCodeAt(i);
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}

function getInitials(name: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color, onClick }: {
  icon: any; label: string; value: number; color: string; onClick?: () => void;
}) {
  const clickable = !!onClick && value > 0;
  return (
    <button
      type="button"
      onClick={clickable ? onClick : undefined}
      disabled={!clickable}
      className={cn(
        "flex items-center gap-3 bg-muted/30 border border-border rounded-xl p-4 text-left w-full transition-all",
        clickable ? "hover:border-primary/40 hover:bg-muted/50 cursor-pointer" : "cursor-default"
      )}
    >
      <div className={cn("p-2 rounded-lg shrink-0", color)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-black leading-none">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{label}</p>
      </div>
      {clickable && <ChevronRight className="h-4 w-4 text-muted-foreground/40 ml-auto shrink-0" />}
    </button>
  );
}

// ─── MemberCard ───────────────────────────────────────────────────────────────

const rankColors = ["text-amber-500", "text-slate-400", "text-orange-700"];

function MemberCard({ member, rank, onAssign }: { member: MemberStats; rank: number; onAssign?: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const name = member.full_name || member.email || "Membro";
  const totalTarefas = member.tarefasPendentes + member.tarefasConcluidas;
  const progressPct = totalTarefas > 0
    ? Math.round((member.tarefasConcluidas / totalTarefas) * 100)
    : 0;

  return (
    <div className="border border-border rounded-2xl overflow-hidden bg-card transition-shadow hover:shadow-md">
      {/* Header */}
      <div className="flex items-center gap-4 p-5">
        <div className="relative shrink-0">
          <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center text-sm font-black text-white", avatarColor(member.user_id))}>
            {getInitials(name)}
          </div>
          {rank <= 3 && (
            <span className={cn("absolute -top-1.5 -right-1.5 text-xs font-black", rankColors[rank - 1])}>
              #{rank}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-bold truncate">{name}</p>
            {member.role === "coordinator" && (
              <Crown className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">{member.email}</p>
        </div>
        {onAssign && (
          <Button
            size="sm" variant="outline"
            onClick={onAssign}
            className="h-8 rounded-lg shrink-0 gap-1.5 text-xs font-bold"
          >
            <FolderPlus className="h-3.5 w-3.5" /> Atribuir
          </Button>
        )}
        <Button
          size="sm" variant="ghost"
          onClick={() => setExpanded(v => !v)}
          className="h-8 w-8 rounded-lg shrink-0"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </div>

      {/* Mini stats always visible */}
      <div className="grid grid-cols-4 border-t border-border divide-x divide-border">
        {[
          { label: "Processos", value: member.processos, color: "text-blue-500" },
          { label: "Tarefas", value: member.tarefasPendentes, color: "text-violet-500" },
          { label: "Audiências", value: member.audiencias, color: "text-emerald-500" },
          { label: "Prazos", value: member.prazos, color: "text-amber-500" },
        ].map(s => (
          <div key={s.label} className="py-3 text-center">
            <p className={cn("text-lg font-black", s.color)}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-border p-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Progresso de tarefas */}
          {totalTarefas > 0 && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Tarefas concluídas</span>
                <span className="font-bold">{member.tarefasConcluidas}/{totalTarefas} ({progressPct}%)</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-violet-500 rounded-full transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          {/* Outros indicadores */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-muted/30 rounded-xl p-3 text-center">
              <MessageSquare className="h-4 w-4 text-rose-500 mx-auto mb-1" />
              <p className="text-base font-black">{member.atendimentos}</p>
              <p className="text-[10px] text-muted-foreground">Atendimentos</p>
            </div>
            <div className="bg-muted/30 rounded-xl p-3 text-center">
              <BookOpen className="h-4 w-4 text-cyan-500 mx-auto mb-1" />
              <p className="text-base font-black">{member.consultivos}</p>
              <p className="text-[10px] text-muted-foreground">Consultivos</p>
            </div>
            <div className="bg-muted/30 rounded-xl p-3 text-center">
              <Clock className="h-4 w-4 text-fuchsia-500 mx-auto mb-1" />
              <p className="text-base font-black">{member.horasTimesheet}h</p>
              <p className="text-[10px] text-muted-foreground">Timesheet</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TeamDetailDialog (drill-down) ──────────────────────────────────────────────

interface DetailItem {
  id: string;
  primary: string;
  secondary?: string;
  badge?: string;
}

function TeamDetailDialog({
  type, teamId, memberIds, officeId, period, onClose, onNavigate,
}: {
  type: DetailType | null;
  teamId: string;
  memberIds: string[];
  officeId: string;
  period: Period;
  onClose: () => void;
  onNavigate: (route: string, id?: string) => void;
}) {
  const [items, setItems] = useState<DetailItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!type) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      const { start, end } = getPeriodDates(period);
      const now = new Date();
      const in7days = new Date(Date.now() + 7 * 864e5).toISOString();
      const in3days = new Date(Date.now() + 3 * 864e5).toISOString().split("T")[0];
      const today = now.toISOString().split("T")[0];
      let result: DetailItem[] = [];

      if (type === "processos") {
        const sel = "id, titulo, numero_processo, status";
        const [byTeam, byResp, byCreator] = await Promise.all([
          supabase.from("processos").select(sel)
            .eq("office_id", officeId).eq("deletado", false).neq("status", "encerrado").eq("team_id", teamId),
          supabase.from("processos").select(sel)
            .eq("office_id", officeId).eq("deletado", false).neq("status", "encerrado").in("responsavel_id", memberIds),
          supabase.from("processos").select(sel)
            .eq("office_id", officeId).eq("deletado", false).neq("status", "encerrado").in("user_id", memberIds),
        ]);
        const seen = new Set<string>();
        result = [...(byTeam.data || []), ...(byResp.data || []), ...(byCreator.data || [])]
          .filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; })
          .map(p => ({ id: p.id, primary: p.titulo || "Processo", secondary: p.numero_processo || "", badge: p.status }));
      } else if (type === "tarefas") {
        const { data } = await supabase.from("tarefas").select("id, titulo, data_vencimento")
          .eq("office_id", officeId).eq("deletado", false).eq("concluida", false)
          .in("user_id", memberIds).gte("created_at", start).lte("created_at", end);
        result = (data || []).map(t => ({ id: t.id, primary: t.titulo || "Tarefa", secondary: t.data_vencimento ? `Vence ${fmtDate(t.data_vencimento)}` : "" }));
      } else if (type === "audiencias") {
        const { data } = await supabase.from("audiencias").select("id, titulo, data_audiencia, local")
          .eq("office_id", officeId).eq("deletado", false)
          .gte("data_audiencia", now.toISOString()).lte("data_audiencia", in7days).in("user_id", memberIds);
        result = (data || []).map(a => ({ id: a.id, primary: a.titulo || "Audiência", secondary: `${fmtDate(a.data_audiencia)}${a.local ? ` · ${a.local}` : ""}` }));
      } else if (type === "prazos") {
        const { data } = await supabase.from("prazos").select("id, tipo_prazo, data_fim_prazo")
          .eq("office_id", officeId).gte("data_fim_prazo", today).lte("data_fim_prazo", in3days).in("responsavel_id", memberIds);
        result = (data || []).map(p => ({ id: p.id, primary: p.tipo_prazo || "Prazo", secondary: p.data_fim_prazo ? `Fatal ${fmtDate(p.data_fim_prazo)}` : "" }));
      } else if (type === "atendimentos") {
        const { data } = await supabase.from("atendimentos").select("id, tipo_atendimento, data_atendimento")
          .eq("office_id", officeId).eq("deletado", false)
          .gte("created_at", start).lte("created_at", end).in("user_id", memberIds);
        result = (data || []).map(a => ({ id: a.id, primary: a.tipo_atendimento || "Atendimento", secondary: fmtDate(a.data_atendimento) }));
      } else if (type === "consultivos") {
        const { data } = await supabase.from("consultivos").select("id, titulo, status")
          .eq("office_id", officeId).eq("deletado", false)
          .gte("created_at", start).lte("created_at", end).in("user_id", memberIds);
        result = (data || []).map(c => ({ id: c.id, primary: c.titulo || "Consultivo", badge: c.status || undefined }));
      }

      if (!cancel) { setItems(result); setLoading(false); }
    })();
    return () => { cancel = true; };
  }, [type, teamId, officeId, period, memberIds.join(",")]);

  if (!type) return null;
  const cfg = DETAIL_CONFIG[type];
  const Icon = cfg.icon;

  return (
    <Dialog open={!!type} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent aria-describedby={undefined} className="max-w-lg rounded-2xl p-0 overflow-hidden max-h-[80vh] flex flex-col">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
          <DialogTitle className="flex items-center gap-2.5 text-base font-black">
            <span className={cn("p-1.5 rounded-lg bg-muted/50", cfg.color)}><Icon className="h-4 w-4" /></span>
            {cfg.title}
            {!loading && <Badge variant="secondary" className="ml-1">{items.length}</Badge>}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          {loading ? (
            [...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)
          ) : items.length === 0 ? (
            <div className="py-12 text-center">
              <Icon className={cn("h-10 w-10 mx-auto mb-2 opacity-20", cfg.color)} />
              <p className="text-sm text-muted-foreground">Nenhum item encontrado neste período.</p>
            </div>
          ) : (
            items.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(cfg.route, item.id)}
                className="group w-full flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/20 hover:bg-primary/5 hover:border-primary/40 transition-all text-left"
              >
                <span className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0 bg-background border border-border", cfg.color)}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate group-hover:text-primary transition-colors">{item.primary}</p>
                  {item.secondary && <p className="text-xs text-muted-foreground truncate">{item.secondary}</p>}
                </div>
                {item.badge && <Badge variant="outline" className="shrink-0 text-[10px] capitalize">{item.badge}</Badge>}
                <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>
            ))
          )}
        </div>

        <div className="px-5 py-3 border-t border-border flex items-center justify-between gap-2">
          <p className="text-[11px] text-muted-foreground">Clique num item para abri-lo</p>
          <Button size="sm" variant="outline" onClick={() => onNavigate(cfg.route)} className="rounded-xl gap-2 text-xs font-black">
            <ExternalLink className="h-3.5 w-3.5" /> Ver todos
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── AssignProcessosDialog (atribuir responsável) ───────────────────────────────

interface AssignItem { id: string; titulo: string; sub: string; responsavel_id: string | null; }
type AssignKind = "processos" | "tarefas" | "audiencias";

const ASSIGN_TABS: { kind: AssignKind; label: string; icon: any }[] = [
  { kind: "processos", label: "Processos", icon: FileText },
  { kind: "tarefas", label: "Tarefas", icon: CheckSquare },
  { kind: "audiencias", label: "Audiências", icon: Calendar },
];

function AssignProcessosDialog({
  open, teamId, officeId, members, defaultMemberId, onClose, onChanged,
}: {
  open: boolean;
  teamId: string;
  officeId: string;
  members: { user_id: string; full_name: string | null; email: string | null }[];
  defaultMemberId?: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [kind, setKind] = useState<AssignKind>("processos");
  const [items, setItems] = useState<AssignItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState<string | null>(null);

  const ids = members.length ? members.map(m => m.user_id) : ["00000000-0000-0000-0000-000000000000"];

  useEffect(() => {
    if (!open) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      const dedup = (rows: any[]) => {
        const seen = new Set<string>();
        return rows.filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true; });
      };
      let result: AssignItem[] = [];

      if (kind === "processos") {
        const sel = "id, titulo, numero_processo, responsavel_id";
        const [a, b, c] = await Promise.all([
          supabase.from("processos").select(sel).eq("office_id", officeId).eq("deletado", false).neq("status", "encerrado").eq("team_id", teamId),
          supabase.from("processos").select(sel).eq("office_id", officeId).eq("deletado", false).neq("status", "encerrado").in("responsavel_id", ids),
          supabase.from("processos").select(sel).eq("office_id", officeId).eq("deletado", false).neq("status", "encerrado").in("user_id", ids),
        ]);
        result = dedup([...(a.data || []), ...(b.data || []), ...(c.data || [])])
          .map((p: any) => ({ id: p.id, titulo: p.titulo || "Processo", sub: p.numero_processo || "", responsavel_id: p.responsavel_id }));
      } else if (kind === "tarefas") {
        const sel = "id, titulo, data_vencimento, responsavel_id";
        const [a, b] = await Promise.all([
          supabase.from("tarefas").select(sel).eq("office_id", officeId).eq("deletado", false).in("responsavel_id", ids),
          supabase.from("tarefas").select(sel).eq("office_id", officeId).eq("deletado", false).in("user_id", ids),
        ]);
        result = dedup([...(a.data || []), ...(b.data || [])])
          .map((t: any) => ({ id: t.id, titulo: t.titulo || "Tarefa", sub: t.data_vencimento ? `Vence ${fmtDate(t.data_vencimento)}` : "", responsavel_id: t.responsavel_id }));
      } else {
        const sel = "id, titulo, data_audiencia, responsavel_id";
        const [a, b] = await Promise.all([
          supabase.from("audiencias").select(sel).eq("office_id", officeId).eq("deletado", false).in("responsavel_id", ids),
          supabase.from("audiencias").select(sel).eq("office_id", officeId).eq("deletado", false).in("user_id", ids),
        ]);
        result = dedup([...(a.data || []), ...(b.data || [])])
          .map((a2: any) => ({ id: a2.id, titulo: a2.titulo || "Audiência", sub: a2.data_audiencia ? fmtDate(a2.data_audiencia) : "", responsavel_id: a2.responsavel_id }));
      }

      if (!cancel) { setItems(result); setLoading(false); }
    })();
    return () => { cancel = true; };
  }, [open, kind, teamId, officeId, ids.join(",")]);

  const assign = async (itemId: string, userId: string) => {
    setSavingId(itemId);
    const { error } = await supabase.from(kind).update({ responsavel_id: userId }).eq("id", itemId);
    setSavingId(null);
    if (!error) {
      setItems(prev => prev.map(p => p.id === itemId ? { ...p, responsavel_id: userId } : p));
      setJustSaved(itemId);
      setTimeout(() => setJustSaved(s => s === itemId ? null : s), 1500);
      onChanged();
    }
  };

  const nameOf = (uid: string | null) => {
    const m = members.find(x => x.user_id === uid);
    return m ? (m.full_name || m.email || "Membro") : null;
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent aria-describedby={undefined} className="max-w-lg rounded-2xl p-0 overflow-hidden max-h-[82vh] flex flex-col">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
          <DialogTitle className="flex items-center gap-2.5 text-base font-black">
            <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500"><FolderPlus className="h-4 w-4" /></span>
            Atribuir trabalho
            {defaultMemberId && (
              <span className="text-xs font-bold text-muted-foreground">→ {nameOf(defaultMemberId)}</span>
            )}
          </DialogTitle>
          <p className="text-[11px] text-muted-foreground mt-1">Defina o responsável de cada item da equipe.</p>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-1 px-5 pt-3">
          {ASSIGN_TABS.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.kind} type="button" onClick={() => setKind(t.kind)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors",
                  kind === t.kind ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/50"
                )}>
                <Icon className="h-3.5 w-3.5" /> {t.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          {loading ? (
            [...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)
          ) : items.length === 0 ? (
            <div className="py-12 text-center">
              <FolderPlus className="h-10 w-10 mx-auto mb-2 opacity-20 text-blue-500" />
              <p className="text-sm text-muted-foreground">Nenhum item da equipe aqui ainda.</p>
            </div>
          ) : (
            items.map(p => (
              <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/20">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{p.titulo}</p>
                  {p.sub && <p className="text-xs text-muted-foreground truncate">{p.sub}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {justSaved === p.id && <Check className="h-4 w-4 text-emerald-500" />}
                  {savingId === p.id && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  <Select
                    value={p.responsavel_id || ""}
                    onValueChange={(v) => assign(p.id, v)}
                  >
                    <SelectTrigger className="h-9 w-40 rounded-lg text-xs">
                      <SelectValue placeholder="Responsável" />
                    </SelectTrigger>
                    <SelectContent>
                      {members.map(m => (
                        <SelectItem key={m.user_id} value={m.user_id}>
                          {m.full_name || m.email || "Membro"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="px-5 py-3 border-t border-border flex justify-end">
          <Button size="sm" onClick={onClose} className="rounded-xl text-xs font-black">Concluído</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function EquipeDetalhe() {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const { user, isOfficeAdmin } = useAuth();
  const { teams } = useOfficeTeams();

  const team = teams.find(t => t.id === teamId);

  const [members, setMembers] = useState<MemberStats[]>([]);
  const [summary, setSummary] = useState<TeamSummary>({
    processos: 0, tarefasPendentes: 0, tarefasConcluidas: 0,
    audiencias: 0, prazos: 0, atendimentos: 0, consultivos: 0, horasTimesheet: 0,
  });
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("month");
  const [sortKey, setSortKey] = useState<SortKey>("processos");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [detailType, setDetailType] = useState<DetailType | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignMember, setAssignMember] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!teamId || !user?.office_id) return;
    setLoading(true);

    const { start, end, startDate, endDate } = getPeriodDates(period);
    const now = new Date();
    const in7days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const in3days = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const today = now.toISOString().split("T")[0];

    // 1. Buscar membros da equipe com perfis
    const { data: membersData } = await supabase
      .from("office_team_members")
      .select("user_id, role")
      .eq("team_id", teamId);

    if (!membersData?.length) { setLoading(false); return; }

    const userIds = membersData.map(m => m.user_id);
    setMemberIds(userIds);

    const { data: profilesData } = await supabase
      .from("profiles")
      .select("user_id, full_name, email")
      .in("user_id", userIds);

    const profileMap: Record<string, { full_name: string | null; email: string | null }> = {};
    (profilesData || []).forEach(p => { profileMap[p.user_id] = p; });

    // 2. Processos da equipe (team_id, responsável OU criador membro — sem filtro de data, são ativos)
    const procSel = "id, user_id, responsavel_id, team_id";
    const [procByTeam, procByResp, procByCreator] = await Promise.all([
      supabase.from("processos").select(procSel).eq("office_id", user.office_id)
        .eq("deletado", false).neq("status", "encerrado").eq("team_id", teamId),
      supabase.from("processos").select(procSel).eq("office_id", user.office_id)
        .eq("deletado", false).neq("status", "encerrado").in("responsavel_id", userIds),
      supabase.from("processos").select(procSel).eq("office_id", user.office_id)
        .eq("deletado", false).neq("status", "encerrado").in("user_id", userIds),
    ]);
    // Mescla deduplicando por id (um processo pode bater em mais de um critério)
    const procSeen = new Set<string>();
    const processosData = [...(procByTeam.data || []), ...(procByResp.data || []), ...(procByCreator.data || [])]
      .filter((p: any) => { if (procSeen.has(p.id)) return false; procSeen.add(p.id); return true; });

    // 3. Buscar demais métricas em paralelo filtradas pelo período
    const [
      tarefasRes, audienciasRes,
      prazosRes, atendimentosRes, consultivosRes, timesheetRes
    ] = await Promise.all([
      supabase.from("tarefas").select("user_id, concluida").eq("office_id", user.office_id)
        .eq("deletado", false).in("user_id", userIds)
        .gte("created_at", start).lte("created_at", end),
      supabase.from("audiencias").select("user_id").eq("office_id", user.office_id)
        .eq("deletado", false).gte("data_audiencia", now.toISOString())
        .lte("data_audiencia", in7days).in("user_id", userIds),
      supabase.from("prazos").select("responsavel_id").eq("office_id", user.office_id)
        .gte("data_fim_prazo", today).lte("data_fim_prazo", in3days).in("responsavel_id", userIds),
      supabase.from("atendimentos").select("user_id").eq("office_id", user.office_id)
        .eq("deletado", false).gte("created_at", start).lte("created_at", end).in("user_id", userIds),
      supabase.from("consultivos").select("user_id").eq("office_id", user.office_id)
        .eq("deletado", false).gte("created_at", start).lte("created_at", end).in("user_id", userIds),
      supabase.from("timesheets").select("user_id, duracao_minutos")
        .gte("created_at", start).lte("created_at", end).in("user_id", userIds),
    ]);

    // 4. Agrupar por user_id (key = campo que identifica o membro)
    const countBy = (arr: any[] | null, key = "user_id") => {
      const map: Record<string, number> = {};
      (arr || []).forEach(r => { const k = r[key]; if (k) map[k] = (map[k] || 0) + 1; });
      return map;
    };

    const processosMap: Record<string, number> = {};
    processosData.forEach((p: any) => {
      const k = p.responsavel_id || p.user_id;
      if (k) processosMap[k] = (processosMap[k] || 0) + 1;
    });
    const audienciasMap = countBy(audienciasRes.data);
    const prazosMap = countBy(prazosRes.data, "responsavel_id");
    const atendimentosMap = countBy(atendimentosRes.data);
    const consultivosMap = countBy(consultivosRes.data);

    const tarefasPendMap: Record<string, number> = {};
    const tarefasConcMap: Record<string, number> = {};
    (tarefasRes.data || []).forEach(t => {
      if (t.concluida) tarefasConcMap[t.user_id] = (tarefasConcMap[t.user_id] || 0) + 1;
      else tarefasPendMap[t.user_id] = (tarefasPendMap[t.user_id] || 0) + 1;
    });

    const horasMap: Record<string, number> = {};
    (timesheetRes.data || []).forEach(t => {
      horasMap[t.user_id] = (horasMap[t.user_id] || 0) + (t.duracao_minutos || 0);
    });

    // 4. Montar lista de membros
    const memberStats: MemberStats[] = membersData.map(m => ({
      user_id: m.user_id,
      full_name: profileMap[m.user_id]?.full_name ?? null,
      email: profileMap[m.user_id]?.email ?? null,
      role: m.role as "coordinator" | "member",
      processos: processosMap[m.user_id] || 0,
      tarefasPendentes: tarefasPendMap[m.user_id] || 0,
      tarefasConcluidas: tarefasConcMap[m.user_id] || 0,
      audiencias: audienciasMap[m.user_id] || 0,
      prazos: prazosMap[m.user_id] || 0,
      atendimentos: atendimentosMap[m.user_id] || 0,
      consultivos: consultivosMap[m.user_id] || 0,
      horasTimesheet: Math.round((horasMap[m.user_id] || 0) / 60),
    }));

    // Coordenadores primeiro
    memberStats.sort((a, b) =>
      a.role === "coordinator" && b.role !== "coordinator" ? -1 :
      b.role === "coordinator" && a.role !== "coordinator" ? 1 : 0
    );

    setMembers(memberStats);

    // 5. Resumo da equipe
    setSummary({
      processos: processosData.length,
      tarefasPendentes: memberStats.reduce((s, m) => s + m.tarefasPendentes, 0),
      tarefasConcluidas: memberStats.reduce((s, m) => s + m.tarefasConcluidas, 0),
      audiencias: memberStats.reduce((s, m) => s + m.audiencias, 0),
      prazos: memberStats.reduce((s, m) => s + m.prazos, 0),
      atendimentos: memberStats.reduce((s, m) => s + m.atendimentos, 0),
      consultivos: memberStats.reduce((s, m) => s + m.consultivos, 0),
      horasTimesheet: memberStats.reduce((s, m) => s + m.horasTimesheet, 0),
    });

    setLoading(false);
  }, [teamId, user?.office_id, period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const sortedMembers = [...members].sort((a, b) => b[sortKey] - a[sortKey]);

  // Só admin do escritório ou coordenador desta equipe pode atribuir processos
  // e ver a produtividade de todos os membros
  const myRole = members.find(m => m.user_id === user?.id)?.role;
  const canAssign = isOfficeAdmin || myRole === "coordinator";
  const canSeeAllMembers = canAssign;
  const visibleMembers = canSeeAllMembers
    ? sortedMembers
    : sortedMembers.filter(m => m.user_id === user?.id);

  // Resumo: time inteiro para admin/coordenador; só os próprios números para o membro
  const ownStats = members.find(m => m.user_id === user?.id);
  const displaySummary: TeamSummary = canSeeAllMembers ? summary : {
    processos: ownStats?.processos ?? 0,
    tarefasPendentes: ownStats?.tarefasPendentes ?? 0,
    tarefasConcluidas: ownStats?.tarefasConcluidas ?? 0,
    audiencias: ownStats?.audiencias ?? 0,
    prazos: ownStats?.prazos ?? 0,
    atendimentos: ownStats?.atendimentos ?? 0,
    consultivos: ownStats?.consultivos ?? 0,
    horasTimesheet: ownStats?.horasTimesheet ?? 0,
  };
  const effectiveMemberIds = canSeeAllMembers ? memberIds : (user?.id ? [user.id] : []);

  const totalTarefas = displaySummary.tarefasPendentes + displaySummary.tarefasConcluidas;
  const progressPct = totalTarefas > 0
    ? Math.round((displaySummary.tarefasConcluidas / totalTarefas) * 100)
    : 0;

  const periodLabel: Record<Period, string> = {
    week: "Esta semana", month: "Este mês", quarter: "Últimos 3 meses", year: "Este ano"
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6 md:space-y-8 overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/equipe")}
          className="h-9 gap-2 rounded-xl">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        {team && (
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: team.color + "33" }}>
              <div className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: team.color }} />
            </div>
            <div>
              <h1 className="text-2xl font-black leading-none">{team.name}</h1>
              {team.description && (
                <p className="text-sm text-muted-foreground mt-0.5">{team.description}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
          </div>
        </div>
      ) : members.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Users className="h-12 w-12 text-muted-foreground/30" />
          <p className="text-muted-foreground font-medium">Nenhum membro nesta equipe</p>
          <Button variant="outline" onClick={() => navigate("/equipe")} className="mt-2">
            Gerenciar equipe
          </Button>
        </div>
      ) : (
        <>
          {/* Controles de período */}
          <div className="flex flex-wrap items-center gap-3">
            <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
              <SelectTrigger className="h-9 w-44 rounded-xl text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Esta semana</SelectItem>
                <SelectItem value="month">Este mês</SelectItem>
                <SelectItem value="quarter">Últimos 3 meses</SelectItem>
                <SelectItem value="year">Este ano</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">· Dados de {periodLabel[period].toLowerCase()}</span>
          </div>

          {/* Resumo da equipe */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h2 className="font-black text-base">{canSeeAllMembers ? "Resumo da Equipe" : "Meu Resumo"}</h2>
              {canSeeAllMembers && <Badge variant="secondary" className="ml-1">{members.length} membros</Badge>}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard icon={FileText} label="Processos ativos" value={displaySummary.processos} color="bg-blue-500/10 text-blue-500" onClick={() => setDetailType("processos")} />
              <StatCard icon={CheckSquare} label="Tarefas abertas" value={displaySummary.tarefasPendentes} color="bg-violet-500/10 text-violet-500" onClick={() => setDetailType("tarefas")} />
              <StatCard icon={Calendar} label="Audiências (7 dias)" value={displaySummary.audiencias} color="bg-emerald-500/10 text-emerald-500" onClick={() => setDetailType("audiencias")} />
              <StatCard icon={AlertCircle} label="Prazos (3 dias)" value={displaySummary.prazos} color="bg-amber-500/10 text-amber-500" onClick={() => setDetailType("prazos")} />
              <StatCard icon={MessageSquare} label="Atendimentos (mês)" value={displaySummary.atendimentos} color="bg-rose-500/10 text-rose-500" onClick={() => setDetailType("atendimentos")} />
              <StatCard icon={BookOpen} label="Consultivos" value={displaySummary.consultivos} color="bg-cyan-500/10 text-cyan-500" onClick={() => setDetailType("consultivos")} />
              <StatCard icon={Clock} label="Horas timesheet (mês)" value={displaySummary.horasTimesheet} color="bg-fuchsia-500/10 text-fuchsia-500" />
              <div className="flex flex-col justify-center bg-muted/30 border border-border rounded-xl p-4 gap-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Conclusão tarefas</span>
                  <span className="font-bold">{progressPct}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-violet-500 rounded-full" style={{ width: `${progressPct}%` }} />
                </div>
                <p className="text-[10px] text-muted-foreground">{displaySummary.tarefasConcluidas} de {totalTarefas} tarefas</p>
              </div>
            </div>
          </div>

          {/* Produtividade por membro */}
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <h2 className="font-black text-base">Produtividade por Membro</h2>
              </div>
              {canAssign && (
                <Button
                  size="sm" variant="outline"
                  onClick={() => { setAssignMember(null); setAssignOpen(true); }}
                  className="h-8 rounded-xl gap-1.5 text-xs font-bold ml-auto"
                >
                  <FolderPlus className="h-3.5 w-3.5" /> Atribuir trabalho
                </Button>
              )}
              {canSeeAllMembers && (
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                  <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
                    <SelectTrigger className="h-8 w-44 rounded-xl text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="processos">Processos</SelectItem>
                      <SelectItem value="tarefasPendentes">Tarefas abertas</SelectItem>
                      <SelectItem value="tarefasConcluidas">Tarefas concluídas</SelectItem>
                      <SelectItem value="audiencias">Audiências</SelectItem>
                      <SelectItem value="atendimentos">Atendimentos</SelectItem>
                      <SelectItem value="horasTimesheet">Horas timesheet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {visibleMembers.map((m, i) => <MemberCard key={m.user_id} member={m} rank={canSeeAllMembers ? i + 1 : 99} onAssign={canAssign ? () => { setAssignMember(m.user_id); setAssignOpen(true); } : undefined} />)}
            </div>
          </div>
        </>
      )}

      <TeamDetailDialog
        type={detailType}
        teamId={teamId || ""}
        memberIds={effectiveMemberIds}
        officeId={user?.office_id || ""}
        period={period}
        onClose={() => setDetailType(null)}
        onNavigate={(route, id) => { setDetailType(null); navigate(id ? `${route}?openId=${id}` : route); }}
      />

      <AssignProcessosDialog
        open={assignOpen}
        teamId={teamId || ""}
        officeId={user?.office_id || ""}
        members={members.map(m => ({ user_id: m.user_id, full_name: m.full_name, email: m.email }))}
        defaultMemberId={assignMember}
        onClose={() => setAssignOpen(false)}
        onChanged={fetchData}
      />
    </div>
  );
}
