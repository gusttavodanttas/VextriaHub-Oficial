import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook para verificar privilégios do usuário
 */
export const useUserRole = () => {
  const { user, isSuperAdmin, isAdmin, isOfficeAdmin, isFirstLogin, office, officeUser, isLoading } = useAuth();

  return useMemo(() => {
    const shouldShowExampleData = isSuperAdmin || !isFirstLogin;
    const shouldShowEmptyState = !isSuperAdmin && isFirstLogin;

    return {
      user,
      office,
      officeUser,
      isLoading,
      // Roles básicos
      isSuperAdmin,
      isAdmin,
      isOfficeAdmin,
      isNormalUser: user?.role === 'user' && !isOfficeAdmin,
      
      // Permissões específicas
      // Alinhado com FeaturePermissions (usePermissions.tsx): as 3 tiers com
      // direitos administrativos (super_admin, admin global, office_admin)
      // sempre incluem isAdmin, senão um admin global (role='admin' sem
      // office_role='admin'/'owner') perdia acesso a telas gated por
      // canManageOffice que o restante do app já libera para ele.
      canViewAdminFeatures: isSuperAdmin || isAdmin,
      canManageOffice: isSuperAdmin || isAdmin || isOfficeAdmin,
      canManageUsers: isSuperAdmin || isAdmin || isOfficeAdmin,
      canManageSubscriptions: isSuperAdmin,
      canInviteUsers: isSuperAdmin || isAdmin || isOfficeAdmin,
      canViewAllOffices: isSuperAdmin,
      canCreateOffices: isSuperAdmin,
      
      // Estados da UI
      shouldShowExampleData,
      shouldShowEmptyState,
      hasOffice: !!office,
      needsOfficeSetup: !office && !isSuperAdmin,
    };
  }, [user, isSuperAdmin, isAdmin, isOfficeAdmin, isFirstLogin, office, officeUser, isLoading]);
};