import React from 'react';
import { Tarefa } from '@/types/tarefa';
import { TarefaCard } from './TarefaCard';

interface TarefasListProps {
  tarefas: Tarefa[];
  selectedIds: number[];
  completedIds: number[];
  onToggleSelect: (tarefaId: number) => void;
  onToggleComplete: (tarefaId: number) => void;
  onDelete: (tarefaId: number) => void;
  getPriorityColor: (priority: string) => string;
}

export const TarefasList: React.FC<TarefasListProps> = ({
  tarefas,
  selectedIds,
  completedIds,
  onToggleSelect,
  onToggleComplete,
  onDelete,
  getPriorityColor
}) => {
  return (
    <div className="space-y-4">
      {tarefas.map((tarefa) => (
        <TarefaCard
          key={tarefa.id}
          tarefa={tarefa}
          isSelected={selectedIds.includes(tarefa.id)}
          isCompleted={completedIds.includes(tarefa.id)}
          onToggleSelect={onToggleSelect}
          onToggleComplete={onToggleComplete}
          onDelete={onDelete}
          getPriorityColor={getPriorityColor}
        />
      ))}
    </div>
  );
};