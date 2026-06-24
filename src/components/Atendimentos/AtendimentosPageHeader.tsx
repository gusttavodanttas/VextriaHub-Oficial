import React from 'react';
import { Plus, Trash2, ArrowLeft, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PermissionGuard } from '@/components/Auth/PermissionGuard';

interface AtendimentosPageHeaderProps {
  selectedCount: number;
  onDeleteSelected: () => void;
  onNewAtendimento: () => void;
  isNoneSelected: boolean;
  isFiltered: boolean;
  onClearFilter: () => void;
  clientName?: string;
}

export const AtendimentosPageHeader: React.FC<AtendimentosPageHeaderProps> = ({
  selectedCount,
  onDeleteSelected,
  onNewAtendimento,
  isNoneSelected,
  isFiltered,
  onClearFilter,
  clientName
}) => {
  return (
    <div className="flex flex-col space-y-4">
      {/* Filtro ativo */}
      {isFiltered && clientName && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <span className="text-sm text-blue-800 dark:text-blue-200">
            Filtrando por cliente: <strong>{clientName}</strong>
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilter}
            className="ml-auto h-6 w-6 p-0 text-blue-600 dark:text-blue-400"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Header principal */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div className="space-y-2">
          <h1 className="text-2xl md:text-4xl font-black tracking-tight text-foreground">
            Atendimentos
            {isFiltered && clientName && (
              <span className="text-lg text-muted-foreground ml-2 opacity-60">
                - {clientName}
              </span>
            )}
          </h1>
          <p className="text-sm md:text-lg text-muted-foreground font-medium">
            Gerencie seus atendimentos e agendamentos com precisão estratégica.
          </p>
        </div>
        
        <div className="flex items-center gap-3 glass-morphism p-2 rounded-2xl border border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/5 shadow-premium">
          <PermissionGuard permission="canDeleteAtendimentos">
            {!isNoneSelected && (
              <Button
                variant="destructive"
                onClick={onDeleteSelected}
                className="rounded-xl h-12 px-6 font-black uppercase text-xs tracking-widest shadow-lg shadow-red-500/20"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir ({selectedCount})
              </Button>
            )}
          </PermissionGuard>
          
          <Button 
            onClick={onNewAtendimento}
            className="rounded-xl h-12 px-8 font-black uppercase text-xs tracking-widest bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
          >
            <Plus className="mr-2 h-5 w-5" />
            Novo Atendimento
          </Button>
        </div>
      </div>
    </div>
  );
};