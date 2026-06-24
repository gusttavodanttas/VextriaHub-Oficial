# Sistema de Permissões VextriaHub

## Visão Geral

O VextriaHub implementa um sistema de permissões granular que permite controlar o acesso a funcionalidades específicas baseado no role do usuário e contexto organizacional.

## Arquitetura

### 1. Tipos de Permissões (`/src/types/permissions.ts`)

```typescript
interface FeaturePermissions {
  // Core Features
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
  
  // ... outras permissões
}
```

### 2. Hook de Permissões (`/src/hooks/usePermissions.tsx`)

O hook principal que calcula as permissões baseado no role do usuário:

```typescript
const permissions = usePermissions();
// Retorna objeto com todas as permissões do usuário atual
```

### 3. Componentes de Proteção

#### PrivateRoute - Proteção de Rotas
```typescript
// Proteção por permissão específica
<PrivateRoute requirePermission="canViewAdmin">
  <AdminPage />
</PrivateRoute>

// Proteção por qualquer uma das permissões
<PrivateRoute requireAnyPermissions={['canViewClients', 'canCreateClients']}>
  <ClientsPage />
</PrivateRoute>

// Proteção por todas as permissões
<PrivateRoute requireAllPermissions={['canViewAdmin', 'canManageOffice']}>
  <SuperAdminPage />
</PrivateRoute>
```

#### PermissionGuard - Proteção de Seções
```typescript
// Esconder seção se não tiver permissão
<PermissionGuard permission="canDeleteClients">
  <DeleteButton />
</PermissionGuard>

// Mostrar fallback se não tiver permissão
<PermissionGuard 
  permission="canViewAdvancedAnalytics"
  fallback={<BasicAnalytics />}
>
  <AdvancedAnalytics />
</PermissionGuard>

// Mostrar mensagem de erro
<PermissionGuard 
  permission="canManageOffice"
  showDeniedMessage={true}
  deniedMessage="Apenas administradores podem acessar esta seção"
>
  <OfficeSettings />
</PermissionGuard>
```

#### PermissionButton - Botões Condicionais
```typescript
// Botão que aparece apenas se tiver permissão
<PermissionButton permission="canCreateClients">
  <Button>Novo Cliente</Button>
</PermissionButton>

// Botão desabilitado se não tiver permissão
<PermissionButton 
  permission="canDeleteClients"
  fallback={<Button disabled>Excluir (Sem Permissão)</Button>}
>
  <Button variant="destructive">Excluir</Button>
</PermissionButton>
```

## Roles e Permissões

### Super Admin (`super_admin`)
- ✅ Todas as permissões
- ✅ Acesso a configurações globais
- ✅ Gerenciamento de todos os escritórios
- ✅ Gerenciamento de assinaturas

### Admin (`admin`)
- ✅ Permissões administrativas limitadas
- ✅ Acesso a funcionalidades avançadas
- ❌ Não pode gerenciar configurações globais
- ❌ Não pode gerenciar outros escritórios

### Office Admin (`office_admin`)
- ✅ Gerenciamento completo do escritório
- ✅ Convite e gerenciamento de usuários
- ✅ Configurações do escritório
- ❌ Não pode excluir processos
- ❌ Não tem acesso administrativo global

### User (`user`)
- ✅ Funcionalidades básicas (visualizar, criar, editar)
- ❌ Não pode excluir registros importantes
- ❌ Apenas visualização de relatórios
- ❌ Não pode gerenciar configurações

## Exemplos de Uso

### 1. Proteger uma Página Inteira
```typescript
// Em App.tsx
<Route path="/admin" element={
  <PrivateRoute requirePermission="canViewAdmin">
    <AdminPage />
  </PrivateRoute>
} />
```

### 2. Proteger Seções dentro de uma Página
```typescript
// Em uma página qualquer
import { PermissionGuard } from '@/components/Auth/PermissionGuard';

function ClientsPage() {
  return (
    <div>
      <h1>Clientes</h1>
      
      {/* Botão de criar só aparece se tiver permissão */}
      <PermissionGuard permission="canCreateClients">
        <Button>Novo Cliente</Button>
      </PermissionGuard>
      
      {/* Lista sempre visível */}
      <ClientsList />
      
      {/* Botão de excluir só aparece para admins */}
      <PermissionGuard permission="canDeleteClients">
        <Button variant="destructive">Excluir Selecionados</Button>
      </PermissionGuard>
    </div>
  );
}
```

### 3. Verificação Programática
```typescript
import { usePermissionCheck } from '@/components/Auth/PermissionGuard';

function MyComponent() {
  const { hasPermission, hasAnyPermission } = usePermissionCheck();
  
  const canDelete = hasPermission('canDeleteClients');
  const canManage = hasAnyPermission(['canEditClients', 'canDeleteClients']);
  
  return (
    <div>
      {canDelete && <DeleteButton />}
      {canManage && <ManageButton />}
    </div>
  );
}
```

### 4. HOC para Componentes
```typescript
import { withPermission } from '@/components/Auth/PermissionGuard';

const AdminPanel = () => <div>Admin Panel</div>;

// Componente protegido
const ProtectedAdminPanel = withPermission(
  AdminPanel, 
  'canViewAdmin',
  <div>Acesso negado</div>
);
```

## Migração do Sistema Antigo

### Antes (useUserRole)
```typescript
const { canViewAdminFeatures, canManageOffice } = useUserRole();
```

### Depois (usePermissions)
```typescript
const { canViewAdmin, canManageOffice } = usePermissions();
```

### Compatibilidade
O sistema mantém compatibilidade com o hook `usePermission` anterior:
```typescript
// Ainda funciona
const canView = usePermission('canViewAdmin');
```

## Boas Práticas

1. **Use PrivateRoute para páginas inteiras**
2. **Use PermissionGuard para seções dentro das páginas**
3. **Use PermissionButton para botões condicionais**
4. **Use usePermissionCheck para lógica complexa**
5. **Sempre forneça fallbacks apropriados**
6. **Teste todas as combinações de roles**

## Debugging

Para debug, você pode acessar todas as permissões:
```typescript
const permissions = usePermissions();
console.log('Permissões do usuário:', permissions);
```

## Adicionando Novas Permissões

1. Adicione a permissão em `FeaturePermissions` interface
2. Adicione a definição em `PERMISSION_DEFINITIONS`
3. Implemente a lógica nos métodos `create*Permissions()`
4. Teste com diferentes roles
5. Documente a nova permissão

## Considerações de Performance

- O hook `usePermissions` é memoizado
- Permissões são calculadas apenas quando auth state muda
- Use `PermissionGuard` para evitar renderizações desnecessárias

## Segurança

- ⚠️ **Importante**: Esse sistema é apenas para UX
- Sempre valide permissões no backend
- Nunca confie apenas no frontend para segurança
- Use RLS (Row Level Security) no Supabase