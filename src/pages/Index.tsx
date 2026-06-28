import { CalendarWidget } from "@/components/Dashboard/CalendarWidget";
import { DashboardHero } from "@/components/Dashboard/DashboardHero";
import { QuickViewSheet, SheetView } from "@/components/Dashboard/QuickViewSheet";
import { Button } from "@/components/ui/button";
import { AlertCircle, FileText, CheckSquare, TrendingUp, ArrowRight, Plus, CalendarCheck, UserCheck, Users2, CalendarPlus, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
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
        "group relative flex flex-col gap-3 p-4 rounded-2xl border transition-all duration-200 text-left w-full overflow-hidden",
        "bg-card/40 hover:bg-card/70 hover:shadow-lg hover:-translate-y-0.5",
        urgent
          ? "border-rose-500/25 hover:border-rose-500/40"
          : "border-black/5 dark:border-border hover:border-black/10 dark:hover:border-white/15"
      )}
    >
      {/* brilho de fundo no hover */}
      <div className={cn("absolute -right-6 -top-6 h-20 w-20 rounded-full blur-2xl opacity-0 group-hover:opacity-60 transition-opacity duration-300", bg)} />

      <div className="flex items-center justify-between">
        <div className={cn("p-2 rounded-xl shrink-0 transition-transform duration-200 group-hover:scale-110", bg)}>
          {loading
            ? <div className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin opacity-50" />
            : <Icon className={cn("h-4 w-4", color)} />
          }
        </div>
        {urgent ? (
          <span className="flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-rose-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
          </span>
        ) : (
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/20 group-hover:text-muted-foreground/50 group-hover:translate-x-0.5 transition-all" />
        )}
      </div>

      <div className="min-w-0">
        {loading
          ? <div className="h-8 w-12 rounded-lg bg-black/[0.06] dark:bg-white/[0.06] animate-pulse mb-1" />
          : <p className="text-3xl font-black tracking-tight leading-none">{value}</p>
        }
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mt-1.5 leading-tight">{label}</p>
        {sub && <p className="text-[9px] text-muted-foreground/40 font-bold mt-0.5">{sub}</p>}
      </div>
    </button>
  );
}

const Index = () => {
  const { isSuperAdmin, isOfficeAdmin, validatePayment } = useAuth();
  const navigate = useNavigate();
  const { stats, loading: statsLoading } = useStats();
  const [sheetView, setSheetView] = useState<SheetView>(null);

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

  if (isSuperAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] gap-3">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        <p className="text-muted-foreground text-sm">Redirecionando para Administração…</p>
      </div>
    );
  }

  const hasFinanceiro = stats.receitaMensal > 0 || stats.despesaMensal > 0;
  const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

  return (
    <div className="flex-1 p-4 md:p-6 space-y-5 overflow-x-hidden">

      {/* Saudação */}
      <DashboardHero />

      {/* KPIs clicáveis */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 shrink-0">Painel de Controle</p>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" variant="outline"
              className="rounded-xl h-8 px-3 text-[10px] font-black uppercase tracking-widest border-black/5 dark:border-border gap-1"
              onClick={() => navigate("/prazos")}
            >
              <Plus className="h-3 w-3" /> <span className="hidden sm:inline">Prazo</span>
            </Button>
            <Button size="sm"
              className="rounded-xl h-8 px-3 sm:px-4 text-[10px] font-black uppercase tracking-widest gap-1 shadow-sm"
              onClick={() => navigate("/processos")}
            >
              <FileText className="h-3 w-3" /> <span className="hidden sm:inline">Novo Processo</span><span className="sm:hidden">Processo</span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <KpiCard icon={AlertCircle} label="Prazos urgentes" value={stats.prazosVencendo}
            sub="próx. 3 dias" color="text-rose-500" bg="bg-rose-500/10"
            onClick={() => setSheetView("prazos")} urgent={stats.prazosVencendo > 0} loading={statsLoading} />
          <KpiCard icon={CalendarCheck} label="Audiências" value={stats.audienciasProximas}
            sub="próx. 7 dias" color="text-orange-500" bg="bg-orange-500/10"
            onClick={() => setSheetView("audiencias")} loading={statsLoading} />
          <KpiCard icon={FileText} label="Processos ativos" value={stats.processosAtivos}
            sub="em andamento" color="text-blue-500" bg="bg-blue-500/10"
            onClick={() => setSheetView("processos")} loading={statsLoading} />
          <KpiCard icon={CheckSquare} label="Tarefas abertas" value={stats.tarefasPendentes}
            sub="pendentes" color="text-purple-500" bg="bg-purple-500/10"
            onClick={() => setSheetView("tarefas")} urgent={stats.tarefasPendentes > 5} loading={statsLoading} />
          <KpiCard icon={UserCheck} label="Clientes ativos" value={stats.clientes}
            sub="cadastrados" color="text-emerald-500" bg="bg-emerald-500/10"
            onClick={() => setSheetView("clientes")} loading={statsLoading} />
          {isOfficeAdmin && (
            <KpiCard icon={Users2} label="Equipe" value={stats.colaboradores}
              sub="colaboradores" color="text-sky-500" bg="bg-sky-500/10"
              onClick={() => navigate("/equipe")} loading={statsLoading} />
          )}
        </div>
      </section>

      {/* Conteúdo principal — Agenda em destaque + lateral */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">

        {/* Agenda / Calendário */}
        <div className="lg:col-span-8 rounded-2xl border border-black/5 dark:border-border bg-card/40 shadow-sm overflow-hidden">
          <CalendarWidget />
        </div>

        {/* Lateral — financeiro (se houver) + ações rápidas */}
        <div className="lg:col-span-4 space-y-4">

          {hasFinanceiro && (
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
                  <p className="text-base font-black text-emerald-500">{brl(stats.receitaMensal)}</p>
                </div>
                <div>
                  <p className="text-[9px] text-muted-foreground/50 font-bold uppercase tracking-widest mb-0.5">Despesas</p>
                  <p className="text-base font-black text-rose-500">{brl(stats.despesaMensal)}</p>
                </div>
              </div>
              <div className="pt-2 border-t border-black/5 dark:border-border">
                <p className="text-[9px] text-muted-foreground/50 font-bold uppercase tracking-widest mb-0.5">Saldo líquido</p>
                <p className={cn("text-xl font-black", stats.receitaMensal - stats.despesaMensal >= 0 ? "text-emerald-500" : "text-rose-500")}>
                  {brl(stats.receitaMensal - stats.despesaMensal)}
                </p>
              </div>
            </div>
          )}

          {/* Ações rápidas */}
          <div className="rounded-2xl border border-black/5 dark:border-border bg-card/40 p-4 space-y-3">
            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">Ações Rápidas</p>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { icon: FileText, label: "Novo processo", to: "/processos", color: "text-blue-500", bg: "bg-blue-500/10" },
                { icon: Plus, label: "Novo prazo", to: "/prazos", color: "text-rose-500", bg: "bg-rose-500/10" },
                { icon: CalendarPlus, label: "Agendar", to: "/agenda", color: "text-orange-500", bg: "bg-orange-500/10" },
                { icon: UserPlus, label: "Novo cliente", to: "/clientes", color: "text-emerald-500", bg: "bg-emerald-500/10" },
              ].map((a) => (
                <button key={a.label}
                  onClick={() => navigate(a.to)}
                  className="group flex flex-col items-start gap-2 p-3 rounded-xl border border-black/5 dark:border-border bg-card/40 hover:bg-card/80 hover:shadow-sm hover:-translate-y-0.5 transition-all text-left"
                >
                  <div className={cn("p-1.5 rounded-lg transition-transform group-hover:scale-110", a.bg)}>
                    <a.icon className={cn("h-4 w-4", a.color)} />
                  </div>
                  <span className="text-xs font-bold leading-tight">{a.label}</span>
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>

      <QuickViewSheet view={sheetView} onClose={() => setSheetView(null)} />
    </div>
  );
};

export default Index;
