import { useMemo } from 'react';
import { useAuth, SUPER_ADMIN_EMAILS } from '@/contexts/AuthContext';
import { usePlanFeatures } from './usePlanFeatures';
import { FeaturePermissions } from '@/types/permissions';
import { useMyPermissionOverrides } from './useUserPermissions';

/**
 * Hook para gerenciar permissões granulares baseadas em roles e contexto
 * Substitui o useUserRole para um sistema mais específico
 */
export const usePermissions = (): FeaturePermissions => {
  const { user, isSuperAdmin, isAdmin, isOfficeAdmin, office, officeUser, isLoading, session } = useAuth();
  const planFeatures = usePlanFeatures();
  const { overrides, loaded: overridesLoaded } = useMyPermissionOverrides();

  return useMemo(() => {
    if (isLoading) {
      return createEmptyPermissions();
    }

    const sessionEmail = session?.user?.email?.toLowerCase().trim();

    if (!user && sessionEmail && SUPER_ADMIN_EMAILS.includes(sessionEmail)) {
      return createSuperAdminPermissions();
    }

    if (!user) {
      return createEmptyPermissions();
    }

    let basePermissions: FeaturePermissions;
    if (isSuperAdmin) {
      basePermissions = createSuperAdminPermissions();
    } else if (isAdmin) {
      basePermissions = createAdminPermissions();
    } else if (isOfficeAdmin) {
      basePermissions = createOfficeAdminPermissions();
    } else {
      basePermissions = createUserPermissions();
    }

    const afterPlan = applyPlanRestrictions(basePermissions, planFeatures);

    // Apply per-user overrides (super/global admins are never overridden)
    if (!isSuperAdmin && !isAdmin && overridesLoaded && Object.keys(overrides).length > 0) {
      const finalPermissions = { ...afterPlan };
      for (const [key, granted] of Object.entries(overrides)) {
        if (key in finalPermissions) {
          (finalPermissions as any)[key] = granted;
        }
      }
      return finalPermissions;
    }

    return afterPlan;
  }, [user, isSuperAdmin, isAdmin, isOfficeAdmin, office, officeUser, isLoading, session, planFeatures, overrides, overridesLoaded]);
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
 * Cria permissões vazias (usuário não autenticado)
 */
function createEmptyPermissions(): FeaturePermissions {
  return {
    // Core Features
    canViewDashboard: false,
    canViewClients: false,
    canCreateClients: false,
    canEditClients: false,
    canDeleteClients: false,
    
    // Process Management
    canViewProcesses: false,
    canCreateProcesses: false,
    canEditProcesses: false,
    canDeleteProcesses: false,
    
    // Attendance/Service Management
    canViewAtendimentos: false,
    canCreateAtendimentos: false,
    canEditAtendimentos: false,
    canDeleteAtendimentos: false,
    
    // CRM Features
    canViewCRM: false,
    canManageCRM: false,
    
    // Calendar & Scheduling
    canViewAgenda: false,
    canManageAgenda: false,
    canViewAudiencias: false,
    canManageAudiencias: false,
    
    // Team Management
    canViewEquipe: false,
    canManageEquipe: false,
    
    // Tasks & Deadlines
    canViewTarefas: false,
    canManageTarefas: false,
    canViewPrazos: false,
    canManagePrazos: false,
    
    // Publications & Legal Research
    canViewPublicacoes: false,
    canManagePublicacoes: false,
    canViewConsultivo: false,
    canManageConsultivo: false,
    
    // Analytics & Reports
    canViewGraficos: false,
    canViewAdvancedAnalytics: false,
    
    // Financial
    canViewFinanceiro: false,
    canManageFinanceiro: false,
    
    // Goals & Targets
    canViewMetas: false,
    canManageMetas: false,
    
    // Tags & Organization
    canViewEtiquetas: false,
    canManageEtiquetas: false,
    
    // Notifications
    canViewNotificacoes: false,
    canManageNotificacoes: false,
    
    // Settings & Configuration
    canViewConfiguracoes: false,
    canManageConfiguracoes: false,
    canViewPerfil: false,
    canEditPerfil: false,
    
    // Office Management
    canViewOffice: false,
    canManageOffice: false,
    canInviteUsers: false,
    canManageOfficeUsers: false,
    canManageOfficeSettings: false,
    
    // System Administration
    canViewAdmin: false,
    canManageGlobalSettings: false,
    canManageAllOffices: false,
    canManageSubscriptions: false,
    canViewSystemMetrics: false,
    canManageSystemUsers: false,
  };
}

/**
 * Cria permissões para Super Admin (acesso total)
 */
function createSuperAdminPermissions(): FeaturePermissions {
  return {
    // Core Features
    canViewDashboard: true,
    canViewClients: true,
    canCreateClients: true,
    canEditClients: true,
    canDeleteClients: true,
    
    // Process Management
    canViewProcesses: true,
    canCreateProcesses: true,
    canEditProcesses: true,
    canDeleteProcesses: true,
    
    // Attendance/Service Management
    canViewAtendimentos: true,
    canCreateAtendimentos: true,
    canEditAtendimentos: true,
    canDeleteAtendimentos: true,
    
    // CRM Features
    canViewCRM: true,
    canManageCRM: true,
    
    // Calendar & Scheduling
    canViewAgenda: true,
    canManageAgenda: true,
    canViewAudiencias: true,
    canManageAudiencias: true,
    
    // Team Management
    canViewEquipe: true,
    canManageEquipe: true,
    
    // Tasks & Deadlines
    canViewTarefas: true,
    canManageTarefas: true,
    canViewPrazos: true,
    canManagePrazos: true,
    
    // Publications & Legal Research
    canViewPublicacoes: true,
    canManagePublicacoes: true,
    canViewConsultivo: true,
    canManageConsultivo: true,
    
    // Analytics & Reports
    canViewGraficos: true,
    canViewAdvancedAnalytics: true,
    
    // Financial
    canViewFinanceiro: true,
    canManageFinanceiro: true,
    
    // Goals & Targets
    canViewMetas: true,
    canManageMetas: true,
    
    // Tags & Organization
    canViewEtiquetas: true,
    canManageEtiquetas: true,
    
    // Notifications
    canViewNotificacoes: true,
    canManageNotificacoes: true,
    
    // Settings & Configuration
    canViewConfiguracoes: true,
    canManageConfiguracoes: true,
    canViewPerfil: true,
    canEditPerfil: true,
    
    // Office Management
    canViewOffice: true,
    canManageOffice: true,
    canInviteUsers: true,
    canManageOfficeUsers: true,
    canManageOfficeSettings: true,
    
    // System Administration
    canViewAdmin: true,
    canManageGlobalSettings: true,
    canManageAllOffices: true,
    canManageSubscriptions: true,
    canViewSystemMetrics: true,
    canManageSystemUsers: true,
  };
}

/**
 * Cria permissões para Admin (sem acesso a funcionalidades de super admin)
 */
function createAdminPermissions(): FeaturePermissions {
  return {
    // Core Features
    canViewDashboard: true,
    canViewClients: true,
    canCreateClients: true,
    canEditClients: true,
    canDeleteClients: true,
    
    // Process Management
    canViewProcesses: true,
    canCreateProcesses: true,
    canEditProcesses: true,
    canDeleteProcesses: true,
    
    // Attendance/Service Management
    canViewAtendimentos: true,
    canCreateAtendimentos: true,
    canEditAtendimentos: true,
    canDeleteAtendimentos: true,
    
    // CRM Features
    canViewCRM: true,
    canManageCRM: true,
    
    // Calendar & Scheduling
    canViewAgenda: true,
    canManageAgenda: true,
    canViewAudiencias: true,
    canManageAudiencias: true,
    
    // Team Management
    canViewEquipe: true,
    canManageEquipe: true,
    
    // Tasks & Deadlines
    canViewTarefas: true,
    canManageTarefas: true,
    canViewPrazos: true,
    canManagePrazos: true,
    
    // Publications & Legal Research
    canViewPublicacoes: true,
    canManagePublicacoes: true,
    canViewConsultivo: true,
    canManageConsultivo: true,
    
    // Analytics & Reports
    canViewGraficos: true,
    canViewAdvancedAnalytics: true,
    
    // Financial
    canViewFinanceiro: true,
    canManageFinanceiro: true,
    
    // Goals & Targets
    canViewMetas: true,
    canManageMetas: true,
    
    // Tags & Organization
    canViewEtiquetas: true,
    canManageEtiquetas: true,
    
    // Notifications
    canViewNotificacoes: true,
    canManageNotificacoes: true,
    
    // Settings & Configuration
    canViewConfiguracoes: true,
    canManageConfiguracoes: true,
    canViewPerfil: true,
    canEditPerfil: true,
    
    // Office Management
    canViewOffice: true,
    canManageOffice: true,
    canInviteUsers: true,
    canManageOfficeUsers: true,
    canManageOfficeSettings: true,
    
    // System Administration - Limitado para admin
    canViewAdmin: true,
    canManageGlobalSettings: false,
    canManageAllOffices: false,
    canManageSubscriptions: false,
    canViewSystemMetrics: false,
    canManageSystemUsers: false,
  };
}

/**
 * Cria permissões para Office Admin (gerenciamento de escritório)
 */
function createOfficeAdminPermissions(): FeaturePermissions {
  return {
    // Core Features
    canViewDashboard: true,
    canViewClients: true,
    canCreateClients: true,
    canEditClients: true,
    canDeleteClients: true,
    
    // Process Management
    canViewProcesses: true,
    canCreateProcesses: true,
    canEditProcesses: true,
    canDeleteProcesses: true, // Office admin pode arquivar processos do próprio escritório
    
    // Attendance/Service Management
    canViewAtendimentos: true,
    canCreateAtendimentos: true,
    canEditAtendimentos: true,
    canDeleteAtendimentos: true,
    
    // CRM Features
    canViewCRM: true,
    canManageCRM: true,
    
    // Calendar & Scheduling
    canViewAgenda: true,
    canManageAgenda: true,
    canViewAudiencias: true,
    canManageAudiencias: true,
    
    // Team Management
    canViewEquipe: true,
    canManageEquipe: true,
    
    // Tasks & Deadlines
    canViewTarefas: true,
    canManageTarefas: true,
    canViewPrazos: true,
    canManagePrazos: true,
    
    // Publications & Legal Research
    canViewPublicacoes: true,
    canManagePublicacoes: true,
    canViewConsultivo: true,
    canManageConsultivo: true,
    
    // Analytics & Reports
    canViewGraficos: true,
    canViewAdvancedAnalytics: true,
    
    // Financial
    canViewFinanceiro: true,
    canManageFinanceiro: true,
    
    // Goals & Targets
    canViewMetas: true,
    canManageMetas: true,
    
    // Tags & Organization
    canViewEtiquetas: true,
    canManageEtiquetas: true,
    
    // Notifications
    canViewNotificacoes: true,
    canManageNotificacoes: true,
    
    // Settings & Configuration
    canViewConfiguracoes: true,
    canManageConfiguracoes: true,
    canViewPerfil: true,
    canEditPerfil: true,
    
    // Office Management
    canViewOffice: true,
    canManageOffice: true,
    canInviteUsers: true,
    canManageOfficeUsers: true,
    canManageOfficeSettings: true,
    
    // System Administration - Negado para office admin
    canViewAdmin: false,
    canManageGlobalSettings: false,
    canManageAllOffices: false,
    canManageSubscriptions: false,
    canViewSystemMetrics: false,
    canManageSystemUsers: false,
  };
}

/**
 * Cria permissões para usuário comum
 */
function createUserPermissions(): FeaturePermissions {
  return {
    // Core Features
    canViewDashboard: true,
    canViewClients: true,
    canCreateClients: true,
    canEditClients: true,
    canDeleteClients: false, // Usuário comum não pode excluir
    
    // Process Management
    canViewProcesses: true,
    canCreateProcesses: true,
    canEditProcesses: true,
    canDeleteProcesses: false, // Restrito - apenas admins/escritório
    
    // Attendance/Service Management
    canViewAtendimentos: true,
    canCreateAtendimentos: true,
    canEditAtendimentos: true,
    canDeleteAtendimentos: false, // Usuário comum não pode excluir

    // CRM Features
    canViewCRM: true,
    canManageCRM: false, // Apenas visualização
    
    // Calendar & Scheduling
    canViewAgenda: true,
    canManageAgenda: true,
    canViewAudiencias: true,
    canManageAudiencias: true,
    
    // Team Management
    canViewEquipe: true,
    canManageEquipe: false, // Restrito para usuário comum
    
    // Tasks & Deadlines
    canViewTarefas: true,
    canManageTarefas: true,
    canViewPrazos: true,
    canManagePrazos: true,
    
    // Publications & Legal Research
    canViewPublicacoes: true,
    canManagePublicacoes: false, // Restrito
    canViewConsultivo: true,
    canManageConsultivo: false,
    
    // Analytics & Reports
    canViewGraficos: true,
    canViewAdvancedAnalytics: false, // Restrito para usuário comum
    
    // Financial
    canViewFinanceiro: true,
    canManageFinanceiro: false, // Restrito
    
    // Goals & Targets
    canViewMetas: true,
    canManageMetas: false, // Restrito
    
    // Tags & Organization
    canViewEtiquetas: true,
    canManageEtiquetas: false, // Restrito

    // Notifications
    canViewNotificacoes: true,
    canManageNotificacoes: false, // Apenas visualização
    
    // Settings & Configuration
    canViewConfiguracoes: true,
    canManageConfiguracoes: false, // Apenas visualização
    canViewPerfil: true,
    canEditPerfil: true,
    
    // Office Management - Negado para usuário comum
    canViewOffice: false,
    canManageOffice: false,
    canInviteUsers: false,
    canManageOfficeUsers: false,
    canManageOfficeSettings: false,
    
    // System Administration - Negado para usuário comum
    canViewAdmin: false,
    canManageGlobalSettings: false,
    canManageAllOffices: false,
    canManageSubscriptions: false,
    canViewSystemMetrics: false,
    canManageSystemUsers: false,
  };
}