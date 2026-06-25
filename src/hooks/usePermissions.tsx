import { useMemo } from 'react';
import { useAuth, SUPER_ADMIN_EMAILS } from '@/contexts/AuthContext';
import { usePlanFeatures } from './usePlanFeatures';
import { FeaturePermissions } from '@/types/permissions';

/**
 * Hook para gerenciar permissões granulares baseadas em roles e contexto
 * Substitui o useUserRole para um sistema mais específico
 */
export const usePermissions = (): FeaturePermissions => {
  const { user, isSuperAdmin, isAdmin, isOfficeAdmin, office, officeUser, isLoading, session } = useAuth();
  const planFeatures = usePlanFeatures();

  return useMemo(() => {
    if (isLoading) {
      return createEmptyPermissions();
    }

    const sessionEmail = session?.user?.email?.toLowerCase().trim();

    if (!user && sessionEmail && SUPER_ADMIN_EMAILS.includes(sessionEmail)) {
      return applyPlanRestrictions(createSuperAdminPermissions(), planFeatures);
    }

    if (!user) {
      return createEmptyPermissions();
    }

    // Fase 1: DRY role-based permissions using helper
    const basePermissions = getBasePermissionsForRole(isSuperAdmin, isAdmin, isOfficeAdmin);

    return applyPlanRestrictions(basePermissions, planFeatures);
  }, [user, isSuperAdmin, isAdmin, isOfficeAdmin, office, officeUser, isLoading, session, planFeatures]);
};

/**
 * Aplica restrições do plano contratado sobre as permissões baseadas em role
 */
function applyPlanRestrictions(permissions: FeaturePermissions, plan: any): FeaturePermissions {
  return {
    ...permissions,
    // Restrições de Plano (Módulos Específicos)
    canViewFinanceiro: permissions.canViewFinanceiro && plan.hasFinancialModule,
    canManageFinanceiro: permissions.canManageFinanceiro && plan.hasFinancialModule,
    
    canViewMetas: permissions.canViewMetas && plan.hasGoalsModule,
    canManageMetas: permissions.canManageMetas && plan.hasGoalsModule,
    
    // IA é tratada separadamente como hasIAModule
    canViewCRM: permissions.canViewCRM && true, // CRM básico em todos os planos
    
    canViewAdvancedAnalytics: permissions.canViewAdvancedAnalytics && plan.hasAdvancedReports,
    
    // Suporte prioritário e outros recursos podem ser checados diretamente nos componentes
  };
}

/**
 * Fase 1 refactor: Single source of truth for base permissions by role level.
 * Much less duplication.
 */
function getBasePermissionsForRole(isSuperAdmin: boolean, isAdmin: boolean, isOfficeAdmin: boolean): FeaturePermissions {
  const isUser = !isSuperAdmin && !isAdmin && !isOfficeAdmin;

  const p: FeaturePermissions = {
    // Core Features
    canViewDashboard: true,
    canViewClients: true,
    canCreateClients: true,
    canEditClients: true,
    canDeleteClients: !isUser,

    // Process Management
    canViewProcesses: true,
    canCreateProcesses: true,
    canEditProcesses: true,
    canDeleteProcesses: isSuperAdmin || isAdmin || isOfficeAdmin,

    // Attendance/Service Management
    canViewAtendimentos: true,
    canCreateAtendimentos: true,
    canEditAtendimentos: true,
    canDeleteAtendimentos: !isUser,

    // CRM Features
    canViewCRM: true,
    canManageCRM: !isUser,

    // Calendar & Scheduling
    canViewAgenda: true,
    canManageAgenda: true,
    canViewAudiencias: true,
    canManageAudiencias: true,

    // Team Management
    canViewEquipe: true,
    canManageEquipe: !isUser,

    // Tasks & Deadlines
    canViewTarefas: true,
    canManageTarefas: true,
    canViewPrazos: true,
    canManagePrazos: true,

    // Publications & Legal Research
    canViewPublicacoes: true,
    canManagePublicacoes: !isUser,
    canViewConsultivo: true,
    canManageConsultivo: !isUser,

    // Analytics & Reports
    canViewGraficos: true,
    canViewAdvancedAnalytics: !isUser,

    // Financial
    canViewFinanceiro: true,
    canManageFinanceiro: !isUser,

    // Goals & Targets
    canViewMetas: true,
    canManageMetas: !isUser,

    // Tags & Organization
    canViewEtiquetas: true,
    canManageEtiquetas: !isUser,

    // Notifications
    canViewNotificacoes: true,
    canManageNotificacoes: !isUser,

    // Settings & Configuration
    canViewConfiguracoes: true,
    canManageConfiguracoes: !isUser,
    canViewPerfil: true,
    canEditPerfil: true,

    // Office Management
    canViewOffice: isSuperAdmin || isAdmin || isOfficeAdmin,
    canManageOffice: isSuperAdmin || isAdmin || isOfficeAdmin,
    canInviteUsers: isSuperAdmin || isAdmin || isOfficeAdmin,
    canManageOfficeUsers: isSuperAdmin || isAdmin || isOfficeAdmin,
    canManageOfficeSettings: isSuperAdmin || isAdmin || isOfficeAdmin,

    // System Administration
    canViewAdmin: isSuperAdmin || isAdmin,
    canManageGlobalSettings: isSuperAdmin,
    canManageAllOffices: isSuperAdmin,
    canManageSubscriptions: isSuperAdmin,
    canViewSystemMetrics: isSuperAdmin,
    canManageSystemUsers: isSuperAdmin,
  };

  // For empty (no user)
  if (!isSuperAdmin && !isAdmin && !isOfficeAdmin && !true /* will be overridden by caller for no user */) {
    // Handled in caller
  }

  return p;
}

function createEmptyPermissions(): FeaturePermissions {
  const p = getBasePermissionsForRole(false, false, false);
  // Force all to false for unauthenticated
  Object.keys(p).forEach(k => (p as any)[k] = false);
  return p;
}

function createSuperAdminPermissions(): FeaturePermissions {
  return getBasePermissionsForRole(true, false, false);
}

function createAdminPermissions(): FeaturePermissions {
  return getBasePermissionsForRole(false, true, false);
}

function createOfficeAdminPermissions(): FeaturePermissions {
  return getBasePermissionsForRole(false, false, true);
}

function createUserPermissions(): FeaturePermissions {
  return getBasePermissionsForRole(false, false, false);
}