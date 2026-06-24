/**
 * Sistema de Acesso Administrativo Isolado
 * 
 * Este sistema gerencia acesso a funcionalidades administrativas especiais
 * baseado em uma lista de emails autorizados, independente do sistema de roles.
 * 
 * Usado para funcionalidades que anteriormente eram de super_admin
 */

// Lista de emails com acesso administrativo especial
const SYSTEM_ADMIN_EMAILS = [
  'contato@vextriahub.com.br',
  '1266jp@gmail.com',
  'joao.pedro@vextriahub.com.br'
];

// Funcionalidades administrativas disponíveis
export type SystemAdminFeature = 
  | 'subscriptions_control'
  | 'system_metrics'
  | 'office_management_global'
  | 'user_management_global'
  | 'plan_overrides'
  | 'system_configuration';

// Configuração de funcionalidades por email (para futura expansão)
const FEATURE_ACCESS: Record<string, SystemAdminFeature[]> = {
  'contato@vextriahub.com.br': [
    'subscriptions_control',
    'system_metrics', 
    'office_management_global',
    'user_management_global',
    'plan_overrides',
    'system_configuration'
  ],
  '1266jp@gmail.com': [
    'subscriptions_control',
    'system_metrics',
    'office_management_global',
    'user_management_global',
    'plan_overrides',
    'system_configuration'
  ],
  'joao.pedro@vextriahub.com.br': [
    'subscriptions_control',
    'system_metrics',
    'office_management_global',
    'user_management_global'
  ]
};

/**
 * Verifica se um email tem acesso administrativo do sistema
 */
export function isSystemAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return SYSTEM_ADMIN_EMAILS.includes(email.toLowerCase());
}

/**
 * Verifica se um email tem acesso a uma funcionalidade específica
 */
export function hasSystemAdminFeature(
  email: string | null | undefined, 
  feature: SystemAdminFeature
): boolean {
  if (!email) return false;
  
  const emailLower = email.toLowerCase();
  const features = FEATURE_ACCESS[emailLower] || [];
  
  return features.includes(feature);
}

/**
 * Retorna todas as funcionalidades disponíveis para um email
 */
export function getSystemAdminFeatures(email: string | null | undefined): SystemAdminFeature[] {
  if (!email) return [];
  
  const emailLower = email.toLowerCase();
  return FEATURE_ACCESS[emailLower] || [];
}

/**
 * Hook para verificação de acesso administrativo
 * Para ser usado em componentes React
 */
export function useSystemAdminAccess(email: string | null | undefined) {
  const isAdmin = isSystemAdmin(email);
  const features = getSystemAdminFeatures(email);
  
  return {
    isSystemAdmin: isAdmin,
    features,
    hasFeature: (feature: SystemAdminFeature) => hasSystemAdminFeature(email, feature),
    
    // Funcionalidades específicas para facilitar uso
    canControlSubscriptions: hasSystemAdminFeature(email, 'subscriptions_control'),
    canViewSystemMetrics: hasSystemAdminFeature(email, 'system_metrics'),
    canManageOfficesGlobally: hasSystemAdminFeature(email, 'office_management_global'),
    canManageUsersGlobally: hasSystemAdminFeature(email, 'user_management_global'),
    canOverridePlans: hasSystemAdminFeature(email, 'plan_overrides'),
    canConfigureSystem: hasSystemAdminFeature(email, 'system_configuration')
  };
}

/**
 * Utilitário para debug - listar todos os emails e funcionalidades
 */
export function debugSystemAdminAccess() {
  console.log('🔧 System Admin Configuration:', {
    emails: SYSTEM_ADMIN_EMAILS,
    features: FEATURE_ACCESS
  });
  
  return {
    emails: SYSTEM_ADMIN_EMAILS,
    features: FEATURE_ACCESS
  };
} 