// Card do Kanban (arrastável) — extraído de pages/Tarefas.tsx sem mudança de comportamento.
import { CalendarClock, Clock, User, ListChecks, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tarefa } from "@/hooks/useTarefas";
import { prioMeta, dueLabel } from "@/components/Tarefas/shared";

interface Props {
  t: Tarefa;
  canManageTarefas: boolean;
  dragging: boolean;
  subtasks?: { total: number; done: number };
  comments?: number;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onOpen: (t: Tarefa) => void;
  onAdiar: (t: Tarefa) => void;
}

export function TarefaKanbanCard({ t, canManageTarefas, dragging, subtasks, comments, onDragStart, onDragEnd, onOpen, onAdiar }: Props) {
    const meta = prioMeta[t.prioridade || "media"] || prioMeta.media;
    const due = t.data_vencimento ? dueLabel(t.data_vencimento) : null;
    const sc = subtasks;
    return (
      <div draggable={canManageTarefas}
        onDragStart={() => { if (canManageTarefas) onDragStart(t.id); }}
        onDragEnd={onDragEnd}
        onClick={() => onOpen(t)}
        className={cn(
          "cursor-grab active:cursor-grabbing rounded-xl border border-black/5 dark:border-border bg-card p-3 space-y-2 transition-all hover:shadow-md hover:border-black/10 dark:hover:border-white/15",
          dragging && "opacity-40"
        )}>
        <div className="flex items-start gap-2">
          <span className={cn("mt-1 h-2 w-2 rounded-full shrink-0", meta.dot)} />
          <p className={cn("flex-1 text-sm font-bold leading-snug", t.concluida && "line-through text-muted-foreground")}>{t.titulo}</p>
          {/* Adiar 1 dia direto no card do Kanban (stopPropagation p/ não abrir o form
              nem iniciar o arrasto) */}
          {!t.concluida && canManageTarefas && (
            <button type="button" draggable={false}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onAdiar(t); }}
              title="Adiar para o dia seguinte"
              className="shrink-0 -mt-0.5 -mr-0.5 h-6 w-6 rounded-md flex items-center justify-center text-amber-600 hover:text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 transition-colors">
              <CalendarClock className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px] text-muted-foreground font-medium pl-4">
          {t.cliente_nome && <span className="flex items-center gap-1 truncate max-w-[140px]"><User className="h-3 w-3 shrink-0" />{t.cliente_nome}</span>}
          {due && !t.concluida && <span className={cn("flex items-center gap-1", due.cls)}><Clock className="h-3 w-3" />{due.label}</span>}
          {sc && sc.total > 0 && <span className="flex items-center gap-1"><ListChecks className="h-3 w-3 shrink-0" />{sc.done}/{sc.total}</span>}
          {(comments ?? 0) > 0 && <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3 shrink-0" />{comments}</span>}
        </div>
      </div>
    );
}
