
import { FileText, Users, Clock, TrendingUp, DollarSign, Wallet, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useStats } from "@/hooks/useStats";
import { cn } from "@/lib/utils";

const formatCurrency = (value: number) => {
  if (value >= 1000) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
  }
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

interface StatCardProps {
  title: string;
  value: string | number;
  description: string;
  subStats?: { label: string; value: string | number }[];
  icon: React.ElementType;
  gradient: string;
  iconColor: string;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
}

function StatCard({ title, value, description, subStats, icon: Icon, gradient, iconColor, trend, trendLabel }: StatCardProps) {
  const TrendIcon = trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : Minus;
  const trendColor = trend === "up" ? "text-emerald-500" : trend === "down" ? "text-red-500" : "text-muted-foreground";

  return (
    <Card className="relative overflow-hidden group hover:shadow-2xl transition-all duration-500 border-black/5 dark:border-white/5 bg-card/40 backdrop-blur-xl rounded-3xl hover-lift cursor-default">
      {/* Gradient background on hover */}
      <div className={cn("absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-500", gradient)} />

      <CardContent className="p-5 relative z-10">
        <div className="flex flex-col gap-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className={cn("p-2 rounded-xl w-fit bg-black/[0.03] dark:bg-background/60 backdrop-blur-sm border border-black/5 dark:border-white/10 group-hover:scale-110 transition-transform duration-500 shadow-sm", iconColor)}>
              <Icon className="h-4 w-4" />
            </div>
            {trend && trendLabel && (
              <div className={cn("flex items-center gap-0.5 text-[10px] font-bold", trendColor)}>
                <TrendIcon className="h-3 w-3" />
                <span>{trendLabel}</span>
              </div>
            )}
          </div>

          {/* Main value */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-70 group-hover:opacity-100 transition-opacity mb-1">
              {title}
            </p>
            <div className="text-2xl md:text-3xl font-black tracking-tight group-hover:translate-x-0.5 transition-transform duration-500">
              {value}
            </div>
            <p className="text-[10px] font-medium text-muted-foreground opacity-60 group-hover:opacity-90 mt-0.5">
              {description}
            </p>
          </div>

          {/* Sub-stats like eLaw */}
          {subStats && subStats.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-black/5 dark:border-white/5">
              {subStats.map((s, i) => (
                <div key={i} className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground/60">{s.label}:</span>
                  <span className="text-[11px] font-bold">{s.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>

      {/* Decorative glow */}
      <div className={cn("absolute -bottom-4 -right-4 w-20 h-20 blur-3xl opacity-0 group-hover:opacity-30 transition-opacity duration-700 rounded-full", gradient)} />
    </Card>
  );
}

export function StatsCards() {
  const { stats, loading } = useStats();

  const saldo = stats.receitaMensal - stats.despesaMensal;
  const saldoTrend = saldo > 0 ? "up" : saldo < 0 ? "down" : "neutral";

  if (loading) {
    return (
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-36 rounded-3xl bg-black/[0.03] dark:bg-card/20 animate-pulse border border-black/5 dark:border-white/5" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
      <StatCard
        title="Processos Ativos"
        value={stats.processosAtivos}
        description="Em andamento"
        subStats={[
          { label: "Clientes", value: stats.clientes },
          { label: "Equipe", value: stats.colaboradores },
        ]}
        icon={FileText}
        gradient="from-orange-500/20 to-orange-500/5"
        iconColor="text-orange-500"
        trend="neutral"
        trendLabel="estável"
      />
      <StatCard
        title="Audiências"
        value={stats.audienciasProximas}
        description="Próximos 7 dias"
        icon={Users}
        gradient="from-blue-500/20 to-blue-500/5"
        iconColor="text-blue-500"
      />
      <StatCard
        title="Prazos Urgentes"
        value={stats.prazosVencendo}
        description="Próximos 3 dias"
        icon={Clock}
        gradient="from-rose-500/20 to-rose-500/5"
        iconColor="text-rose-500"
        trend={stats.prazosVencendo > 0 ? "down" : "neutral"}
        trendLabel={stats.prazosVencendo > 0 ? "atenção" : "ok"}
      />
      <StatCard
        title="Faturamento"
        value={formatCurrency(stats.receitaMensal)}
        description="Receita bruta do mês"
        icon={TrendingUp}
        gradient="from-emerald-500/20 to-emerald-500/5"
        iconColor="text-emerald-500"
        trend="up"
        trendLabel="mês atual"
      />
      <StatCard
        title="Despesas"
        value={formatCurrency(stats.despesaMensal)}
        description="Custos do mês"
        icon={DollarSign}
        gradient="from-amber-500/20 to-amber-500/5"
        iconColor="text-amber-500"
      />
      <StatCard
        title="Saldo Líquido"
        value={formatCurrency(saldo)}
        description="Resultado do período"
        icon={Wallet}
        gradient={saldo >= 0 ? "from-cyan-500/20 to-cyan-500/5" : "from-red-500/20 to-red-500/5"}
        iconColor={saldo >= 0 ? "text-cyan-500" : "text-red-500"}
        trend={saldoTrend}
        trendLabel={saldo >= 0 ? "positivo" : "negativo"}
      />
    </div>
  );
}
