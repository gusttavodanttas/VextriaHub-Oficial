import { PriorityTasks } from "@/components/Dashboard/PriorityTasks";
import { DeadlinesCard } from "@/components/Dashboard/DeadlinesCard";
import { HearingsCard } from "@/components/Dashboard/HearingsCard";
import { CalendarWidget } from "@/components/Dashboard/CalendarWidget";
import { DashboardHero } from "@/components/Dashboard/DashboardHero";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Clock, AlertCircle, FileText, Users, CheckSquare, TrendingUp, ArrowRight, Plus } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useStats } from "@/hooks/useStats";
import { cn } from "@/lib/utils";

interface KpiProps {
  icon: React.ElementType;
  label: string;
  value: number | string;
  sub?: string;
  color: string;
  bg: string;
  onClick: () => void;
  urgent?: boolean;
  loading?: boolean;
}

function KpiCard({ icon: Icon, label, value, sub, color, bg, onClick, urgent, loading }: KpiProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative flex items-center gap-3 px-4 py-3.5 rounded-2xl border transition-all duration-200 text-left w-full",
        "bg-card/50 hover:shadow-lg hover:-translate-y-px",
        urgent
          ? "border-rose-500/20 hover:border-rose-500/40"
          : "border-black/5 dark:border-border hover:border-black/10 dark:hover:border-white/15"
      )}
    >
      {urgent && (
        <span className="absolute top-2 right-2 flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
        </span>
      )}
      <div className={cn("p-2 rounded-xl shrink-0 transition-transform duration-200 group-hover:scale-110", bg)}>
        {loading
          ? <div className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin opacity-50" />
          : <Icon className={cn("h-4 w-4", color)} />
        }
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 leading-none mb-1">{label}</p>
        <div className="flex items-baseline gap-1.5">
          {loading
            ? <div className="h-6 w-10 rounded-lg bg-black/[0.06] dark:bg-white/[0.06] animate-pulse" />
            : <span className="text-xl font-black tracking-tight">{value}</span>
          }
          {sub && !loading && <span className="text-[9px] text-muted-foreground/40 font-bold hidden sm:block">{sub}</span>}
        </div>
      </div>
      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/20 shrink-0 group-hover:text-muted-foreground/50 group-hover:translate-x-0.5 transition-all" />
    </button>
  );
}

const Index = () => {
  const { isSuperAdmin, validatePayment } = useAuth();
  const navigate = useNavigate();
  const { stats, loading: statsLoading } = useStats();
  const [trialDays, setTrialDays] = useState<number | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get('success')) {
      setTimeout(() => validatePayment(), 1000);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [validatePayment]);

  useEffect(() => {
    if (isSuperAdmin) navigate('/admin', { replace: true });
  }, [isSuperAdmin, navigate]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data?.user) return;
      const created = new Date(data.user.created_at);
      const end = new Date(created);
      end.setDate(end.getDate() + 7);
      const days = Math.ceil((end.getTime() - Date.now()) / 86400000);
      if (days > 0) setTrialDays(days);
    });
  }, []);

  if (isSuperAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] gap-3">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        <p className="text-muted-foreground text-sm">Redirecionando para Administração…</p>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 md:p-6 space-y-5 overflow-x-hidden">

      {/* Saudação */}
      <DashboardHero />

      {/* Aviso trial */}
      {trialDays !== null && (
        <Alert className="bg-primary/5 border-primary/20 py-3 rounded-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent" />
          <Clock className="h-4 w-4 text-primary" />
          <AlertTitle className="font-bold text-sm">Período de Teste</AlertTitle>
          <AlertDescription className="text-muted-foreground text-xs">
            <span className="font-bold text-primary">{trialDays} dia{trialDays > 1 ? 's' : ''}</span> restante{trialDays > 1 ? 's' : ''} no período premium.
          </AlertDescription>
        </Alert>
      )}

      {/* KPIs clicáveis */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40">Painel de Controle</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline"
              className="rounded-xl h-8 px-3 text-[10px] font-black uppercase tracking-widest border-black/5 dark:border-border gap-1"
              onClick={() => navigate("/prazos")}
            >
              <Plus className="h-3 w-3" /> Prazo
            </Button>
            <Button size="sm"
              className="rounded-xl h-8 px-4 text-[10px] font-black uppercase tracking-widest gap-1 shadow-sm"
              onClick={() => navigate("/processos")}
            >
              <FileText className="h-3 w-3" /> Novo Processo
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          <KpiCard icon={AlertCircle} label="Prazos urgentes" value={stats.prazosVencendo}
            sub="próx. 3 dias" color="text-rose-500" bg="bg-rose-500/10"
            onClick={() => navigate("/prazos")} urgent={stats.prazosVencendo > 0} loading={statsLoading} />
          <KpiCard icon={Users} label="Audiências" value={stats.audienciasProximas}
            sub="próx. 7 dias" color="text-orange-500" bg="bg-orange-500/10"
            onClick={() => navigate("/agenda")} loading={statsLoading} />
          <KpiCard icon={FileText} label="Processos ativos" value={stats.processosAtivos}
            sub="em andamento" color="text-blue-500" bg="bg-blue-500/10"
            onClick={() => navigate("/processos")} loading={statsLoading} />
          <KpiCard icon={CheckSquare} label="Tarefas pendentes" value={stats.tarefasPendentes}
            sub="abertas" color="text-purple-500" bg="bg-purple-500/10"
            onClick={() => navigate("/tarefas")} urgent={stats.tarefasPendentes > 5} loading={statsLoading} />
          <KpiCard icon={Users} label="Clientes ativos" value={stats.clientes}
            sub="cadastrados" color="text-emerald-500" bg="bg-emerald-500/10"
            onClick={() => navigate("/clientes")} loading={statsLoading} />
        </div>
      </section>

      {/* Grid principal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* Coluna operacional */}
        <div className="lg:col-span-8 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DeadlinesCard />
            <HearingsCard />
          </div>
          <PriorityTasks />
        </div>

        {/* Coluna lateral */}
        <div className="lg:col-span-4">
          <div className="sticky top-24 space-y-4">

            <div className="rounded-[2rem] overflow-hidden border border-black/5 dark:border-border bg-card/40 shadow-sm">
              <CalendarWidget />
            </div>

            {/* Resumo financeiro — só aparece se tiver dados reais */}
            {(stats.receitaMensal > 0 || stats.despesaMensal > 0) && (
              <div
                className="rounded-2xl border border-black/5 dark:border-border bg-card/40 p-4 space-y-3 cursor-pointer hover:shadow-md transition-all"
                onClick={() => navigate("/financeiro")}
              >
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 flex items-center gap-1.5">
                  <TrendingUp className="h-3 w-3" /> Financeiro do Mês
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[9px] text-muted-foreground/50 font-bold uppercase tracking-widest mb-0.5">Receita</p>
                    <p className="text-base font-black text-emerald-500">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(stats.receitaMensal)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] text-muted-foreground/50 font-bold uppercase tracking-widest mb-0.5">Despesas</p>
                    <p className="text-base font-black text-rose-500">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(stats.despesaMensal)}
                    </p>
                  </div>
                </div>
                <div className="pt-2 border-t border-black/5 dark:border-border">
                  <p className="text-[9px] text-muted-foreground/50 font-bold uppercase tracking-widest mb-0.5">Saldo líquido</p>
                  <p className={cn(
                    "text-xl font-black",
                    stats.receitaMensal - stats.despesaMensal >= 0 ? "text-emerald-500" : "text-rose-500"
                  )}>
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(stats.receitaMensal - stats.despesaMensal)}
                  </p>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
