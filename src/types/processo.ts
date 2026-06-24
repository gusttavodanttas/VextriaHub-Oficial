export interface Processo {
  id: string;
  titulo: string;
  cliente: string;
  clienteId?: string;
  status: 'Em andamento' | 'Concluído' | 'Suspenso';
  dataInicio: string;
  proximoPrazo?: string;
  descricao?: string;
  valorCausa?: number;
  numeroProcesso?: string;
  tipoProcesso?: string;
  faseProcessual?: string;
  classeJudicial?: string;
  assuntoPrincipal?: string;
  instancia?: string;
  responsavelId?: string;
  responsavelNome?: string;
  ultimaMovimentacao?: string; // Data da última movimentação
  // Histórico completo de movimentações (importado via API DataJud/PJe)
  andamentos?: Array<{
      descricao: string;
      data: string | null;
      fase?: string;
  }>;
  observacoes?: string;
  area?: string; // Área jurídica do processo
  tribunal?: string;
  vara?: string;
  comarca?: string;
  parteAutora?: string;
  requerido?: string; // Parte contrária (polo passivo)
  segredoJustica?: boolean;
  justicaGratuita?: boolean;
  fonteSincronizacao?: string;
  sincronizadoEm?: string;
}

export interface NovoProcessoForm {
  titulo: string;
  cliente: string;
  clienteId?: string;
  status: 'Em andamento' | 'Concluído' | 'Suspenso';
  proximoPrazo?: string;
  descricao?: string;
  valorCausa?: number;
  numeroProcesso?: string;
  tipoProcesso?: string;
  faseProcessual?: string;
  responsavelId?: string;
  tribunal?: string;
  vara?: string;
  comarca?: string;
  requerido?: string;
  segredoJustica?: boolean;
  justicaGratuita?: boolean;
}

export const fasesProcessuais = [
  'Fase Inicial',
  'Fase Instrutória',
  'Fase de Julgamento',
  'Fase Recursal',
  'Fase de Execução'
];

export interface ProcessoFilters {
  search: string;
  status: string;
  cliente: string;
  numeroProcesso: string;
  area: string;
  movimentacao: string; // '7dias', '15dias', 'all'
}

// Dados de exemplo para novos usuários
export const processosExemplo: Processo[] = [
  {
    id: '1',
    titulo: 'Ação Trabalhista - Maria Silva',
    cliente: 'Maria Silva',
    clienteId: '1',
    status: 'Em andamento',
    dataInicio: '2025-01-15',
    proximoPrazo: '2025-02-15',
    descricao: 'Ação trabalhista por rescisão indireta contra antiga empresa.',
    valorCausa: 50000,
    numeroProcesso: '5001234-12.2025.5.02.0001',
    tipoProcesso: 'Trabalhista',
    area: 'Trabalhista',
    ultimaMovimentacao: '2025-01-20'
  },
  {
    id: '2',
    titulo: 'Divórcio Consensual - João Santos',
    cliente: 'João Santos',
    clienteId: '2',
    status: 'Em andamento',
    dataInicio: '2025-01-20',
    proximoPrazo: '2025-02-20',
    descricao: 'Processo de divórcio consensual com partilha de bens.',
    valorCausa: 200000,
    numeroProcesso: '1001234-12.2025.8.26.0001',
    tipoProcesso: 'Família',
    area: 'Família',
    ultimaMovimentacao: '2025-01-18'
  },
  {
    id: '3',
    titulo: 'Cobrança - Tech Solutions Ltda',
    cliente: 'Tech Solutions Ltda',
    clienteId: '3',
    status: 'Concluído',
    dataInicio: '2023-12-01',
    proximoPrazo: '',
    descricao: 'Ação de cobrança de serviços prestados.',
    valorCausa: 15000,
    numeroProcesso: '1001234-12.2023.8.26.0002',
    tipoProcesso: 'Cível',
    area: 'Cível',
    ultimaMovimentacao: '2025-01-10'
  }
];

export const tiposProcesso = [
  'Trabalhista',
  'Cível',
  'Criminal',
  'Família',
  'Empresarial',
  'Tributário',
  'Previdenciário',
  'Consumidor'
];

export const areasJuridicas = [
  'Trabalhista',
  'Cível',
  'Criminal',
  'Família',
  'Empresarial',
  'Tributário',
  'Previdenciário',
  'Consumidor',
  'Administrativo',
  'Constitucional'
];

export const statusProcesso = [
  'Em andamento',
  'Concluído', 
  'Suspenso'
] as const;
