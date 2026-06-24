import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Clock, 
  AlertCircle, 
  Link2Off, 
  FilePlus,
  TrendingUp,
  Inbox
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface SummaryCardProps {
  title: string;
  value: string | number;
  description: string;
  icon: React.ElementType;
  color: string;
  trend?: string;
  onClick?: () => void;
}

const SummaryCard = ({ title, value, description, icon: Icon, color, trend, onClick }: SummaryCardProps) => (
  <Card 
    className={cn(
      "border-black/5 dark:border-border bg-card transition-all duration-300 shadow-xl rounded-3xl overflow-hidden relative group",
      onClick ? "cursor-pointer hover:border-primary/50 hover:shadow-primary/5 active:scale-[0.98]" : ""
    )}
    onClick={onClick}
  >
    {/* Subtle Background Pattern for Premium Feel */}
    <div className={cn("absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-5 group-hover:opacity-10 transition-opacity", color.replace('text-', 'bg-'))} />
    
    <CardContent className="p-5 relative z-10">
      <div className="flex items-center justify-between mb-4">
        <div className={cn("p-2.5 rounded-2xl bg-opacity-10 dark:bg-opacity-20", color.replace('text-', 'bg-'))}>
          <Icon className={cn("h-5 w-5", color)} />
        </div>
        {trend && (
          <Badge variant="outline" className="text-[10px] font-black text-emerald-500 border-emerald-500/20 bg-emerald-500/5 px-2 py-0.5 rounded-lg">
            {trend}
          </Badge>
        )}
      </div>
      
      <div className="space-y-0.5">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
          {title}
        </p>
        <h3 className="text-3xl font-black tracking-tighter text-foreground">
          {value}
        </h3>
        <p className="text-[11px] text-muted-foreground/50 font-semibold leading-tight pt-1">
          {description}
        </p>
      </div>
    </CardContent>
  </Card>
);

interface PublicationSummaryProps {
  stats: {
    prazosSemana: number;
    naoTratadas: number;
    semVinculo: number;
    novosAndamentos: number;
  };
  loading?: boolean;
  onCardClick?: (type: 'prazos' | 'novas' | 'sem_vinculo' | 'hoje') => void;
}

export const PublicationSummary = ({ stats, loading, onCardClick }: PublicationSummaryProps) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
      <SummaryCard
        title="Prazos da Semana"
        value={loading ? "..." : stats.prazosSemana}
        description="Vencimentos críticos detectados"
        icon={Clock}
        color="text-red-500"
        onClick={() => onCardClick?.('prazos')}
      />
      <SummaryCard
        title="Publicações Novas"
        value={loading ? "..." : stats.naoTratadas}
        description="Aguardando ciência ou tratamento"
        icon={Inbox}
        color="text-violet-600"
        onClick={() => onCardClick?.('novas')}
      />
      <SummaryCard
        title="Sem Vínculo"
        value={loading ? "..." : stats.semVinculo}
        description="Não associadas a processos/clientes"
        icon={Link2Off}
        color="text-orange-500"
        onClick={() => onCardClick?.('sem_vinculo')}
      />
      <SummaryCard
        title="Publicações Hoje"
        value={loading ? "..." : stats.novosAndamentos}
        description="Atualizações capturadas no diário"
        icon={FilePlus}
        color="text-emerald-500"
        onClick={() => onCardClick?.('hoje')}
      />
    </div>
  );
};
