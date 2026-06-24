import React from 'react';
import { UserCheck, Plus, Calendar } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PermissionGuard } from '@/components/Auth/PermissionGuard';

interface AtendimentosEmptyStateProps {
  onNewAtendimento: () => void;
  onLoadSampleData: () => void;
  isFiltered?: boolean;
  onClearFilters?: () => void;
}

export const AtendimentosEmptyState: React.FC<AtendimentosEmptyStateProps> = ({
  onNewAtendimento,
  onLoadSampleData,
  isFiltered = false,
  onClearFilters
}) => {
  if (isFiltered) {
    return (
      <Card className="border-dashed border-2 p-8">
        <CardContent className="flex flex-col items-center justify-center space-y-4 pt-6">
          <Calendar className="h-12 w-12 text-muted-foreground" />
          <div className="text-center space-y-2">
            <h3 className="text-xl font-semibold">Nenhum atendimento encontrado</h3>
            <p className="text-muted-foreground">
              Não foram encontrados atendimentos com os filtros aplicados. 
              Tente ajustar os filtros ou limpar a pesquisa.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClearFilters}>
              Limpar Filtros
            </Button>
            <PermissionGuard permission="canCreateAtendimentos">
              <Button onClick={onNewAtendimento}>
                <Plus className="mr-2 h-4 w-4" />
                Novo Atendimento
              </Button>
            </PermissionGuard>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-dashed border-2 p-8">
      <CardContent className="flex flex-col items-center justify-center space-y-4 pt-6">
        <UserCheck className="h-12 w-12 text-muted-foreground" />
        <div className="text-center space-y-2">
          <h3 className="text-xl font-semibold">Nenhum atendimento cadastrado</h3>
          <p className="text-muted-foreground">
            Você ainda não possui atendimentos cadastrados. 
            Comece agendando seu primeiro atendimento ou carregue dados de exemplo.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <PermissionGuard permission="canCreateAtendimentos">
            <Button onClick={onNewAtendimento}>
              <Plus className="mr-2 h-4 w-4" />
              Agendar Atendimento
            </Button>
          </PermissionGuard>
          <Button variant="outline" onClick={onLoadSampleData}>
            Carregar Dados de Exemplo
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};