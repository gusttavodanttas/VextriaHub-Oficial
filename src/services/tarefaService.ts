import { Tarefa, TarefaPriority } from '@/types/tarefa';
import { useToast } from '@/hooks/use-toast';

/**
 * Serviço para gerenciar operações com tarefas
 */
export class TarefaService {
  private toast: ReturnType<typeof useToast>['toast'];

  constructor(toast: ReturnType<typeof useToast>['toast']) {
    this.toast = toast;
  }

  /**
   * Retorna a cor para a prioridade da tarefa
   */
  getPriorityColor(priority: TarefaPriority): string {
    switch (priority) {
      case "alta":
        return "border-rose-500/50 text-rose-500 bg-transparent font-bold hover:bg-transparent";
      case "media":
        return "border-amber-500/50 text-amber-500 bg-transparent font-bold hover:bg-transparent";
      case "baixa":
        return "border-blue-500/50 text-blue-500 bg-transparent font-bold hover:bg-transparent";
      default:
        return "border-muted/30 text-muted-foreground bg-transparent hover:bg-transparent";
    }
  }

  /**
   * Alterna o status de conclusão de uma tarefa
   */
  toggleTaskCompletion(tarefas: Tarefa[], taskId: number): { 
    tarefas: Tarefa[]; 
    completedTask: Tarefa | null;
  } {
    const updatedTarefas = tarefas.map(tarefa => {
      if (tarefa.id === taskId) {
        const updatedTarefa = { ...tarefa, completed: !tarefa.completed };
        
        this.toast({
          title: updatedTarefa.completed ? "Tarefa concluída" : "Tarefa reativada",
          description: `"${updatedTarefa.title}" foi ${updatedTarefa.completed ? 'marcada como concluída' : 'reativada'}.`,
        });
        
        return updatedTarefa;
      }
      return tarefa;
    });

    const completedTask = updatedTarefas.find(t => t.id === taskId) || null;
    
    return { tarefas: updatedTarefas, completedTask };
  }

  /**
   * Atualiza uma tarefa existente
   */
  updateTarefa(tarefas: Tarefa[], updatedTarefa: Tarefa): Tarefa[] {
    const newTarefas = tarefas.map(tarefa => 
      tarefa.id === updatedTarefa.id ? updatedTarefa : tarefa
    );
    
    this.toast({
      title: "Tarefa atualizada",
      description: `"${updatedTarefa.title}" foi atualizada com sucesso.`,
    });
    
    return newTarefas;
  }

  /**
   * Adiciona uma nova tarefa
   */
  createTarefa(tarefas: Tarefa[], newTarefa: Tarefa): Tarefa[] {
    const newTarefas = [newTarefa, ...tarefas];
    
    this.toast({
      title: "Tarefa criada",
      description: `"${newTarefa.title}" foi criada com sucesso.`,
    });
    
    return newTarefas;
  }

  /**
   * Remove tarefas selecionadas
   */
  deleteTarefas(tarefas: Tarefa[], selectedIds: number[]): { 
    success: boolean; 
    tarefas: Tarefa[]; 
    message: string; 
  } {
    const selectedTarefas = tarefas.filter(tarefa => selectedIds.includes(tarefa.id));
    const pendingTarefas = selectedTarefas.filter(tarefa => !tarefa.completed);
    
    if (pendingTarefas.length > 0) {
      this.toast({
        title: "Não é possível excluir",
        description: `${pendingTarefas.length} tarefa(s) pendente(s) não pode(m) ser excluída(s).`,
        variant: "destructive",
      });
      return { 
        success: false, 
        tarefas, 
        message: "Tarefas pendentes não podem ser excluídas" 
      };
    }

    const updatedTarefas = tarefas.filter(tarefa => !selectedIds.includes(tarefa.id));
    
    this.toast({
      title: "Tarefas excluídas",
      description: `${selectedTarefas.length} tarefa(s) foram excluída(s) com sucesso.`,
    });
    
    return { 
      success: true, 
      tarefas: updatedTarefas, 
      message: "Tarefas excluídas com sucesso" 
    };
  }

  /**
   * Encontra uma tarefa por ID
   */
  findTarefaById(tarefas: Tarefa[], tarefaId: number): Tarefa | null {
    return tarefas.find(t => t.id === tarefaId) || null;
  }

  /**
   * Filtra tarefas baseado nos critérios
   */
  filterTarefas(tarefas: Tarefa[], filters: {
    search: string;
    priority?: string;
    status?: string;
    client?: string;
  }): Tarefa[] {
    return tarefas.filter(tarefa => {
      const matchesSearch = !filters.search || 
        tarefa.title.toLowerCase().includes(filters.search.toLowerCase()) ||
        tarefa.client.toLowerCase().includes(filters.search.toLowerCase()) ||
        tarefa.case.toLowerCase().includes(filters.search.toLowerCase());
      
      const matchesPriority = !filters.priority || tarefa.priority === filters.priority;
      const matchesStatus = !filters.status || 
        (filters.status === "concluida" && tarefa.completed) ||
        (filters.status === "pendente" && !tarefa.completed);
      const matchesClient = !filters.client || tarefa.client === filters.client;
      
      return matchesSearch && matchesPriority && matchesStatus && matchesClient;
    });
  }

  /**
   * Ordena tarefas por diferentes critérios
   */
  sortTarefas(tarefas: Tarefa[], sortBy: 'priority' | 'dueDate' | 'points' | 'status'): Tarefa[] {
    return [...tarefas].sort((a, b) => {
      switch (sortBy) {
        case 'priority':
          const priorityOrder = { alta: 3, media: 2, baixa: 1 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        case 'dueDate':
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        case 'points':
          return b.points - a.points;
        case 'status':
          return a.completed === b.completed ? 0 : a.completed ? 1 : -1;
        default:
          return 0;
      }
    });
  }

  /**
   * Calcula estatísticas das tarefas
   */
  calculateStats(tarefas: Tarefa[]): {
    total: number;
    completed: number;
    pending: number;
    totalPoints: number;
    earnedPoints: number;
    completionRate: number;
  } {
    const total = tarefas.length;
    const completed = tarefas.filter(t => t.completed).length;
    const pending = total - completed;
    const totalPoints = tarefas.reduce((sum, t) => sum + t.points, 0);
    const earnedPoints = tarefas.filter(t => t.completed).reduce((sum, t) => sum + t.points, 0);
    const completionRate = total > 0 ? (completed / total) * 100 : 0;

    return {
      total,
      completed,
      pending,
      totalPoints,
      earnedPoints,
      completionRate
    };
  }
}

/**
 * Hook para usar o serviço de tarefas
 */
export const useTarefaService = () => {
  const { toast } = useToast();
  return new TarefaService(toast);
};