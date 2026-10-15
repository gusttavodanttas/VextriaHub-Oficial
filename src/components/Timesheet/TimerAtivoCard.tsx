// Card do timer em andamento (ou o convite para iniciar um) — extraído de
// pages/Timesheet.tsx sem mudança de comportamento.
import { Button } from "@/components/ui/button";
import { Pause, Square, Timer, Play, UserCircle, ExternalLink, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TimesheetCategoria } from "@/types/timesheet";
import type { Timesheet } from "@/services/timesheetService";
import { CATEGORIA_CONFIG, REFERENCIA_CONFIG, formatSeconds, type ReferenciaTipo } from "@/components/Timesheet/shared";

interface Props {
  activeTimer: Timesheet | null;
  elapsedTime: number;
  canManageTimesheet: boolean;
  onPause: (id: string) => void;
  onFinalizar: (id: string) => void;
  onNovo: () => void;
  navigate: (path: string) => void;
  navigateToRef: (tipo: string, id: string | null | undefined) => void;
}

export function TimerAtivoCard({ activeTimer, elapsedTime, canManageTimesheet, onPause, onFinalizar, onNovo, navigate, navigateToRef }: Props) {
  const catCfg = activeTimer ? CATEGORIA_CONFIG[activeTimer.categoria as TimesheetCategoria] : null;
  const activeRefCfg = activeTimer?.referencia_tipo ? REFERENCIA_CONFIG[activeTimer.referencia_tipo as ReferenciaTipo] : null;

  return (
    <div className={cn(
    "rounded-2xl border shadow-premium overflow-hidden transition-all duration-300",
    activeTimer ? "border-primary/30 bg-gradient-to-br from-primary/[0.04] via-transparent to-transparent" : "border-black/5 dark:border-border bg-card/40"
  )}>
    {activeTimer ? (
      <div className="p-5 sm:p-8 flex flex-col items-center gap-4 sm:gap-5">
        <div className="flex items-center gap-2 flex-wrap justify-center">
          {catCfg && (
            <div className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest", catCfg.color)}>
              <catCfg.Icon className="h-3.5 w-3.5" />{catCfg.label}
            </div>
          )}
          {activeTimer.clientes?.nome && (
            <button onClick={() => navigate(`/clientes?openId=${activeTimer.cliente_id}`)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest bg-slate-500/10 text-slate-600 dark:text-slate-400 hover:bg-slate-500/20 transition-colors">
              <UserCircle className="h-3.5 w-3.5" />{activeTimer.clientes?.nome}
              <ExternalLink className="h-2.5 w-2.5 opacity-60" />
            </button>
          )}
          {activeRefCfg && activeTimer.referencia_label && (
            <button onClick={() => navigateToRef(activeTimer.referencia_tipo!, activeTimer.referencia_id)}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest hover:opacity-80 transition-opacity", activeRefCfg.color)}>
              <activeRefCfg.Icon className="h-3.5 w-3.5" />{activeTimer.referencia_label}
              <ExternalLink className="h-2.5 w-2.5 opacity-60" />
            </button>
          )}
        </div>

        <p className="text-sm sm:text-base font-bold text-center text-foreground/70 max-w-md px-2">{activeTimer.tarefa_descricao}</p>

        <div className="relative py-2">
          <div className="absolute inset-0 bg-primary/15 blur-3xl rounded-full" />
          <span className="relative text-5xl sm:text-7xl md:text-9xl font-black tracking-tighter tabular-nums text-foreground">
            {formatSeconds(elapsedTime)}
          </span>
        </div>

        {activeTimer.status === "ativo" && (
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-primary/70">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            Em andamento
          </div>
        )}

        {activeTimer.status === "ativo" && elapsedTime > 28800 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs font-bold">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            Este timer já passa de 8h — confira se esqueceu de finalizar.
          </div>
        )}

        {canManageTimesheet && <div className="flex items-center gap-3 w-full sm:w-auto max-w-xs sm:max-w-none">
          <Button variant="outline" onClick={() => onPause(activeTimer.id)}
            className="flex-1 sm:flex-none h-11 px-4 sm:px-6 rounded-xl font-black text-xs uppercase tracking-wider border-black/10 dark:border-border">
            <Pause className="h-4 w-4 mr-2" />Pausar
          </Button>
          <Button variant="destructive" onClick={() => onFinalizar(activeTimer.id)}
            className="flex-1 sm:flex-none h-11 px-4 sm:px-8 rounded-xl font-black text-xs uppercase tracking-wider shadow-premium">
            <Square className="h-4 w-4 mr-2 fill-current" />Finalizar
          </Button>
        </div>}
      </div>
    ) : (
      <div className="p-10 flex flex-col items-center gap-4 text-center">
        <div className="h-16 w-16 rounded-2xl bg-muted/20 border border-dashed border-border flex items-center justify-center">
          <Timer className="h-8 w-8 text-muted-foreground/30" />
        </div>
        <div>
          <p className="font-bold text-muted-foreground">Nenhum timer ativo</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Clique em "Novo Timer" para começar a registrar</p>
        </div>
        {canManageTimesheet && (
          <Button onClick={onNovo} size="lg"
            className="mt-2 h-11 px-8 rounded-xl font-black text-xs uppercase tracking-widest shadow-premium">
            <Play className="h-4 w-4 mr-2 fill-current" />Iniciar Atividade
          </Button>
        )}
      </div>
    )}
  </div>
  );
}
