// Cards de resumo do mês (extraídos de pages/Financeiro.tsx).
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, TrendingUp, TrendingDown, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmt } from "./shared";
import type { FinanceiroStatsValores } from "./calculos";

interface Props { stats: FinanceiroStatsValores; loading: boolean }

export function FinanceiroStats({ stats, loading }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {([
        { label: "Receita do Mês", value: stats.receitaMes, Icon: TrendingUp, colorClass: "bg-emerald-500/10 text-emerald-500" },
        { label: "A Receber",      value: stats.aReceber,   Icon: CreditCard,  colorClass: "bg-primary/10 text-primary" },
        { label: "A Pagar",        value: stats.aPagar,     Icon: TrendingDown, colorClass: "bg-orange-500/10 text-orange-500" },
        { label: "Saldo do Mês",   value: stats.saldo,      Icon: DollarSign,  colorClass: "bg-primary/10 text-primary" },
      ] as const).map(({ label, value, Icon, colorClass }) => (
        <div key={label} className="glass-card p-6 rounded-3xl shadow-premium border border-black/5 dark:border-border bg-card/40 hover-lift group">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{label}</p>
            <div className={cn("p-2 rounded-xl", colorClass)}>
              <Icon className="h-5 w-5" />
            </div>
          </div>
          {loading
            ? <Skeleton className="h-8 w-28 rounded-xl" />
            : <p className={cn("text-3xl font-black tracking-tighter", value < 0 ? "text-red-500" : "text-foreground")}>{fmt(value)}</p>
          }
        </div>
      ))}
    </div>
  );
}
