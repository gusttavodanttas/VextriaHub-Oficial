import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Clock,
  Link2Off,
  Link2,
  FilePlus,
  Inbox,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SummaryCardProps {
  title: string;
  value: string | number;
  description: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  badge?: string;
  badgeStyle?: string;
  onClick?: () => void;
}

const SummaryCard = ({ title, value, description, icon: Icon, color, bg, badge, badgeStyle, onClick }: SummaryCardProps) => (
  <Card
    className={cn(
      "border-border/60 bg-card transition-all duration-300 shadow-sm rounded-2xl overflow-hidden relative group",
      onClick ? "cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98]" : ""
    )}
    onClick={onClick}
  >
    <div className={cn("absolute -right-4 -top-4 h-20 w-20 rounded-full opacity-[0.06] group-hover:opacity-10 transition-opacity", bg)} />
    <CardContent className="p-5 relative z-10">
      <div className="flex items-center justify-between mb-4">
        <div className={cn("p-2.5 rounded-xl", bg, "bg-opacity-10 dark:bg-opacity-20")}>
          <Icon className={cn("h-4 w-4", color)} />
        </div>
        {badge && (
          <span className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg border", badgeStyle)}>
            {badge}
          </span>
        )}
      </div>
      <div className="space-y-0.5">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/55">{title}</p>
        <h3 className="text-3xl font-black tracking-tighter text-foreground">{value}</h3>
        <p className="text-[11px] text-muted-foreground/50 font-medium leading-tight pt-0.5">{description}</p>
      </div>
    </CardContent>
  </Card>
);

interface PublicationSummaryProps {
  stats: {
    prazosSemana: number;
    naoTratadas: number;
    semVinculo: number;
    comVinculo?: number;
    novosAndamentos: number;
    total?: number;
    tratadas?: number;
  };
  loading?: boolean;
  onCardClick?: (type: 'prazos' | 'novas' | 'sem_vinculo' | 'com_vinculo' | 'hoje' | 'tratadas') => void;
}

export const PublicationSummary = ({ stats, loading, onCardClick }: PublicationSummaryProps) => {
  const pct = stats.total && stats.total > 0 && stats.tratadas != null
    ? Math.round((stats.tratadas / stats.total) * 100)
    : null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      <SummaryCard
        title="Urgentes"
        value={loading ? "…" : stats.prazosSemana}
        description="Alta prioridade detectada"
        icon={AlertTriangle}
        color="text-red-500"
        bg="bg-red-500"
        badge={stats.prazosSemana > 0 ? "Atenção" : undefined}
        badgeStyle="bg-red-500/10 text-red-600 border-red-500/20"
        onClick={() => onCardClick?.('prazos')}
      />
      <SummaryCard
        title="Novas"
        value={loading ? "…" : stats.naoTratadas}
        description="Aguardando tratamento"
        icon={Inbox}
        color="text-violet-600"
        bg="bg-violet-500"
        onClick={() => onCardClick?.('novas')}
      />
      <SummaryCard
        title="Tratadas"
        value={loading ? "…" : (stats.tratadas ?? '—')}
        description={pct != null ? `${pct}% do total tratado` : "Publicações processadas"}
        icon={CheckCircle}
        color="text-emerald-600"
        bg="bg-emerald-500"
        badge={pct != null ? `${pct}%` : undefined}
        badgeStyle="bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
        onClick={() => onCardClick?.('tratadas')}
      />
      <SummaryCard
        title="Sem Vínculo"
        value={loading ? "…" : stats.semVinculo}
        description="Sem processo associado"
        icon={Link2Off}
        color="text-orange-500"
        bg="bg-orange-500"
        onClick={() => onCardClick?.('sem_vinculo')}
      />
      <SummaryCard
        title="Vinculadas"
        value={loading ? "…" : (stats.comVinculo ?? '—')}
        description="Com processo associado"
        icon={Link2}
        color="text-blue-600"
        bg="bg-blue-500"
        onClick={() => onCardClick?.('com_vinculo')}
      />
      <SummaryCard
        title="Publicadas Hoje"
        value={loading ? "…" : stats.novosAndamentos}
        description="Capturas do diário oficial"
        icon={FilePlus}
        color="text-sky-600"
        bg="bg-sky-500"
        onClick={() => onCardClick?.('hoje')}
      />
    </div>
  );
};
