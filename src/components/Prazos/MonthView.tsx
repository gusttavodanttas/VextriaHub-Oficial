// Visão de calendário mensal dos prazos — extraída de pages/Prazos.tsx.
import { format, startOfMonth, startOfWeek, addDays, isSameDay, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { type Prazo, getDataPrazo, toLocalDate, getUrgency, URGENCY_CONFIG, tituloPrazo } from './shared';

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function MonthView({ items, refDate, onPrev, onNext, onHoje, onSelect }: {
  items: Prazo[]; refDate: Date;
  onPrev: () => void; onNext: () => void; onHoje: () => void;
  onSelect: (p: Prazo) => void;
}) {
  const inicio = startOfWeek(startOfMonth(refDate), { weekStartsOn: 0 });
  const dias = Array.from({ length: 42 }, (_, i) => addDays(inicio, i));
  const hoje = new Date();
  const porDia = (d: Date) => items.filter(p => { const dt = getDataPrazo(p); return dt && isSameDay(toLocalDate(dt), d); });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Button size="icon" variant="outline" className="h-9 w-9 rounded-xl" onClick={onPrev} title="Mês anterior"><ChevronLeft className="h-4 w-4" /></Button>
          <Button size="icon" variant="outline" className="h-9 w-9 rounded-xl" onClick={onNext} title="Próximo mês"><ChevronRight className="h-4 w-4" /></Button>
          <Button variant="outline" className="h-9 rounded-xl px-3 text-[10px] font-black uppercase tracking-widest" onClick={onHoje}>Hoje</Button>
        </div>
        <p className="text-sm font-black tracking-tight capitalize">{format(refDate, 'MMMM yyyy', { locale: ptBR })}</p>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map(w => (
          <div key={w} className="text-center text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 py-1">{w}</div>
        ))}
        {dias.map(d => {
          const list = porDia(d);
          const isHoje = isSameDay(d, hoje);
          const isMes = isSameMonth(d, refDate);
          return (
            <div key={d.toISOString()}
              className={cn('rounded-lg border p-1 min-h-[64px] sm:min-h-[92px] flex flex-col gap-0.5 overflow-hidden',
                isHoje ? 'border-primary/40 bg-primary/5' : 'border-border/50', !isMes && 'opacity-40')}>
              <span className={cn('text-[10px] font-bold px-0.5', isHoje && 'text-primary')}>{format(d, 'd')}</span>
              <div className="flex flex-col gap-0.5 overflow-hidden">
                {list.slice(0, 3).map(p => {
                  const c = URGENCY_CONFIG[getUrgency(p)];
                  return (
                    <button key={p.id} onClick={() => onSelect(p)} title={tituloPrazo(p)}
                      className={cn('text-left rounded px-1 py-0.5 text-[9px] font-bold truncate border', c.badge)}>
                      {tituloPrazo(p)}
                    </button>
                  );
                })}
                {list.length > 3 && <span className="text-[9px] text-muted-foreground/50 px-1">+{list.length - 3}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
