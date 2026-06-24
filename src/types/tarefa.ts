export interface Tarefa {
  id: number;
  title: string;
  dueDate: string;
  priority: TarefaPriority;
  client: string;
  case: string;
  points: number;
  completed: boolean;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TarefaFormData {
  title: string;
  dueDate: string;
  priority: TarefaPriority;
  client: string;
  case: string;
  points: number;
  description?: string;
}

export interface TarefaFilters {
  search: string;
  priority: string;
  status: string;
  client: string;
}

export type TarefaPriority = "alta" | "media" | "baixa";
export type TarefaStatus = "pendente" | "concluida" | "em_andamento";