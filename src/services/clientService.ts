import { Client } from '@/types/client';
import { useToast } from '@/hooks/use-toast';

/**
 * Serviço para gerenciar operações com clientes
 * Centraliza toda a lógica de CRUD e navegação
 */
export class ClientService {
  private toast: ReturnType<typeof useToast>['toast'];

  constructor(toast: ReturnType<typeof useToast>['toast']) {
    this.toast = toast;
  }

  /**
   * Atualiza um cliente existente
   */
  updateClient(clients: Client[], updatedClient: Client): Client[] {
    const newClients = clients.map(client => 
      client.id === updatedClient.id ? updatedClient : client
    );
    
    this.toast({
      title: "Cliente atualizado",
      description: `Os dados de ${updatedClient.name} foram atualizados com sucesso.`,
    });
    
    return newClients;
  }

  /**
   * Adiciona um novo cliente
   */
  createClient(clients: Client[], newClient: Client): Client[] {
    const newClients = [newClient, ...clients];
    
    this.toast({
      title: "Cliente cadastrado",
      description: `${newClient.name} foi cadastrado com sucesso.`,
    });
    
    return newClients;
  }

  /**
   * Remove clientes selecionados
   */
  deleteClients(clients: Client[], selectedIds: number[]): { 
    success: boolean; 
    clients: Client[]; 
    message: string; 
  } {
    const selectedClients = clients.filter(client => selectedIds.includes(client.id));
    const clientsWithProcesses = selectedClients.filter(client => client.cases > 0);
    
    if (clientsWithProcesses.length > 0) {
      this.toast({
        title: "Não é possível excluir",
        description: `${clientsWithProcesses.length} cliente(s) possui(em) processos associados.`,
        variant: "destructive",
      });
      return { 
        success: false, 
        clients, 
        message: "Clientes com processos não podem ser excluídos" 
      };
    }

    const updatedClients = clients.filter(client => !selectedIds.includes(client.id));
    
    this.toast({
      title: "Clientes excluídos",
      description: `${selectedClients.length} cliente(s) foram excluído(s) com sucesso.`,
    });
    
    return { 
      success: true, 
      clients: updatedClients, 
      message: "Clientes excluídos com sucesso" 
    };
  }

  /**
   * Encontra um cliente por ID
   */
  findClientById(clients: Client[], clientId: number): Client | null {
    return clients.find(c => c.id === clientId) || null;
  }

  /**
   * Navega para a página de processos com filtro do cliente
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
   * Navega para a página de atendimentos com filtro do cliente
   */
  navigateToAtendimentos(navigate: (path: string, options?: any) => void, clientId: number, clientName: string) {
    console.log(`Navegando para atendimentos do cliente ${clientId} - ${clientName}`);
    navigate('/atendimentos', { 
      state: { 
        clientFilter: clientName,
        clientId: clientId,
        filterActive: true 
      } 
    });
    this.toast({
      title: "Redirecionando",
      description: `Visualizando atendimentos de ${clientName}`,
    });
  }

  /**
   * Navega para a página de consultivo com filtro do cliente
   */
  navigateToConsultivo(navigate: (path: string, options?: any) => void, clientId: number, clientName: string) {
    console.log(`Navegando para consultivo do cliente ${clientId} - ${clientName}`);
    navigate('/consultivo', { 
      state: { 
        clientFilter: clientName,
        clientId: clientId,
        filterActive: true 
      } 
    });
    this.toast({
      title: "Redirecionando",
      description: `Visualizando consultivo de ${clientName}`,
    });
  }
}

/**
 * Hook para usar o serviço de clientes
 */
export const useClientService = () => {
  const { toast } = useToast();
  return new ClientService(toast);
};