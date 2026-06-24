import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { FeaturePermissions } from '@/types/permissions';

interface PrivateRouteProps {
  children: React.ReactNode;
  requireRole?: 'user' | 'admin' | 'super_admin';
  requirePermission?: keyof FeaturePermissions;
  requireAnyPermissions?: (keyof FeaturePermissions)[];
  requireAllPermissions?: (keyof FeaturePermissions)[];
}

export const PrivateRoute: React.FC<PrivateRouteProps> = ({ 
  children, 
  requireRole,
  requirePermission,
  requireAnyPermissions,
  requireAllPermissions 
}) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const permissions = usePermissions();
  const location = useLocation();
  const [showTimeout, setShowTimeout] = useState(false);

  // Timeout para evitar carregamento infinito
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowTimeout(true);
    }, 8000); // Aumentado para 8 segundos para dar mais tempo

    return () => clearTimeout(timer);
  }, []);

  // Mostrar loading enquanto verifica autenticação
  if (isLoading && !showTimeout) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="text-sm text-muted-foreground">Verificando autenticação...</p>
        <p className="text-xs text-muted-foreground/60">
          Aguardando resposta do servidor...
        </p>
      </div>
    );
  }

  // Se demorou muito para carregar, redirecionar para login
  if (showTimeout && isLoading) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Se não estiver autenticado, redirecionar para login
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Verificar se o pagamento é necessário (Bloqueio de Trial)
  // Super Admins são ignorados por esta trava
  const { paymentValidation, isSuperAdmin } = useAuth();
  if (paymentValidation?.needsPayment && !isSuperAdmin && location.pathname !== '/pagamento') {
    console.log('⚠️ Acesso bloqueado: Período de teste expirado. Redirecionando para pagamento.');
    return <Navigate to="/pagamento" state={{ from: location }} replace />;
  }

  // Verificar role específico
  if (requireRole && user?.role !== requireRole && user?.role !== 'super_admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-destructive">Acesso Negado</h2>
          <p className="text-muted-foreground mt-2">
            Você não tem permissão para acessar esta página.
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Role necessário: {requireRole}
          </p>
        </div>
      </div>
    );
  }

  // Verificar permissão específica
  if (requirePermission && !permissions[requirePermission]) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-destructive">Acesso Negado</h2>
          <p className="text-muted-foreground mt-2">
            Você não tem permissão para acessar esta funcionalidade.
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Permissão necessária: {requirePermission}
          </p>
        </div>
      </div>
    );
  }

  // Verificar se o usuário tem pelo menos uma das permissões requeridas
  if (requireAnyPermissions && !requireAnyPermissions.some(permission => permissions[permission])) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-destructive">Acesso Negado</h2>
          <p className="text-muted-foreground mt-2">
            Você não tem permissão para acessar esta funcionalidade.
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Permissões necessárias: {requireAnyPermissions.join(' OU ')}
          </p>
        </div>
      </div>
    );
  }

  // Verificar se o usuário tem todas as permissões requeridas
  if (requireAllPermissions && !requireAllPermissions.every(permission => permissions[permission])) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-destructive">Acesso Negado</h2>
          <p className="text-muted-foreground mt-2">
            Você não tem permissão para acessar esta funcionalidade.
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Permissões necessárias: {requireAllPermissions.join(' E ')}
          </p>
        </div>
      </div>
    );
  }

  // Se estiver autenticado e autorizado, renderizar o componente filho
  return <>{children}</>;
};