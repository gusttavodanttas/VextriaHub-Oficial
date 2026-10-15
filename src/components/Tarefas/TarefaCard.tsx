// Linha/cartão da lista de tarefas — extraído de pages/Tarefas.tsx sem mudança de comportamento.
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CheckCircle2, User, FileText, MessageSquare, Clock, ListChecks, MessageCircle, CalendarClock, Pencil, MoreHorizontal, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import type { Tarefa } from "@/hooks/useTarefas";
import { prioMeta, dueLabel } from "@/components/Tarefas/shared";

interface Props {
  t: Tarefa;
  selected: boolean;
  selectMode: boolean;
  canManageTarefas: boolean;
  processoMap: Record<string, string>;
  atendimentoMap: Record<string, string>;
  membroMap: Record<string, string>;
  subtasks?: { total: number; done: number };
  comments?: number;
  navigate: (path: string) => void;
  onToggleSelect: (id: string) => void;
  onEdit: (t: Tarefa) => void;
  onToggleConcluida: (t: Tarefa) => void;
  onAdiar: (t: Tarefa) => void;
  onDelete: (t: Tarefa) => void;
}

export function TarefaCard({ t, selected, selectMode, canManageTarefas, processoMap, atendimentoMap, membroMap, subtasks, comments, navigate, onToggleSelect, onEdit, onToggleConcluida, onAdiar, onDelete }: Props) {
    const meta = prioMeta[t.prioridade || "media"] || prioMeta.media;
      const due = t.data_vencimento ? dueLabel(t.data_vencimento) : null;
    return (
      <div id={`item-${t.id}`}
        onClick={() => selectMode ? onToggleSelect(t.id) : onEdit(t)}
        className={cn(
          "group flex items-center gap-3 p-3.5 rounded-2xl border bg-card/40 transition-all hover:shadow-md cursor-pointer",
          selected ? "border-primary/40 ring-2 ring-primary/10 bg-primary/[0.02]" : "border-black/5 dark:border-border hover:border-black/10 dark:hover:border-white/15",
          t.concluida && "opacity-60"
        )}>
        {/* Checkbox concluir */}
        <button
          // Atalho de concluir/reabrir respeita o mesmo gate do menu (antes ficava aberto).
          disabled={!canManageTarefas}
          onClick={(e) => { e.stopPropagation(); if (canManageTarefas) onToggleConcluida(t); }}
          className={cn(
            "shrink-0 h-6 w-6 rounded-lg border-2 flex items-center justify-center transition-all",
            t.concluida ? "bg-emerald-500 border-emerald-500 text-white" : "border-muted-foreground/30 hover:border-emerald-500 hover:bg-emerald-500/10"
          )}
          title={t.concluida ? "Reabrir" : "Concluir"}
        >
          {t.concluida && <CheckCircle2 className="h-4 w-4" />}
        </button>

        {/* Seleção múltipla: só no modo "Selecionar" (senão fica só a bolinha de concluir) */}
        {selectMode && (
          <Checkbox checked={selected} onCheckedChange={() => onToggleSelect(t.id)}
            onClick={(e) => e.stopPropagation()}
            className="rounded-md shrink-0" />
        )}

        {/* Conteúdo */}
        <div className="flex-1 min-w-0">
          <p className={cn("font-bold truncate", t.concluida && "line-through text-muted-foreground")}>{t.titulo}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-[11px] text-muted-foreground font-medium">
            {t.cliente_nome && (t.cliente_id ? (
              <button type="button" onClick={(e) => { e.stopPropagation(); navigate(`/clientes?openId=${t.cliente_id}`); }}
                className="flex items-center gap-1 truncate hover:text-primary hover:underline transition-colors" title="Abrir ficha do cliente">
                <User className="h-3 w-3 shrink-0" />{t.cliente_nome}
              </button>
            ) : (
              <span className="flex items-center gap-1 truncate"><User className="h-3 w-3 shrink-0" />{t.cliente_nome}</span>
            ))}
            {t.processo_id && processoMap[t.processo_id] && <span className="flex items-center gap-1 truncate max-w-[180px]"><FileText className="h-3 w-3 shrink-0" />{processoMap[t.processo_id]}</span>}
            {t.atendimento_id && atendimentoMap[t.atendimento_id] && <span className="flex items-center gap-1 truncate"><MessageSquare className="h-3 w-3 shrink-0" />{atendimentoMap[t.atendimento_id]}</span>}
            {due && !t.concluida && <span className={cn("flex items-center gap-1", due.cls)}><Clock className="h-3 w-3" />{due.label}</span>}
            {subtasks && subtasks.total > 0 && <span className="flex items-center gap-1"><ListChecks className="h-3 w-3 shrink-0" />{subtasks.done}/{subtasks.total}</span>}
            {(comments ?? 0) > 0 && <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3 shrink-0" />{comments}</span>}
            {t.concluida && t.concluida_em && (
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3 w-3 shrink-0" /> Concluído por {membroMap[t.concluida_por || ""] || "—"} · {format(parseISO(t.concluida_em), "dd/MM/yy")}
              </span>
            )}
          </div>
          {t.descricao && !t.concluida && (
            <p className="text-[11px] text-muted-foreground/50 line-clamp-1 mt-0.5">{t.descricao}</p>
          )}
        </div>

        {/* Em andamento + Prioridade */}
        {!t.concluida && t.status === "fazendo" && (
          <Badge variant="outline" className="shrink-0 rounded-lg px-2 py-0.5 text-[9px] font-black uppercase tracking-widest border-blue-500/30 text-blue-600 dark:text-blue-400 bg-blue-500/10">Em and.</Badge>
        )}
        {!t.concluida && (
          <Badge variant="outline" className={cn("shrink-0 rounded-lg px-2 py-0.5 text-[9px] font-black uppercase tracking-widest", meta.cls)}>{meta.label}</Badge>
        )}

        {/* Ações (sempre visíveis no mobile; hover no desktop) */}
        {/* Adiar 1 dia: SEMPRE visível (triagem rápida do dia, 1 clique, sem abrir o form) */}
        {!t.concluida && canManageTarefas && (
          <Button variant="ghost" size="sm"
            className="h-8 shrink-0 px-2 gap-1.5 rounded-lg text-amber-600 hover:text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 border border-amber-500/20"
            onClick={(e) => { e.stopPropagation(); onAdiar(t); }}
            title="Adiar para o dia seguinte">
            <CalendarClock className="h-3.5 w-3.5" /><span className="hidden sm:inline text-[11px] font-bold">Adiar</span>
          </Button>
        )}

        <div onClick={(e) => e.stopPropagation()} className="flex items-center max-sm:opacity-100 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {canManageTarefas && <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg" onClick={() => onEdit(t)}><Pencil className="h-3.5 w-3.5" /></Button>}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg"><MoreHorizontal className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl w-44">
              {!t.concluida && canManageTarefas && (
                <DropdownMenuItem className="rounded-lg gap-2" onClick={() => onAdiar(t)}>
                  <CalendarClock className="h-4 w-4" /> Adiar p/ o dia seguinte
                </DropdownMenuItem>
              )}
              {canManageTarefas && (
                <DropdownMenuItem className="rounded-lg gap-2" onClick={() => onToggleConcluida(t)}>
                  <CheckCircle2 className="h-4 w-4" /> {t.concluida ? "Reabrir" : "Concluir"}
                </DropdownMenuItem>
              )}
              {canManageTarefas && (
                <DropdownMenuItem className="rounded-lg gap-2 text-destructive focus:text-destructive" onClick={() => onDelete(t)}>
                  <Trash2 className="h-4 w-4" /> Excluir
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
}
