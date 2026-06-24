import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PermissionGuard } from '@/components/Auth/PermissionGuard';

interface ClientsPageHeaderProps {
  selectedCount: number;
  onDeleteSelected: () => void;
  onNewClient: () => void;
  isNoneSelected: boolean;
}

export const ClientsPageHeader: React.FC<ClientsPageHeaderProps> = ({
  selectedCount,
  onDeleteSelected,
  onNewClient,
  isNoneSelected
}) => {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <Plus className="h-6 w-6 md:h-8 md:w-8 text-primary" />
          </div>
          <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
            Clientes
          </h1>
        </div>
        <p className="text-sm md:text-lg text-muted-foreground font-medium">
          Gerencie seus clientes e relacionamentos de forma centralizada.
        </p>
      </div>
      <div className="flex items-center gap-3 glass-morphism p-2 rounded-2xl">
        <PermissionGuard permission="canDeleteClients">
          {!isNoneSelected && (
            <Button
              variant="destructive"
              onClick={onDeleteSelected}
              className="flex items-center gap-2 h-10 md:h-12 px-4 md:px-6 rounded-xl"
            >
              <Trash2 className="h-4 w-4" />
              Excluir ({selectedCount})
            </Button>
          )}
        </PermissionGuard>
        
        <PermissionGuard permission="canCreateClients">
          <Button 
            onClick={onNewClient} 
            size="lg" 
            className="rounded-xl shadow-premium h-10 md:h-12 px-4 md:px-6"
          >
            <Plus className="mr-2 h-4 w-4 md:h-5 md:w-5" />
            Novo Cliente
          </Button>
        </PermissionGuard>
      </div>
    </div>
  );
};