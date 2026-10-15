// Modo "Selecionar" + ações em lote (concluir, prioridade, responsável, prazo, excluir)
// — extraído de pages/Tarefas.tsx sem mudança de comportamento.
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CheckSquare, X, CheckCircle2, Flag, ChevronDown, User, CalendarClock, Trash2 } from "lucide-react";
import type { useMultiSelect } from "@/hooks/useMultiSelect";
import type { Tarefa } from "@/hooks/useTarefas";

interface Props {
  selectMode: boolean;
  onEnterSelect: () => void;
  onExitSelect: () => void;
  multiSelect: ReturnType<typeof useMultiSelect<Tarefa>>;
  canManageTarefas: boolean;
  membros: { id: string; label: string }[];
  bulkConcluir: () => void;
  bulkPrioridade: (p: string) => void;
  bulkResponsavel: (id: string) => void;
  bulkPrazo: (data: string) => void;
  bulkPending: boolean;
  removePending: boolean;
  onDelete: () => void;
}

export function SelecaoToolbar({ selectMode, onEnterSelect, onExitSelect, multiSelect, canManageTarefas, membros, bulkConcluir, bulkPrioridade, bulkResponsavel, bulkPrazo, bulkPending, removePending, onDelete }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-1">
      {!selectMode ? (
        canManageTarefas && (
          <Button size="sm" variant="ghost" className="h-8 rounded-lg gap-1.5 font-bold text-muted-foreground" onClick={onEnterSelect}>
            <CheckSquare className="h-3.5 w-3.5" /> Selecionar
          </Button>
        )
      ) : (
        <div className="flex items-center gap-3">
          <Checkbox checked={multiSelect.isAllSelected} onCheckedChange={() => multiSelect.isAllSelected ? multiSelect.clearSelection() : multiSelect.selectAll()} className="rounded-md" />
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
            {multiSelect.selectedCount > 0 ? `${multiSelect.selectedCount} selecionada(s)` : "Selecionar todas"}
          </span>
          <Button size="sm" variant="ghost" className="h-8 rounded-lg gap-1 font-bold text-muted-foreground" onClick={onExitSelect}>
            <X className="h-3.5 w-3.5" /> Sair
          </Button>
        </div>
      )}

      {selectMode && multiSelect.selectedCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 sm:ml-auto">
          <Button size="sm" variant="outline" disabled={bulkPending}
            className="h-8 rounded-lg gap-1.5 font-bold text-emerald-600" onClick={bulkConcluir}>
            <CheckCircle2 className="h-3.5 w-3.5" /> Concluir
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="h-8 rounded-lg gap-1.5 font-bold">
                <Flag className="h-3.5 w-3.5" /> Prioridade <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="rounded-xl w-36">
              <DropdownMenuItem className="rounded-lg gap-2" onClick={() => bulkPrioridade("alta")}><span className="h-2 w-2 rounded-full bg-rose-500" /> Alta</DropdownMenuItem>
              <DropdownMenuItem className="rounded-lg gap-2" onClick={() => bulkPrioridade("media")}><span className="h-2 w-2 rounded-full bg-amber-500" /> Média</DropdownMenuItem>
              <DropdownMenuItem className="rounded-lg gap-2" onClick={() => bulkPrioridade("baixa")}><span className="h-2 w-2 rounded-full bg-emerald-500" /> Baixa</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {membros.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="h-8 rounded-lg gap-1.5 font-bold">
                  <User className="h-3.5 w-3.5" /> Responsável <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="rounded-xl w-48 max-h-64 overflow-y-auto">
                {membros.map((m) => (
                  <DropdownMenuItem key={m.id} className="rounded-lg" onClick={() => bulkResponsavel(m.id)}>{m.label}</DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <label className="flex items-center gap-1.5 h-8 rounded-lg border border-black/10 dark:border-border bg-card/40 px-2 text-xs font-bold cursor-pointer" title="Definir prazo das selecionadas">
            <CalendarClock className="h-3.5 w-3.5 text-muted-foreground/60" />
            <input type="date" onChange={(e) => bulkPrazo(e.target.value)}
              className="bg-transparent outline-none text-xs font-bold w-[7.5rem]" />
          </label>

          <Button size="sm" variant="outline" disabled={removePending}
            className="h-8 rounded-lg gap-1.5 font-bold text-rose-600" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" /> Excluir
          </Button>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-lg" onClick={() => multiSelect.clearSelection()} title="Limpar seleção">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
