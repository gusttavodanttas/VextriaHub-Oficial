import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOfficeTeams } from "@/hooks/useOfficeTeams";
import {
  ArrowLeft, Users, FileText, CheckSquare, Calendar,
  Clock, MessageSquare, BookOpen, TrendingUp, AlertCircle,
  ChevronDown, ChevronUp, Crown, ArrowUpDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

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

function StatCard({ icon: Icon, label, value, color }: {
  icon: any; label: string; value: number; color: string;
}) {
  return (
    <div className="flex items-center gap-3 bg-muted/30 border border-border rounded-xl p-4">
      <div className={cn("p-2 rounded-lg shrink-0", color)}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-2xl font-black leading-none">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  );
}

// ─── MemberCard ───────────────────────────────────────────────────────────────

const rankColors = ["text-amber-500", "text-slate-400", "text-orange-700"];

function MemberCard({ member, rank }: { member: MemberStats; rank: number }) {
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

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function EquipeDetalhe() {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
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

    const { data: profilesData } = await supabase
      .from("profiles")
      .select("user_id, full_name, email")
      .in("user_id", userIds);

    const profileMap: Record<string, { full_name: string | null; email: string | null }> = {};
    (profilesData || []).forEach(p => { profileMap[p.user_id] = p; });

    // 2. Processos da equipe (por team_id OU user_id dos membros — sem filtro de data, são ativos)
    const [processosByTeam, processosByMember] = await Promise.all([
      supabase.from("processos").select("user_id").eq("office_id", user.office_id)
        .eq("deletado", false).neq("status", "encerrado").eq("team_id", teamId),
      supabase.from("processos").select("user_id").eq("office_id", user.office_id)
        .eq("deletado", false).neq("status", "encerrado").in("user_id", userIds),
    ]);
    // Mescla evitando contar o mesmo processo duas vezes (processo pode ter team_id E user_id de membro)
    const processosData = [...(processosByTeam.data || []), ...(processosByMember.data || [])];

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
      supabase.from("prazos").select("user_id").eq("office_id", user.office_id)
        .gte("data_fim_prazo", today).lte("data_fim_prazo", in3days).in("user_id", userIds),
      supabase.from("atendimentos").select("user_id").eq("office_id", user.office_id)
        .eq("deletado", false).gte("created_at", start).lte("created_at", end).in("user_id", userIds),
      supabase.from("consultivos").select("user_id").eq("office_id", user.office_id)
        .eq("deletado", false).gte("created_at", start).lte("created_at", end).in("user_id", userIds),
      supabase.from("timesheets").select("user_id, duracao_minutos")
        .gte("created_at", start).lte("created_at", end).in("user_id", userIds),
    ]);

    // 4. Agrupar por user_id
    const countBy = (arr: any[] | null) => {
      const map: Record<string, number> = {};
      (arr || []).forEach(r => { map[r.user_id] = (map[r.user_id] || 0) + 1; });
      return map;
    };

    const processosMap = countBy(processosData);
    const audienciasMap = countBy(audienciasRes.data);
    const prazosMap = countBy(prazosRes.data);
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

  const totalTarefas = summary.tarefasPendentes + summary.tarefasConcluidas;
  const progressPct = totalTarefas > 0
    ? Math.round((summary.tarefasConcluidas / totalTarefas) * 100)
    : 0;

  const sortedMembers = [...members].sort((a, b) => b[sortKey] - a[sortKey]);

  const periodLabel: Record<Period, string> = {
    week: "Esta semana", month: "Este mês", quarter: "Últimos 3 meses", year: "Este ano"
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
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
              <h2 className="font-black text-base">Resumo da Equipe</h2>
              <Badge variant="secondary" className="ml-1">{members.length} membros</Badge>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard icon={FileText} label="Processos ativos" value={summary.processos} color="bg-blue-500/10 text-blue-500" />
              <StatCard icon={CheckSquare} label="Tarefas abertas" value={summary.tarefasPendentes} color="bg-violet-500/10 text-violet-500" />
              <StatCard icon={Calendar} label="Audiências (7 dias)" value={summary.audiencias} color="bg-emerald-500/10 text-emerald-500" />
              <StatCard icon={AlertCircle} label="Prazos (3 dias)" value={summary.prazos} color="bg-amber-500/10 text-amber-500" />
              <StatCard icon={MessageSquare} label="Atendimentos (mês)" value={summary.atendimentos} color="bg-rose-500/10 text-rose-500" />
              <StatCard icon={BookOpen} label="Consultivos" value={summary.consultivos} color="bg-cyan-500/10 text-cyan-500" />
              <StatCard icon={Clock} label="Horas timesheet (mês)" value={summary.horasTimesheet} color="bg-fuchsia-500/10 text-fuchsia-500" />
              <div className="flex flex-col justify-center bg-muted/30 border border-border rounded-xl p-4 gap-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Conclusão tarefas</span>
                  <span className="font-bold">{progressPct}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-violet-500 rounded-full" style={{ width: `${progressPct}%` }} />
                </div>
                <p className="text-[10px] text-muted-foreground">{summary.tarefasConcluidas} de {totalTarefas} tarefas</p>
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
              <div className="flex items-center gap-2 ml-auto">
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
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sortedMembers.map((m, i) => <MemberCard key={m.user_id} member={m} rank={i + 1} />)}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
