export interface Permission {
  id: string;
  name: string;
  description: string;
  category: 'core' | 'admin' | 'office' | 'advanced';
}

export interface FeaturePermissions {
  // Core Features - Available to all authenticated users
  canViewDashboard: boolean;
  canViewClients: boolean;
  canCreateClients: boolean;
  canEditClients: boolean;
  canDeleteClients: boolean;
  
  // Process Management
  canViewProcesses: boolean;
  canCreateProcesses: boolean;
  canEditProcesses: boolean;
  canDeleteProcesses: boolean;
  
  // Attendance/Service Management
  canViewAtendimentos: boolean;
  canCreateAtendimentos: boolean;
  canEditAtendimentos: boolean;
  canDeleteAtendimentos: boolean;
  
  // CRM Features
  canViewCRM: boolean;
  canManageCRM: boolean;
  
  // Calendar & Scheduling
  canViewAgenda: boolean;
  canManageAgenda: boolean;
  canViewAudiencias: boolean;
  canManageAudiencias: boolean;
  
  // Team Management
  canViewEquipe: boolean;
  canManageEquipe: boolean;
  
  // Tasks & Deadlines
  canViewTarefas: boolean;
  canManageTarefas: boolean;
  canViewPrazos: boolean;
  canManagePrazos: boolean;
  
  // Publications & Legal Research
  canViewPublicacoes: boolean;
  canManagePublicacoes: boolean;
  canViewConsultivo: boolean;
  canManageConsultivo: boolean;
  
  // Analytics & Reports
  canViewGraficos: boolean;
  canViewAdvancedAnalytics: boolean;
  
  // Financial
  canViewFinanceiro: boolean;
  canManageFinanceiro: boolean;
  
  // Goals & Targets
  canViewMetas: boolean;
  canManageMetas: boolean;
  
  // Tags & Organization
  canViewEtiquetas: boolean;
  canManageEtiquetas: boolean;
  
  // Notifications
  canViewNotificacoes: boolean;
  canManageNotificacoes: boolean;
  
  // Settings & Configuration
  canViewConfiguracoes: boolean;
  canManageConfiguracoes: boolean;
  canViewPerfil: boolean;
  canEditPerfil: boolean;
  
  // Office Management
  canViewOffice: boolean;
  canManageOffice: boolean;
  canInviteUsers: boolean;
  canManageOfficeUsers: boolean;
  canManageOfficeSettings: boolean;
  
  // System Administration
  canViewAdmin: boolean;
  canManageGlobalSettings: boolean;
  canManageAllOffices: boolean;
  canManageSubscriptions: boolean;
  canViewSystemMetrics: boolean;
  canManageSystemUsers: boolean;
}

export const PERMISSION_DEFINITIONS: Permission[] = [
  // Core Features
  { id: 'canViewDashboard', name: 'Ver Dashboard', description: 'Visualizar painel principal', category: 'core' },
  { id: 'canViewClients', name: 'Ver Clientes', description: 'Visualizar lista de clientes', category: 'core' },
  { id: 'canCreateClients', name: 'Criar Clientes', description: 'Cadastrar novos clientes', category: 'core' },
  { id: 'canEditClients', name: 'Editar Clientes', description: 'Modificar dados dos clientes', category: 'core' },
  { id: 'canDeleteClients', name: 'Excluir Clientes', description: 'Remover clientes do sistema', category: 'core' },
  
  // Process Management
  { id: 'canViewProcesses', name: 'Ver Processos', description: 'Visualizar processos jurídicos', category: 'core' },
  { id: 'canCreateProcesses', name: 'Criar Processos', description: 'Cadastrar novos processos', category: 'core' },
  { id: 'canEditProcesses', name: 'Editar Processos', description: 'Modificar dados dos processos', category: 'core' },
  { id: 'canDeleteProcesses', name: 'Excluir Processos', description: 'Remover processos do sistema', category: 'advanced' },
  
  // Office Management
  { id: 'canViewOffice', name: 'Ver Escritório', description: 'Visualizar dados do escritório', category: 'office' },
  { id: 'canManageOffice', name: 'Gerenciar Escritório', description: 'Configurar e administrar escritório', category: 'office' },
  { id: 'canInviteUsers', name: 'Convidar Usuários', description: 'Enviar convites para novos usuários', category: 'office' },
  { id: 'canManageOfficeUsers', name: 'Gerenciar Usuários', description: 'Administrar usuários do escritório', category: 'office' },
  
  // System Administration
  { id: 'canViewAdmin', name: 'Ver Administração', description: 'Acessar área administrativa', category: 'admin' },
  { id: 'canManageGlobalSettings', name: 'Configurações Globais', description: 'Gerenciar configurações do sistema', category: 'admin' },
  { id: 'canManageAllOffices', name: 'Gerenciar Todos Escritórios', description: 'Administrar todos os escritórios', category: 'admin' },
  { id: 'canManageSubscriptions', name: 'Gerenciar Assinaturas', description: 'Controlar planos e assinaturas', category: 'admin' },
  { id: 'canViewSystemMetrics', name: 'Métricas do Sistema', description: 'Visualizar métricas globais', category: 'admin' },
  { id: 'canManageSystemUsers', name: 'Gerenciar Usuários Globais', description: 'Administrar todos os usuários', category: 'admin' },
];