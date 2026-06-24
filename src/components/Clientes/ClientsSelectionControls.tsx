import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ClientsSelectionControlsProps {
  isAllSelected: boolean;
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onDeleteSelected: () => void;
}

export const ClientsSelectionControls: React.FC<ClientsSelectionControlsProps> = ({
  isAllSelected,
  selectedCount,
  totalCount,
  onSelectAll,
  onClearSelection,
  onDeleteSelected
}) => {
  return (
    <div className={cn(
      "flex items-center justify-between p-6 rounded-[2rem] border transition-all duration-500 shadow-premium",
      selectedCount > 0 
        ? "bg-primary/5 border-primary/20" 
        : "glass-card border-black/5 dark:border-white/5"
    )}>
      <div className="flex items-center gap-6">
        <Checkbox
          checked={isAllSelected}
          onCheckedChange={() => 
            isAllSelected ? onClearSelection() : onSelectAll()
          }
          className="h-5 w-5 rounded-md border-black/10 dark:border-white/20 data-[state=checked]:bg-primary transition-all"
        />
        <div className="flex flex-col">
          <span className={cn(
            "text-sm font-black uppercase tracking-widest",
            selectedCount > 0 ? "text-primary" : "text-muted-foreground/60"
          )}>
            {selectedCount > 0 ? (
              `${selectedCount} de ${totalCount} selecionados`
            ) : (
              "Selecionar todos os clientes"
            )}
          </span>
          {selectedCount > 0 && (
            <span className="text-[10px] font-black text-primary/40 uppercase tracking-widest">Ações em massa habilitadas</span>
          )}
        </div>
      </div>
      
      {selectedCount > 0 && (
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            className="rounded-xl h-11 px-6 font-black text-[10px] uppercase tracking-widest text-muted-foreground/60 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-all"
          >
            <X className="h-4 w-4 mr-2" />
            Limpar
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={onDeleteSelected}
            className="rounded-xl h-11 px-8 font-black text-[10px] uppercase tracking-widest shadow-lg shadow-rose-500/20 hover:scale-[1.02] transition-all"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Excluir Seleção
          </Button>
        </div>
      )}
    </div>
  );
};