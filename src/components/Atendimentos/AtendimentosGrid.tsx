import React from 'react';
import { Atendimento } from '@/types/atendimento';
import { AtendimentoCard } from './AtendimentoCard';

interface AtendimentosGridProps {
  atendimentos: Atendimento[];
  selectedIds: string[];
  onToggleSelect: (atendimentoId: string) => void;
  onEditAtendimento: (atendimentoId: string) => void;
  onNavigateToClient: (clientId: number, clientName: string) => void;
  onNavigateToProcesses: (clientId: number, clientName: string) => void;
  getStatusColor: (status: string) => string;
  groupedByDate?: boolean;
}

export const AtendimentosGrid: React.FC<AtendimentosGridProps> = ({
  atendimentos,
  selectedIds,
  onToggleSelect,
  onEditAtendimento,
  onNavigateToClient,
  onNavigateToProcesses,
  getStatusColor,
  groupedByDate = false
}) => {
  if (groupedByDate) {
    // Agrupar por data
    const groupedAtendimentos = atendimentos.reduce((groups, atendimento) => {
      const date = atendimento.data;
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(atendimento);
      return groups;
    }, {} as Record<string, Atendimento[]>);

    // Ordenar as datas
    const sortedDates = Object.keys(groupedAtendimentos).sort((a, b) => {
      return new Date(a.split('/').reverse().join('-')).getTime() - 
             new Date(b.split('/').reverse().join('-')).getTime();
    });

    return (
      <div className="space-y-6">
        {sortedDates.map(date => (
          <div key={date} className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground border-b pb-2">
              {date}
            </h3>
            <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {groupedAtendimentos[date].map((atendimento) => (
                <AtendimentoCard
                  key={atendimento.id}
                  atendimento={atendimento}
                  isSelected={selectedIds.includes(atendimento.id)}
                  onToggleSelect={onToggleSelect}
                  onEditAtendimento={onEditAtendimento}
                  onNavigateToClient={onNavigateToClient}
                  onNavigateToProcesses={onNavigateToProcesses}
                  getStatusColor={getStatusColor}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Exibição normal sem agrupamento
  return (
    <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      {atendimentos.map((atendimento) => (
        <AtendimentoCard
          key={atendimento.id}
          atendimento={atendimento}
          isSelected={selectedIds.includes(atendimento.id)}
          onToggleSelect={onToggleSelect}
          onEditAtendimento={onEditAtendimento}
          onNavigateToClient={onNavigateToClient}
          onNavigateToProcesses={onNavigateToProcesses}
          getStatusColor={getStatusColor}
        />
      ))}
    </div>
  );
};