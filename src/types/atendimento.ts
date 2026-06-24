export interface Atendimento {
  id: string;
  cliente: string;
  clienteId: number;
  tipo: string;
  data: string;
  horario: string;
  status: string;
  duracao: string;
  observacoes: string;
}

export interface AtendimentoFormData {
  cliente: string;
  clienteId: number;
  tipo: string;
  data: string;
  horario: string;
  status: string;
  duracao: string;
  observacoes: string;
}

export interface AtendimentoFilters {
  search: string;
  status: string;
  tipo: string;
  data: string;
  clienteId?: number;
}

export type AtendimentoStatus = "Agendado" | "Confirmado" | "Concluído" | "Pendente" | "Cancelado";
export type AtendimentoTipo = "Presencial" | "Online" | "Telefone" | "Consultoria";