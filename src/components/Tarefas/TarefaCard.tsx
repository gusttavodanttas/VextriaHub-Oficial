import React from 'react';
import { Calendar, Clock, AlertTriangle, CheckCircle, User, FileText, MoreVertical, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tarefa } from '@/types/tarefa';

interface TarefaCardProps {
  tarefa: Tarefa;
  isSelected: boolean;
  isCompleted: boolean;
  onToggleSelect: (tarefaId: number) => void;
  onToggleComplete: (tarefaId: number) => void;
  onDelete: (tarefaId: number) => void;
  getPriorityColor: (priority: string) => string;
}

export const TarefaCard: React.FC<TarefaCardProps> = ({
  tarefa,
  isSelected,
  isCompleted,
  onToggleSelect,
  onToggleComplete,
  onDelete,
  getPriorityColor
}) => {
  return (
    <Card className={`transition-all duration-200 hover:shadow-md ${
      isCompleted ? "bg-muted/30 opacity-75" : ""
    } ${isSelected ? "ring-2 ring-primary shadow-lg" : ""}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Checkbox de seleção - apenas para ações em lote */}
          <div className="flex-shrink-0 pt-1">
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onToggleSelect(tarefa.id)}
              className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
            />
          </div>
          
          <div className="flex-1 space-y-3">
            {/* Header com título e ações */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-start gap-2">
                  {/* Indicador de status visual */}
                  <div className="flex-shrink-0 pt-1">
                    {isCompleted ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <div className={`h-3 w-3 rounded-full ${
                        tarefa.priority === 'alta' ? 'bg-red-500' :
                        tarefa.priority === 'media' ? 'bg-yellow-500' : 'bg-blue-500'
                      }`} />
                    )}
                  </div>
                  
                  <h4 className={`font-medium leading-tight ${
                    isCompleted ? "line-through text-muted-foreground" : ""
                  }`}>
                    {tarefa.title}
                  </h4>
                </div>
              </div>
              
              {/* Badges e menu de ações */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge className={getPriorityColor(tarefa.priority)} variant="secondary">
                  {tarefa.priority}
                </Badge>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                  {tarefa.points} pts
                </Badge>
                
                {/* Menu de ações */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem 
                      onClick={() => onToggleComplete(tarefa.id)}
                      className="flex items-center gap-2"
                    >
                      {isCompleted ? (
                        <>
                          <AlertTriangle className="h-4 w-4" />
                          Marcar como pendente
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4" />
                          Marcar como concluída
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => onDelete(tarefa.id)}
                      className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      Deletar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            
            {/* Informações da tarefa */}
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>{tarefa.dueDate}</span>
              </div>
              <div className="flex items-center gap-1">
                <User className="h-4 w-4" />
                <span>{tarefa.client}</span>
              </div>
              <div className="flex items-center gap-1">
                <FileText className="h-4 w-4" />
                <span>{tarefa.case}</span>
              </div>
            </div>

            {/* Descrição */}
            {tarefa.description && (
              <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
                <p className="line-clamp-2">{tarefa.description}</p>
              </div>
            )}
            
            {/* Status footer */}
            {isCompleted && (
              <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-md">
                <CheckCircle className="h-3 w-3" />
                <span>Tarefa concluída</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};