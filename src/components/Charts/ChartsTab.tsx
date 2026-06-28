import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useChartsData, type ChartsPeriod } from "@/hooks/useChartsData";
import { useAuth } from "@/contexts/AuthContext";
import { useOfficeTeams } from "@/hooks/useOfficeTeams";
import { useMyTeams } from "@/hooks/useMyTeams";
import { ChartsConfigDialog } from "./ChartsConfigDialog";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, Legend,
} from "recharts";
import {
  FileText, Users, MessageSquare, TrendingUp, TrendingDown, BarChart3, Trophy, Settings2,
} from "lucide-react";

const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

function TrendBadge({ delta }: { delta: number | null }) {
  if (delta === null || delta === 0) return null;
  const up = delta > 0;
  return (
    <span className={cn(
      "inline-flex items-center gap-0.5 text-[10px] font-black px-1.5 py-0.5 rounded-md",
      up ? "text-emerald-600 bg-emerald-500/10" : "text-rose-600 bg-rose-500/10"
    )}>
      {up ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
      {Math.abs(delta)}%
    </span>
  );
}

function KpiMini({ icon: Icon, label, value, color, bg, trend, sub }: {
  icon: any; label: string; value: string | number; color: string; bg: string; trend?: number | null; sub?: string;
}) {
  return (
    <div className="group flex items-center gap-3 rounded-2xl border border-black/5 dark:border-border bg-card/40 p-4 transition-all hover:shadow-md hover:-translate-y-0.5">
      <div className={cn("p-2.5 rounded-xl shrink-0 transition-transform group-hover:scale-110", bg)}><Icon className={cn("h-5 w-5", color)} /></div>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">{label}</p>
        <div className="flex items-baseline gap-1.5">
          <p className="text-xl font-black tracking-tight truncate">{value}</p>
          {trend !== undefined && <TrendBadge delta={trend ?? null} />}
        </div>
        {sub && <p className="text-[10px] text-muted-foreground/50 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

const pctDelta = (arr: any[], key: string): number | null => {
  if (!arr || arr.length < 2) return null;
  const a = Number(arr[arr.length - 1][key]) || 0;
  const b = Number(arr[arr.length - 2][key]) || 0;
  if (b === 0) return a > 0 ? 100 : null;
  return Math.round(((a - b) / b) * 100);
};

const tooltipStyle = {
  contentStyle: { borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontSize: 12 },
  labelStyle: { fontWeight: 700 },
};

function ChartCard({ title, children, empty }: { title: string; children: React.ReactNode; empty?: boolean }) {
  return (
    <Card className="rounded-2xl border-black/5 dark:border-border">
      <CardHeader className="pb-2"><CardTitle className="text-sm font-black">{title}</CardTitle></CardHeader>
      <CardContent>
        {empty ? (
          <div className="h-[280px] flex flex-col items-center justify-center gap-2 text-center">
            <BarChart3 className="h-10 w-10 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">Sem dados no período.</p>
          </div>
        ) : children}
      </CardContent>
    </Card>
  );
}

export function ChartsTab() {
  const [period, setPeriod] = useState<ChartsPeriod>(6);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const { isOfficeAdmin, user } = useAuth();
  const { teams: allTeams } = useOfficeTeams();
  const { teams: myTeams, isAnyCoordinator } = useMyTeams();

  // Admin escolhe entre todas as equipes; coordenador entre as que coordena
  const teamOptions = useMemo(() => {
    if (isOfficeAdmin) return allTeams.map(t => ({ id: t.id, name: t.name }));
    return myTeams.filter(t => t.myRole === "coordinator").map(t => ({ id: t.id, name: t.name }));
  }, [isOfficeAdmin, allTeams, myTeams]);

  const canSeeTeams = isOfficeAdmin || isAnyCoordinator;
  const canSeeFinanceiro = isOfficeAdmin;
  const d = useChartsData(period, teamId);

  if (d.loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-80 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const saldo = d.totals.receita - d.totals.despesa;
  const ranking = [...d.porMembro].filter(m => m.pontos > 0).sort((a, b) => b.pontos - a.pontos);

  return (
    <div className="space-y-5">
      {/* Período + Equipe */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <Select value={String(period)} onValueChange={(v) => setPeriod(Number(v) as ChartsPeriod)}>
          <SelectTrigger className="h-9 w-full sm:w-44 rounded-xl text-xs font-bold"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="6">Últimos 6 meses</SelectItem>
            <SelectItem value="12">Últimos 12 meses</SelectItem>
          </SelectContent>
        </Select>
        {canSeeTeams && teamOptions.length > 0 && (
          <Select value={teamId ?? "all"} onValueChange={(v) => setTeamId(v === "all" ? null : v)}>
            <SelectTrigger className="h-9 w-full sm:w-52 rounded-xl text-xs font-bold"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isOfficeAdmin ? "Todo o escritório" : "Minhas equipes"}</SelectItem>
              {teamOptions.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {isOfficeAdmin && (
          <Button variant="outline" size="sm" onClick={() => setConfigOpen(true)}
            className="h-9 rounded-xl gap-1.5 text-xs font-bold w-full sm:w-auto sm:ml-auto">
            <Settings2 className="h-3.5 w-3.5" /> Configurar pontuação
          </Button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiMini icon={FileText} label="Processos ativos" value={d.totals.processos} color="text-blue-500" bg="bg-blue-500/10"
          trend={pctDelta(d.processosPorMes, "novos")} sub="novos vs. mês anterior" />
        <KpiMini icon={Users} label="Clientes ativos" value={d.totals.clientes} color="text-emerald-500" bg="bg-emerald-500/10"
          trend={pctDelta(d.novosClientesPorMes, "novos")} sub="novos vs. mês anterior" />
        <KpiMini icon={MessageSquare} label="Atendimentos" value={d.totals.atendimentos} color="text-rose-500" bg="bg-rose-500/10"
          trend={pctDelta(d.atendimentosPorMes, "total")} sub="vs. mês anterior" />
        <KpiMini icon={saldo >= 0 ? TrendingUp : TrendingDown} label="Saldo do período" value={brl(saldo)} color={saldo >= 0 ? "text-emerald-500" : "text-rose-500"} bg={saldo >= 0 ? "bg-emerald-500/10" : "bg-rose-500/10"}
          trend={pctDelta(d.financeiroPorMes, "receita")} sub="receita vs. mês anterior" />
      </div>

      <Tabs defaultValue="processos" className="w-full">
        <TabsList className="flex w-full overflow-x-auto rounded-xl gap-1 p-1 justify-start sm:flex-wrap">
          <TabsTrigger value="processos" className="rounded-lg text-xs font-bold shrink-0 sm:flex-1 sm:min-w-[90px]">Processos</TabsTrigger>
          <TabsTrigger value="prazos" className="rounded-lg text-xs font-bold shrink-0 sm:flex-1 sm:min-w-[90px]">Prazos</TabsTrigger>
          <TabsTrigger value="tarefas" className="rounded-lg text-xs font-bold shrink-0 sm:flex-1 sm:min-w-[90px]">Tarefas</TabsTrigger>
          <TabsTrigger value="audiencias" className="rounded-lg text-xs font-bold shrink-0 sm:flex-1 sm:min-w-[90px]">Audiências</TabsTrigger>
          <TabsTrigger value="atendimentos" className="rounded-lg text-xs font-bold shrink-0 sm:flex-1 sm:min-w-[90px]">Atendimentos</TabsTrigger>
          <TabsTrigger value="consultivo" className="rounded-lg text-xs font-bold shrink-0 sm:flex-1 sm:min-w-[90px]">Consultivo</TabsTrigger>
          <TabsTrigger value="clientes" className="rounded-lg text-xs font-bold shrink-0 sm:flex-1 sm:min-w-[90px]">Clientes</TabsTrigger>
          <TabsTrigger value="timesheet" className="rounded-lg text-xs font-bold shrink-0 sm:flex-1 sm:min-w-[90px]">Timesheet</TabsTrigger>
          {canSeeFinanceiro && <TabsTrigger value="financeiro" className="rounded-lg text-xs font-bold shrink-0 sm:flex-1 sm:min-w-[90px]">Financeiro</TabsTrigger>}
          {canSeeTeams && <TabsTrigger value="membros" className="rounded-lg text-xs font-bold shrink-0 sm:flex-1 sm:min-w-[90px]">Por Membro</TabsTrigger>}
        </TabsList>

        {/* PROCESSOS */}
        <TabsContent value="processos" className="space-y-4 mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <ChartCard title="Processos por mês" empty={d.processosPorMes.every(x => !x.novos && !x.encerrados)}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={d.processosPorMes}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" fontSize={11} /><YAxis fontSize={11} allowDecimals={false} />
                  <Tooltip {...tooltipStyle} /><Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="novos" fill="#6366f1" name="Novos" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="encerrados" fill="#10b981" name="Encerrados" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Status dos processos" empty={d.statusProcessos.length === 0}>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={d.statusProcessos} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2} dataKey="value" nameKey="name" label={(e: any) => `${e.name}: ${e.value}`} labelLine={false} fontSize={11}>
                    {d.statusProcessos.map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Pie>
                  <Tooltip {...tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
          <ChartCard title="Processos por área de atuação" empty={d.processosPorArea.length === 0}>
            <ResponsiveContainer width="100%" height={Math.max(240, d.processosPorArea.length * 40)}>
              <BarChart data={d.processosPorArea} layout="vertical" margin={{ left: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" fontSize={11} allowDecimals={false} />
                <YAxis type="category" dataKey="name" fontSize={11} width={120} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="value" name="Processos" radius={[0, 4, 4, 0]}>
                  {d.processosPorArea.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </TabsContent>

        {/* PRAZOS */}
        <TabsContent value="prazos" className="space-y-4 mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <ChartCard title="Prazos por mês" empty={d.prazosPorMes.every(x => !x.novos && !x.cumpridos)}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={d.prazosPorMes}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" fontSize={11} /><YAxis fontSize={11} allowDecimals={false} />
                  <Tooltip {...tooltipStyle} /><Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="novos" fill="#f59e0b" name="Novos" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="cumpridos" fill="#10b981" name="Cumpridos" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Prazos por status" empty={d.prazosPorStatus.length === 0}>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={d.prazosPorStatus} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2} dataKey="value" nameKey="name" label={(e: any) => `${e.name}: ${e.value}`} labelLine={false} fontSize={11}>
                    {d.prazosPorStatus.map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Pie>
                  <Tooltip {...tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </TabsContent>

        {/* TAREFAS */}
        <TabsContent value="tarefas" className="space-y-4 mt-4">
          <ChartCard title="Tarefas por mês (criadas x concluídas)" empty={d.tarefasPorMes.every(x => !x.criadas && !x.concluidas)}>
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={d.tarefasPorMes}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" fontSize={11} /><YAxis fontSize={11} allowDecimals={false} />
                <Tooltip {...tooltipStyle} /><Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="criadas" fill="#8b5cf6" name="Criadas" radius={[4, 4, 0, 0]} />
                <Bar dataKey="concluidas" fill="#10b981" name="Concluídas" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </TabsContent>

        {/* AUDIÊNCIAS */}
        <TabsContent value="audiencias" className="space-y-4 mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <ChartCard title="Audiências por mês" empty={d.audienciasPorMes.every(x => !x.total)}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={d.audienciasPorMes}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" fontSize={11} /><YAxis fontSize={11} allowDecimals={false} />
                  <Tooltip {...tooltipStyle} />
                  <Bar dataKey="total" fill="#06b6d4" name="Audiências" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Audiências por status" empty={d.audienciasPorStatus.length === 0}>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={d.audienciasPorStatus} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2} dataKey="value" nameKey="name" label={(e: any) => `${e.name}: ${e.value}`} labelLine={false} fontSize={11}>
                    {d.audienciasPorStatus.map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Pie>
                  <Tooltip {...tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </TabsContent>

        {/* CONSULTIVO */}
        <TabsContent value="consultivo" className="space-y-4 mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <ChartCard title="Consultivos por mês" empty={d.consultivoPorMes.every(x => !x.total)}>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={d.consultivoPorMes}>
                  <defs>
                    <linearGradient id="cons" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" fontSize={11} /><YAxis fontSize={11} allowDecimals={false} />
                  <Tooltip {...tooltipStyle} />
                  <Area type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={2} fill="url(#cons)" name="Consultivos" />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Consultivos por status" empty={d.consultivoPorStatus.length === 0}>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={d.consultivoPorStatus} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2} dataKey="value" nameKey="name" label={(e: any) => `${e.name}: ${e.value}`} labelLine={false} fontSize={11}>
                    {d.consultivoPorStatus.map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Pie>
                  <Tooltip {...tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </TabsContent>

        {/* TIMESHEET */}
        <TabsContent value="timesheet" className="space-y-4 mt-4">
          <ChartCard title="Horas registradas por mês" empty={d.timesheetPorMes.every(x => !x.horas)}>
            <ResponsiveContainer width="100%" height={340}>
              <AreaChart data={d.timesheetPorMes}>
                <defs>
                  <linearGradient id="ts" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ec4899" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" fontSize={11} /><YAxis fontSize={11} tickFormatter={(v) => `${v}h`} />
                <Tooltip {...tooltipStyle} formatter={(v: any) => `${v}h`} />
                <Area type="monotone" dataKey="horas" stroke="#ec4899" strokeWidth={2} fill="url(#ts)" name="Horas" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </TabsContent>

        {/* CLIENTES */}
        <TabsContent value="clientes" className="space-y-4 mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <ChartCard title="Tipos de cliente" empty={d.clientesPorTipo.length === 0}>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={d.clientesPorTipo} cx="50%" cy="50%" outerRadius={90} dataKey="value" nameKey="name" label={(e: any) => `${e.name}: ${e.value}`} labelLine={false} fontSize={11}>
                    {d.clientesPorTipo.map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Pie>
                  <Tooltip {...tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Novos clientes por mês" empty={d.novosClientesPorMes.every(x => !x.novos)}>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={d.novosClientesPorMes}>
                  <defs>
                    <linearGradient id="cli" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" fontSize={11} /><YAxis fontSize={11} allowDecimals={false} />
                  <Tooltip {...tooltipStyle} />
                  <Area type="monotone" dataKey="novos" stroke="#10b981" strokeWidth={2} fill="url(#cli)" name="Novos clientes" />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </TabsContent>

        {/* ATENDIMENTOS */}
        <TabsContent value="atendimentos" className="space-y-4 mt-4">
          <ChartCard title="Atendimentos por mês" empty={d.atendimentosPorMes.every(x => !x.total)}>
            <ResponsiveContainer width="100%" height={360}>
              <BarChart data={d.atendimentosPorMes}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" fontSize={11} /><YAxis fontSize={11} allowDecimals={false} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="total" fill="#f43f5e" name="Atendimentos" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </TabsContent>

        {/* FINANCEIRO */}
        {canSeeFinanceiro && (
        <TabsContent value="financeiro" className="space-y-4 mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <ChartCard title="Receita x Despesa por mês" empty={d.financeiroPorMes.every(x => !x.receita && !x.despesa)}>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={d.financeiroPorMes}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" fontSize={11} /><YAxis fontSize={11} tickFormatter={(v) => `${(v / 1000)}k`} />
                  <Tooltip {...tooltipStyle} formatter={(v: any) => brl(Number(v))} /><Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="receita" stroke="#10b981" strokeWidth={2.5} name="Receita" dot={false} />
                  <Line type="monotone" dataKey="despesa" stroke="#ef4444" strokeWidth={2.5} name="Despesa" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Receita por categoria" empty={d.honorariosPorCategoria.length === 0}>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={d.honorariosPorCategoria} cx="50%" cy="50%" outerRadius={90} dataKey="value" nameKey="name" label={(e: any) => e.name} labelLine={false} fontSize={11}>
                    {d.honorariosPorCategoria.map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Pie>
                  <Tooltip {...tooltipStyle} formatter={(v: any) => brl(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </TabsContent>
        )}

        {/* POR MEMBRO */}
        {canSeeTeams && (
          <TabsContent value="membros" className="space-y-4 mt-4">
            {/* Ranking de produtividade por pontos */}
            <Card className="rounded-2xl border-black/5 dark:border-border overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-black flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-amber-500" /> Ranking de Produtividade
                </CardTitle>
                <p className="text-[11px] text-muted-foreground">
                  Pontos: tarefa {d.pontosConfig.tarefa} · processo {d.pontosConfig.processo} · prazo/audiência por tipo · atraso −{d.pontosConfig.penalidadeAtraso}
                </p>
              </CardHeader>
              <CardContent>
                {ranking.length === 0 ? (
                  <div className="h-32 flex flex-col items-center justify-center gap-2 text-center">
                    <Trophy className="h-10 w-10 text-muted-foreground/20" />
                    <p className="text-sm text-muted-foreground">Nenhuma finalização registrada ainda.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {ranking.map((m, i) => {
                      const max = ranking[0].pontos || 1;
                      const medal = ["bg-amber-400/20 text-amber-600", "bg-slate-300/30 text-slate-500", "bg-orange-700/20 text-orange-700"][i];
                      return (
                        <div key={m.name + i} className="flex items-center gap-3">
                          <div className={cn("h-8 w-8 rounded-xl flex items-center justify-center text-xs font-black shrink-0", medal || "bg-muted text-muted-foreground")}>
                            {i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-baseline gap-2">
                              <span className="text-sm font-bold truncate">{m.name}</span>
                              <span className="text-sm font-black text-primary shrink-0">{m.pontos} pts</span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden mt-1">
                              <div className="h-full bg-gradient-to-r from-primary/60 to-primary rounded-full transition-all" style={{ width: `${Math.round((m.pontos / max) * 100)}%` }} />
                            </div>
                            <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                              {m.tarefasConcluidas} tarefas · {m.prazosConcluidos} prazos · {m.audienciasRealizadas} audiências · {m.processosEncerrados} processos
                              {m.atrasos > 0 && <span className="text-rose-500 font-bold"> · {m.atrasos} em atraso</span>}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <ChartCard title="Carga de trabalho por membro" empty={d.porMembro.length === 0}>
              <ResponsiveContainer width="100%" height={Math.max(320, d.porMembro.length * 48)}>
                <BarChart data={d.porMembro} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" fontSize={11} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" fontSize={11} width={110} />
                  <Tooltip {...tooltipStyle} /><Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="processos" stackId="a" fill="#6366f1" name="Processos" />
                  <Bar dataKey="prazos" stackId="a" fill="#f59e0b" name="Prazos" />
                  <Bar dataKey="tarefas" stackId="a" fill="#8b5cf6" name="Tarefas" />
                  <Bar dataKey="audiencias" stackId="a" fill="#10b981" name="Audiências" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Taxa de conclusão de tarefas por membro */}
            <div className="grid gap-4 md:grid-cols-2">
              <ChartCard title="Taxa de conclusão de tarefas" empty={d.porMembro.every(m => m.tarefas === 0)}>
                <div className="space-y-3 py-2">
                  {d.porMembro.filter(m => m.tarefas > 0).map((m, i) => {
                    const pct = Math.round((m.tarefasConcluidas / m.tarefas) * 100);
                    return (
                      <div key={i} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-bold truncate">{m.name}</span>
                          <span className="text-muted-foreground">{m.tarefasConcluidas}/{m.tarefas} · {pct}%</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className={cn("h-full rounded-full transition-all", pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-rose-500")} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ChartCard>
              <ChartCard title="Distribuição de processos" empty={d.porMembro.every(m => m.processos === 0)}>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={d.porMembro.filter(m => m.processos > 0)} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2} dataKey="processos" nameKey="name" label={(e: any) => `${e.name}: ${e.processos}`} labelLine={false} fontSize={11}>
                      {d.porMembro.map((_, i) => <Cell key={i} fill={["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#8b5cf6", "#f97316"][i % 8]} />)}
                    </Pie>
                    <Tooltip {...tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          </TabsContent>
        )}
      </Tabs>

      {isOfficeAdmin && (
        <ChartsConfigDialog
          open={configOpen}
          onClose={() => setConfigOpen(false)}
          officeId={user?.office_id || ""}
          pontos={d.pontosConfig}
          tiposPrazo={d.tiposPrazo}
          tiposAudiencia={d.tiposAudiencia}
          onSaved={d.refetch}
        />
      )}
    </div>
  );
}
