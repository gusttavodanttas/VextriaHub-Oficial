import { useAuth } from "@/contexts/AuthContext";

// Hook para determinar se deve usar dados mockados ou vazios
export const useInitialData = () => {
  const { isFirstLogin } = useAuth();
  
  // Para novos usuários, sempre retorna dados vazios
  // Para usuários existentes ou em desenvolvimento, retorna dados mockados
  return {
    shouldUseMockData: !isFirstLogin,
    isNewUser: isFirstLogin
  };
};

// Função para obter dados iniciais baseado no tipo de usuário
export const getInitialData = <T>(mockData: T[], isFirstLogin: boolean): T[] => {
  return isFirstLogin ? [] : mockData;
};

// Dados mockados de exemplo
export const initialClientsData: any[] = [
  {
    id: 1,
    nome: "João Silva",
    email: "joao.silva@email.com",
    telefone: "(11) 99999-9999",
    cpf: "123.456.789-00",
    endereco: "Rua das Flores, 123",
    cidade: "São Paulo",
    estado: "SP",
    cep: "01234-567"
  },
  {
    id: 2,
    nome: "Maria Santos",
    email: "maria.santos@email.com",
    telefone: "(11) 88888-8888",
    cpf: "987.654.321-00",
    endereco: "Av. Principal, 456",
    cidade: "São Paulo",
    estado: "SP",
    cep: "01234-890"
  }
];

export const initialProcessosData: any[] = [
  {
    id: "0001234-56.2025.8.26.0100",
    titulo: "Ação de Cobrança - João Silva",
    cliente: "João Silva",
    clienteId: 1,
    status: "Em Andamento",
    ultimaAtualizacao: "2025-01-15",
    proximoPrazo: "2025-01-30",
    etiquetas: ["urgente", "civel"],
    arquivado: false,
    descricao: "Ação de cobrança de valores em atraso",
    tipoProcesso: "Cível",
    valorCausa: "R$ 50.000,00"
  },
  {
    id: "0005678-90.2025.5.02.0001",
    titulo: "Reclamação Trabalhista - Maria Santos",
    cliente: "Maria Santos",
    clienteId: 2,
    status: "Aguardando Audiência",
    ultimaAtualizacao: "2025-01-10",
    proximoPrazo: "2025-02-15",
    etiquetas: ["trabalhista", "audiencia"],
    arquivado: false,
    descricao: "Reclamação trabalhista por verbas rescisórias",
    tipoProcesso: "Trabalhista",
    valorCausa: "R$ 25.000,00"
  },
  {
    id: "0009876-54.2023.8.26.0100",
    titulo: "Processo Arquivado - Exemplo",
    cliente: "João Silva",
    clienteId: 1,
    status: "Finalizado",
    ultimaAtualizacao: "2023-12-20",
    proximoPrazo: "",
    etiquetas: ["finalizado"],
    arquivado: true,
    dataArquivamento: "2023-12-20T10:00:00.000Z",
    motivoArquivamento: "Processo finalizado com êxito",
    descricao: "Processo finalizado com sucesso",
    tipoProcesso: "Cível",
    valorCausa: "R$ 10.000,00"
  }
];

export const initialAtendimentosData: any[] = [];