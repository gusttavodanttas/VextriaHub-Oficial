import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Users } from 'lucide-react';

interface AtendimentosSelectionControlsProps {
  isAllSelected: boolean;
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  groupedByDate: boolean;
  onToggleGrouping: () => void;
}

export const AtendimentosSelectionControls: React.FC<AtendimentosSelectionControlsProps> = ({
  isAllSelected,
  selectedCount,
  totalCount,
  onSelectAll,
  onClearSelection,
  groupedByDate,
  onToggleGrouping
}) => {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-muted/30 rounded-lg">
      <div className="flex items-center gap-4">
        <Checkbox
          checked={isAllSelected}
          onCheckedChange={() => 
            isAllSelected ? onClearSelection() : onSelectAll()
          }
        />
        <span className="text-sm text-muted-foreground">
          {selectedCount > 0 ? (
            `${selectedCount} de ${totalCount} selecionado(s)`
          ) : (
            "Selecionar todos"
          )}
        </span>
      </div>
      
      <div className="flex items-center gap-2">
        {/* Agrupamento por data */}
        <Button
          variant={groupedByDate ? "default" : "outline"}
          size="sm"
          onClick={onToggleGrouping}
          className="flex items-center gap-2"
        >
          <Calendar className="h-4 w-4" />
          {groupedByDate ? "Agrupar por Data" : "Listar Todos"}
        </Button>
        
        {selectedCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClearSelection}
          >
            Limpar seleção
          </Button>
        )}
      </div>
    </div>
  );
};