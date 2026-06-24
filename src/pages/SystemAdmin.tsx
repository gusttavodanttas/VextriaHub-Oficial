import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useSystemAdminAccess } from '@/utils/adminAccess';
import { 
  Shield, 
  LogOut, 
  Home, 
  Settings, 
  CreditCard,
  BarChart3,
  Users,
  Building2,
  Database,
  AlertTriangle
} from 'lucide-react';

const SystemAdmin: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const adminAccess = useSystemAdminAccess(user?.email);

  console.log('🔧 SystemAdmin Access Check:', {
    userEmail: user?.email,
    isSystemAdmin: adminAccess.isSystemAdmin,
    features: adminAccess.features
  });

  // Se não tiver acesso administrativo do sistema, mostrar acesso negado
  if (!adminAccess.isSystemAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="text-center py-12">
            <Shield className="h-12 w-12 mx-auto text-red-500 mb-4" />
            <h3 className="text-xl font-semibold mb-2 text-destructive">Acesso Negado</h3>
            <p className="text-muted-foreground mb-4">
              Você não tem permissão para acessar o painel administrativo do sistema.
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              Email atual: {user?.email || 'Nenhum'}
            </p>
            <div className="space-y-2">
              <Button onClick={() => navigate('/dashboard')} variant="outline" className="w-full">
                Voltar ao Dashboard
              </Button>
              <Button onClick={logout} variant="outline" className="w-full">
                Fazer Logout
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleLogout = async () => {
    await logout();
  };

  const goToDashboard = () => {
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo/Título */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Shield className="h-8 w-8 text-primary" />
                <div>
                  <h1 className="text-xl font-bold text-foreground">Administração do Sistema</h1>
                  <p className="text-xs text-muted-foreground">VextriaHub System Administration</p>
                </div>
              </div>
            </div>

            {/* Info do usuário e ações */}
            <div className="flex items-center space-x-4">
              <div className="hidden md:block text-right">
                <p className="text-sm font-medium text-foreground">
                  {user?.name}
                </p>
                <p className="text-xs text-muted-foreground">Administrador do Sistema</p>
              </div>

              <div className="flex items-center space-x-2">
                <Button onClick={goToDashboard} variant="outline" size="sm">
                  <Home className="h-4 w-4 mr-2" />
                  Dashboard
                </Button>
                <Button onClick={handleLogout} variant="outline" size="sm">
                  <LogOut className="h-4 w-4 mr-2" />
                  Sair
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Cards de Funcionalidades Disponíveis */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Controle de Assinaturas */}
            {adminAccess.canControlSubscriptions && (
              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/system/subscriptions')}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-purple-600" />
                    Controle de Assinaturas
                  </CardTitle>
                  <CardDescription>
                    Gerencie pagamentos e status de acesso dos usuários da plataforma
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Integração Stripe, webhooks e controle manual de pagamentos
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Métricas do Sistema */}
            {adminAccess.canViewSystemMetrics && (
              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/system/metrics')}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-blue-600" />
                    Métricas do Sistema
                  </CardTitle>
                  <CardDescription>
                    Visualize estatísticas e performance da plataforma
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Usage, performance, usuários ativos e relatórios
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Gestão Global de Escritórios */}
            {adminAccess.canManageOfficesGlobally && (
              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/system/offices')}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-green-600" />
                    Gestão de Escritórios
                  </CardTitle>
                  <CardDescription>
                    Controle global de todos os escritórios na plataforma
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Criação, edição e monitoramento de escritórios
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Gestão Global de Usuários */}
            {adminAccess.canManageUsersGlobally && (
              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/system/users')}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-orange-600" />
                    Gestão de Usuários
                  </CardTitle>
                  <CardDescription>
                    Controle global de todos os usuários da plataforma
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Roles, permissões e gerenciamento de contas
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Configurações do Sistema */}
            {adminAccess.canConfigureSystem && (
              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/system/configuration')}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5 text-gray-600" />
                    Configurações
                  </CardTitle>
                  <CardDescription>
                    Configurações avançadas do sistema
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Variáveis de ambiente, integrações e sistema
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Override de Planos */}
            {adminAccess.canOverridePlans && (
              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/system/plan-overrides')}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5 text-red-600" />
                    Override de Planos
                  </CardTitle>
                  <CardDescription>
                    Alterações manuais de planos e limites
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Bypass de limites e concessão de funcionalidades especiais
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Informações do Sistema */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                Informações do Sistema
              </CardTitle>
              <CardDescription>
                Status e informações gerais da plataforma
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h4 className="font-medium mb-2">Acesso Administrativo</h4>
                  <p className="text-sm text-muted-foreground">
                    Este painel é independente do sistema de roles normal da aplicação.
                    O acesso é controlado por uma lista de emails autorizados.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Funcionalidades Disponíveis</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {adminAccess.features.map((feature) => (
                      <li key={feature}>• {feature.replace(/_/g, ' ')}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default SystemAdmin;
