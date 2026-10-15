import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useOfficeTeams } from "@/hooks/useOfficeTeams";
import { useEquipeStats } from "@/hooks/useEquipeStats";
import {
  ArrowLeft, Users, FileText, CheckSquare, Calendar,
  Clock, MessageSquare, BookOpen, TrendingUp, AlertCircle,
  ArrowUpDown, FolderPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  PERIOD_LABEL, type DetailType, type Period, type SortKey, type TeamSummary,
} from "@/components/Equipe/equipeDetalheShared";
import { MemberCard, StatCard } from "@/components/Equipe/EquipeStatCards";
import { TeamDetailDialog } from "@/components/Equipe/TeamDetailDialog";
import { AssignProcessosDialog } from "@/components/Equipe/AssignProcessosDialog";

// Painel de detalhe da equipe. As consultas vivem em useEquipeStats; cards e
// diálogos em src/components/Equipe/.

export default function EquipeDetalhe() {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const { user, isOfficeAdmin } = useAuth();
  const { teams } = useOfficeTeams();

  const team = teams.find(t => t.id === teamId);

  const [period, setPeriod] = useState<Period>("month");
  const [sortKey, setSortKey] = useState<SortKey>("processos");
  const [detailType, setDetailType] = useState<DetailType | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignMember, setAssignMember] = useState<string | null>(null);

  const { members, summary, memberIds, loading, error, refetch } = useEquipeStats(teamId, user?.office_id, period);

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

      {error ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
          <AlertCircle className="h-12 w-12 text-destructive/60" />
          <p className="font-bold">Não foi possível carregar a equipe</p>
          <p className="text-sm text-muted-foreground max-w-sm">{error}</p>
          <Button variant="outline" onClick={refetch} className="mt-2">Tentar novamente</Button>
        </div>
      ) : loading ? (
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
            <span className="text-xs text-muted-foreground">· Dados de {PERIOD_LABEL[period].toLowerCase()}</span>
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
        onChanged={refetch}
      />
    </div>
  );
}
