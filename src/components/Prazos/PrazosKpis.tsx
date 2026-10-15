// Faixa de KPIs clicáveis (filtro rápido por urgência) — extraída de pages/Prazos.tsx.
import { AlertTriangle, Flame, Timer, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Urgency } from '@/components/Prazos/shared';

interface Props {
  kpis: { vencidos: number; hoje: number; criticos: number; total: number };
  filterUrgency: Urgency | 'all';
  onToggleUrgency: (urgency: Urgency) => void;
}

export function PrazosKpis({ kpis, filterUrgency, onToggleUrgency }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[
        { label: 'Vencidos',        value: kpis.vencidos,  icon: AlertTriangle, color: 'text-red-600',    bg: 'bg-red-500/8 border-red-500/15',       activeBg: 'ring-2 ring-red-500/40',    urgency: 'vencido'  as Urgency },
        { label: 'Vencem hoje',     value: kpis.hoje,      icon: Flame,         color: 'text-amber-600',  bg: 'bg-amber-500/8 border-amber-500/15',   activeBg: 'ring-2 ring-amber-500/40',  urgency: 'hoje'     as Urgency },
        { label: 'Próximos 3 dias', value: kpis.criticos,  icon: Timer,         color: 'text-orange-600', bg: 'bg-orange-500/8 border-orange-500/15', activeBg: 'ring-2 ring-orange-500/40', urgency: 'critico'  as Urgency },
        { label: 'Total pendente',  value: kpis.total,     icon: Calendar,      color: 'text-sky-600',    bg: 'bg-sky-500/8 border-sky-500/15',       activeBg: 'ring-2 ring-sky-500/40',    urgency: null },
      ].map(({ label, value, icon: Icon, color, bg, activeBg, urgency }) => {
        const isActive = urgency ? filterUrgency === urgency : false;
        return (
          <button
            key={label}
            onClick={() => { if (urgency) onToggleUrgency(urgency); }}
            className={cn(
              'rounded-2xl border p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3 text-left transition-all',
              bg,
              urgency ? 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]' : 'cursor-default',
              isActive && activeBg,
            )}
          >
            <div className={cn('p-2 rounded-xl bg-background/60 shrink-0', color)}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className={cn('text-xl sm:text-2xl font-black', color)}>{value}</p>
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest truncate">
                {label}{isActive && ' ✕'}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
