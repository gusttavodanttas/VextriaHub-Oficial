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
      canViewAdminFeatures: isSuperAdmin || isAdmin,
      canManageOffice: isOfficeAdmin || isSuperAdmin,
      canManageUsers: isOfficeAdmin || isSuperAdmin,
      canManageSubscriptions: isSuperAdmin,
      canInviteUsers: isOfficeAdmin || isSuperAdmin,
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