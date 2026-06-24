
import { useStats } from "@/hooks/useStats";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  Users,
  FileText,
  Calendar,
  Clock,
  TrendingUp,
  Plus,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const getWeekRange = () => {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  return `${fmt(start)} – ${fmt(end)}`;
};

interface QuickStatProps {
  icon: React.ElementType;
  label: string;
  value: number | string;
  sub?: string;
  color: string;
  bgColor: string;
  onClick?: () => void;
  urgent?: boolean;
}

function QuickStat({ icon: Icon, label, value, sub, color, bgColor, onClick, urgent }: QuickStatProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative flex items-center gap-4 px-5 py-4 rounded-2xl border transition-all duration-300",
        "bg-card/40 backdrop-blur-xl border-black/5 dark:border-white/5 hover:border-black/10 dark:hover:border-white/15",
        "hover:shadow-lg hover:-translate-y-0.5 text-left w-full",
        urgent && "border-red-500/20 hover:border-red-500/30"
      )}
    >
      {urgent && (
        <span className="absolute top-2 right-2 flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
        </span>
      )}
      <div className={cn("p-2.5 rounded-xl shrink-0 transition-transform duration-300 group-hover:scale-110", bgColor)}>
        <Icon className={cn("h-5 w-5", color)} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{label}</p>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-black tracking-tight">{value}</span>
          {sub && <span className="text-[10px] text-muted-foreground font-bold hidden sm:block opacity-40">{sub}</span>}
        </div>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground/30 ml-auto shrink-0 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all" />
    </button>
  );
}

export function QuickStatsBar() {
  const { stats, loading } = useStats();
  const navigate = useNavigate();
  const weekRange = getWeekRange();

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-20 rounded-2xl bg-black/[0.03] dark:bg-card/20 animate-pulse border border-black/5 dark:border-white/5" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Barra de ações rápidas */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black tracking-tight">Painel de Controle</h2>
          <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest opacity-40">{weekRange}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl text-[10px] font-black uppercase tracking-widest border-black/5 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 gap-1.5 h-10 px-4"
            onClick={() => navigate("/prazos")}
          >
            <Plus className="h-3.5 w-3.5" /> Novo Prazo
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl text-[10px] font-black uppercase tracking-widest border-black/5 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 gap-1.5 h-10 px-4"
            onClick={() => navigate("/tarefas")}
          >
            <Plus className="h-3.5 w-3.5" /> Nova Tarefa
          </Button>
          <Button
            size="sm"
            className="rounded-xl text-[10px] font-black uppercase tracking-widest gap-1.5 h-10 px-6 shadow-premium shadow-primary/20"
            onClick={() => navigate("/agenda")}
          >
            <Calendar className="h-3.5 w-3.5" /> Agenda Completa
          </Button>
        </div>
      </div>

      {/* Grid de stats rápidos */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <QuickStat
          icon={AlertCircle}
          label="Prazos da Semana"
          value={stats.prazosVencendo}
          sub={weekRange}
          color="text-rose-500"
          bgColor="bg-rose-500/10"
          onClick={() => navigate("/prazos")}
          urgent={stats.prazosVencendo > 0}
        />
        <QuickStat
          icon={Calendar}
          label="Próximas Audiências"
          value={stats.audienciasProximas}
          sub={weekRange}
          color="text-orange-500"
          bgColor="bg-orange-500/10"
          onClick={() => navigate("/agenda")}
        />
        <QuickStat
          icon={FileText}
          label="Processos Ativos"
          value={stats.processosAtivos}
          sub="em andamento"
          color="text-blue-500"
          bgColor="bg-blue-500/10"
          onClick={() => navigate("/processos")}
        />
        <QuickStat
          icon={Clock}
          label="Tarefas Pendentes"
          value={stats.tarefasPendentes}
          sub="para hoje"
          color="text-purple-500"
          bgColor="bg-purple-500/10"
          onClick={() => navigate("/tarefas")}
          urgent={stats.tarefasPendentes > 5}
        />
        <QuickStat
          icon={Users}
          label="Clientes Ativos"
          value={stats.clientes}
          sub="cadastrados"
          color="text-emerald-500"
          bgColor="bg-emerald-500/10"
          onClick={() => navigate("/clientes")}
        />
      </div>
    </div>
  );
}
