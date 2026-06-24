import React from 'react';
import { Users, Plus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PermissionGuard } from '@/components/Auth/PermissionGuard';

interface ClientsEmptyStateProps {
  onNewClient: () => void;
}

export const ClientsEmptyState: React.FC<ClientsEmptyStateProps> = ({
  onNewClient
}) => {
  return (
    <Card className="border-dashed border-2 border-black/5 dark:border-white/5 p-12 glass-card rounded-[3rem] shadow-premium">
      <CardContent className="flex flex-col items-center justify-center space-y-8 pt-6">
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full" />
          <div className="p-6 rounded-3xl bg-primary/10 border border-primary/20 relative">
            <Users className="h-16 w-16 text-primary" />
          </div>
        </div>
        <div className="text-center space-y-4 max-w-md">
          <h3 className="text-3xl font-black tracking-tight leading-tight">Sua base está <span className="text-primary">vazia</span></h3>
          <p className="text-muted-foreground font-medium text-lg leading-relaxed">
            Parece que você ainda não adicionou clientes. Comece agora mesmo a construir sua rede de relacionamentos!
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 pt-4">
          <PermissionGuard permission="canCreateClients">
            <Button onClick={onNewClient} size="lg" className="h-14 px-10 rounded-xl font-black uppercase tracking-widest text-[11px] shadow-lg shadow-primary/20 hover:scale-[1.05] transition-all">
              <Plus className="mr-3 h-5 w-5" />
              Adicionar Primeiro Cliente
            </Button>
          </PermissionGuard>
        </div>
      </CardContent>
    </Card>
  );
};