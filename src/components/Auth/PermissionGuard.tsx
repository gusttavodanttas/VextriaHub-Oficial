import React from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { FeaturePermissions } from '@/types/permissions';
import { AlertTriangle, Lock } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface PermissionGuardProps {
  children: React.ReactNode;
  permission?: keyof FeaturePermissions;
  anyPermissions?: (keyof FeaturePermissions)[];
  allPermissions?: (keyof FeaturePermissions)[];
  fallback?: React.ReactNode;
  showDeniedMessage?: boolean;
  deniedMessage?: string;
}

/**
 * Componente para proteger seções específicas baseado em permissões
 * Pode ser usado dentro de páginas para esconder/mostrar elementos
 */
export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  children,
  permission,
  anyPermissions,
  allPermissions,
  fallback,
  showDeniedMessage = false,
  deniedMessage = 'Você não tem permissão para acessar esta funcionalidade.'
}) => {
  const permissions = usePermissions();

  // Verificar permissão específica
  if (permission && !permissions[permission]) {
    return renderFallback();
  }

  // Verificar se o usuário tem pelo menos uma das permissões requeridas
  if (anyPermissions && !anyPermissions.some(perm => permissions[perm])) {
    return renderFallback();
  }

  // Verificar se o usuário tem todas as permissões requeridas
  if (allPermissions && !allPermissions.every(perm => permissions[perm])) {
    return renderFallback();
  }

  // Se passou em todas as verificações, renderizar o conteúdo
  return <>{children}</>;

  function renderFallback() {
    // Se tem um fallback customizado, usar ele
    if (fallback) {
      return <>{fallback}</>;
    }

    // Se deve mostrar mensagem de negação, mostrar
    if (showDeniedMessage) {
      return (
        <Alert variant="destructive">
          <Lock className="h-4 w-4" />
          <AlertDescription>{deniedMessage}</AlertDescription>
        </Alert>
      );
    }

    // Por padrão, não renderizar nada
    return null;
  }
};

/**
 * Hook para verificar permissões de forma programática
 */
export const usePermissionCheck = () => {
  const permissions = usePermissions();

  return {
    hasPermission: (permission: keyof FeaturePermissions) => permissions[permission],
    hasAnyPermission: (permissionList: (keyof FeaturePermissions)[]) => 
      permissionList.some(perm => permissions[perm]),
    hasAllPermissions: (permissionList: (keyof FeaturePermissions)[]) => 
      permissionList.every(perm => permissions[perm]),
    permissions
  };
};

/**
 * Componente para renderizar botões condicionalmente baseado em permissões
 */
interface PermissionButtonProps {
  permission?: keyof FeaturePermissions;
  anyPermissions?: (keyof FeaturePermissions)[];
  allPermissions?: (keyof FeaturePermissions)[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
  disabled?: boolean;
}

export const PermissionButton: React.FC<PermissionButtonProps> = ({
  permission,
  anyPermissions,
  allPermissions,
  children,
  fallback,
  disabled = false
}) => {
  const permissions = usePermissions();
  
  let hasPermission = true;

  // Verificar permissão específica
  if (permission && !permissions[permission]) {
    hasPermission = false;
  }

  // Verificar se o usuário tem pelo menos uma das permissões requeridas
  if (anyPermissions && !anyPermissions.some(perm => permissions[perm])) {
    hasPermission = false;
  }

  // Verificar se o usuário tem todas as permissões requeridas
  if (allPermissions && !allPermissions.every(perm => permissions[perm])) {
    hasPermission = false;
  }

  if (!hasPermission) {
    return fallback ? <>{fallback}</> : null;
  }

  // Clonar o children e adicionar disabled se necessário
  if (React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement, {
      disabled: disabled || !hasPermission
    });
  }

  return <>{children}</>;
};

/**
 * Higher-Order Component para proteger componentes inteiros
 */
export const withPermission = <P extends object>(
  Component: React.ComponentType<P>,
  permission: keyof FeaturePermissions,
  fallback?: React.ReactNode
) => {
  return (props: P) => (
    <PermissionGuard permission={permission} fallback={fallback}>
      <Component {...props} />
    </PermissionGuard>
  );
};

/**
 * Componente para mostrar warnings quando o usuário não tem permissão
 */
interface PermissionWarningProps {
  permission?: keyof FeaturePermissions;
  anyPermissions?: (keyof FeaturePermissions)[];
  allPermissions?: (keyof FeaturePermissions)[];
  title?: string;
  description?: string;
}

export const PermissionWarning: React.FC<PermissionWarningProps> = ({
  permission,
  anyPermissions,
  allPermissions,
  title = 'Acesso Limitado',
  description = 'Você não tem permissão para esta funcionalidade.'
}) => {
  const permissions = usePermissions();

  let hasPermission = true;

  // Verificar permissão específica
  if (permission && !permissions[permission]) {
    hasPermission = false;
  }

  // Verificar se o usuário tem pelo menos uma das permissões requeridas
  if (anyPermissions && !anyPermissions.some(perm => permissions[perm])) {
    hasPermission = false;
  }

  // Verificar se o usuário tem todas as permissões requeridas
  if (allPermissions && !allPermissions.every(perm => permissions[perm])) {
    hasPermission = false;
  }

  if (hasPermission) {
    return null;
  }

  return (
    <Alert>
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription>
        <strong>{title}:</strong> {description}
      </AlertDescription>
    </Alert>
  );
};

// Backwards compatibility - mantém a interface antiga
export const usePermission = (permission: keyof FeaturePermissions) => {
  const permissions = usePermissions();
  return permissions[permission];
};