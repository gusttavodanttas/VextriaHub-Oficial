import { Atendimento, AtendimentoStatus } from '@/types/atendimento';
import { useToast } from '@/hooks/use-toast';

/**
 * Serviço para gerenciar operações com atendimentos
 */
export class AtendimentoService {
  private toast: ReturnType<typeof useToast>['toast'];

  constructor(toast: ReturnType<typeof useToast>['toast']) {
    this.toast = toast;
  }

  /**
   * Retorna a cor para o status do atendimento
   */
  getStatusColor(status: AtendimentoStatus): string {
    switch (status) {
      case "Agendado":
        return "bg-accent text-accent-foreground";
      case "Confirmado":
        return "bg-blue-500/10 text-blue-500";
      case "Concluído":
        return "bg-green-500/10 text-green-500";
      case "Pendente":
        return "bg-yellow-500/10 text-yellow-500";
      case "Cancelado":
        return "bg-red-500/10 text-red-500";
      default:
        return "bg-muted text-muted-foreground";
    }
  }

  /**
   * Atualiza um atendimento existente
   */
  updateAtendimento(atendimentos: Atendimento[], updatedAtendimento: Atendimento): Atendimento[] {
    const newAtendimentos = atendimentos.map(atendimento => 
      atendimento.id === updatedAtendimento.id ? updatedAtendimento : atendimento
    );
    
    this.toast({
      title: "Atendimento atualizado",
      description: `Atendimento com ${updatedAtendimento.cliente} foi atualizado com sucesso.`,
    });
    
    return newAtendimentos;
  }

  /**
   * Adiciona um novo atendimento
   */
  createAtendimento(atendimentos: Atendimento[], newAtendimento: Atendimento): Atendimento[] {
    const newAtendimentos = [newAtendimento, ...atendimentos];
    
    this.toast({
      title: "Atendimento agendado",
      description: `Atendimento com ${newAtendimento.cliente} foi agendado para ${newAtendimento.data} às ${newAtendimento.horario}.`,
    });
    
    return newAtendimentos;
  }

  /**
   * Remove atendimentos selecionados
   */
  deleteAtendimentos(atendimentos: Atendimento[], selectedIds: string[]): { 
    success: boolean; 
    atendimentos: Atendimento[]; 
    message: string; 
  } {
    const selectedAtendimentos = atendimentos.filter(atendimento => selectedIds.includes(atendimento.id));
    const confirmedAtendimentos = selectedAtendimentos.filter(atendimento => atendimento.status === "Confirmado");
    
    if (confirmedAtendimentos.length > 0) {
      this.toast({
        title: "Não é possível excluir",
        description: `${confirmedAtendimentos.length} atendimento(s) confirmado(s) não pode(m) ser excluído(s).`,
        variant: "destructive",
      });
      return { 
        success: false, 
        atendimentos, 
        message: "Atendimentos confirmados não podem ser excluídos" 
      };
    }

    const updatedAtendimentos = atendimentos.filter(atendimento => !selectedIds.includes(atendimento.id));
    
    this.toast({
      title: "Atendimentos excluídos",
      description: `${selectedAtendimentos.length} atendimento(s) foram excluído(s) com sucesso.`,
    });
    
    return { 
      success: true, 
      atendimentos: updatedAtendimentos, 
      message: "Atendimentos excluídos com sucesso" 
    };
  }

  /**
   * Encontra um atendimento por ID
   */
  findAtendimentoById(atendimentos: Atendimento[], atendimentoId: string): Atendimento | null {
    return atendimentos.find(a => a.id === atendimentoId) || null;
  }

  /**
   * Navega para o cliente do atendimento
   */
  navigateToClient(navigate: (path: string, options?: any) => void, clientId: number, clientName: string) {
    console.log(`Navegando para cliente ${clientId} - ${clientName}`);
    navigate('/clientes', { 
      state: { 
        clientFilter: clientName,
        clientId: clientId,
        filterActive: true 
      } 
    });
    this.toast({
      title: "Redirecionando",
      description: `Visualizando dados de ${clientName}`,
    });
  }

  /**
   * Navega para os processos do cliente
   */
  navigateToProcesses(navigate: (path: string, options?: any) => void, clientId: number, clientName: string) {
    console.log(`Navegando para processos do cliente ${clientId} - ${clientName}`);
    navigate('/processos', { 
      state: { 
        clientFilter: clientName,
        clientId: clientId,
        filterActive: true 
      } 
    });
    this.toast({
      title: "Redirecionando",
      description: `Visualizando processos de ${clientName}`,
    });
  }

  /**
   * Filtra atendimentos baseado nos critérios
   */
  filterAtendimentos(atendimentos: Atendimento[], filters: {
    search: string;
    status?: string;
    tipo?: string;
    clienteId?: number;
  }): Atendimento[] {
    return atendimentos.filter(atendimento => {
      const matchesSearch = !filters.search || 
        atendimento.cliente.toLowerCase().includes(filters.search.toLowerCase()) ||
        atendimento.tipo.toLowerCase().includes(filters.search.toLowerCase()) ||
        atendimento.observacoes.toLowerCase().includes(filters.search.toLowerCase());
      
      const matchesStatus = !filters.status || atendimento.status === filters.status;
      const matchesTipo = !filters.tipo || atendimento.tipo === filters.tipo;
      const matchesCliente = !filters.clienteId || atendimento.clienteId === filters.clienteId;
      
      return matchesSearch && matchesStatus && matchesTipo && matchesCliente;
    });
  }

  /**
   * Agrupa atendimentos por data
   */
  groupAtendimentosByDate(atendimentos: Atendimento[]): Record<string, Atendimento[]> {
    return atendimentos.reduce((groups, atendimento) => {
      const date = atendimento.data;
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(atendimento);
      return groups;
    }, {} as Record<string, Atendimento[]>);
  }
}

/**
 * Hook para usar o serviço de atendimentos
 */
export const useAtendimentoService = () => {
  const { toast } = useToast();
  return new AtendimentoService(toast);
};