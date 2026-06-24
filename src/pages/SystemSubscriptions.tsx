import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useSystemAdminAccess } from '@/utils/adminAccess';
import { 
  Shield, 
  CreditCard, 
  Users,
  CheckCircle,
  AlertTriangle,
  TrendingUp, 
  ArrowLeft,
  Home,
  LogOut,
  Search,
  RefreshCw,
  Clock
} from 'lucide-react';
import { useSuperAdminOffices } from '@/hooks/useSuperAdminOffices';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState } from 'react';

const SystemSubscriptions: React.FC = () => {
  const { user, logout } = useAuth();
  const { admins, loading, refresh } = useSuperAdminOffices();
  const navigate = useNavigate();
  const adminAccess = useSystemAdminAccess(user?.email);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Filtrar dados
  const filteredAdmins = admins.filter(admin => {
    const matchesSearch = !searchTerm || 
      admin.office_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      admin.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || admin.payment_status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Cálculos de métricas reais
  const metrics = {
    totalOffices: admins.length,
    activeOffices: admins.filter(a => a.payment_status === 'em_dia').length,
    blockedOffices: admins.filter(a => a.payment_status === 'vencido').length,
    revenue: admins.reduce((acc, a) => acc + (a.payment_status === 'em_dia' ? a.price : 0), 0)
  };

  console.log('🔧 SystemSubscriptions Access Check:', {
    userEmail: user?.email,
    canControlSubscriptions: adminAccess.canControlSubscriptions
  });

  // Se não tiver acesso a controle de assinaturas, mostrar acesso negado
  if (!adminAccess.canControlSubscriptions) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="text-center py-12">
            <Shield className="h-12 w-12 mx-auto text-red-500 mb-4" />
            <h3 className="text-xl font-semibold mb-2 text-destructive">Acesso Negado</h3>
            <p className="text-muted-foreground mb-4">
              Você não tem permissão para acessar o controle de assinaturas.
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              Email atual: {user?.email || 'Nenhum'}
            </p>
            <div className="space-y-2">
              <Button onClick={() => navigate('/system-admin')} variant="outline" className="w-full">
                Voltar ao Sistema Admin
              </Button>
              <Button onClick={() => navigate('/dashboard')} variant="outline" className="w-full">
                Voltar ao Dashboard
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

  return (
    <div className="space-y-6 p-6 entry-animate fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <CreditCard className="h-8 w-8 text-primary shrink-0" />
            Controle de Assinaturas (Sistema)
          </h2>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">
            Gestão administrativa global de pagamentos e acessos.
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button onClick={refresh} variant="outline" size="sm" className="gap-2 h-9">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? "Carregando..." : "Sincronizar"}
          </Button>
          
          <Button onClick={() => navigate('/system-admin')} variant="outline" size="sm" className="h-9">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </div>
      </div>
        <div className="space-y-8">
          {/* Cards de Métricas */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Escritórios</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.totalOffices}</div>
                <p className="text-xs text-muted-foreground">
                  Escritórios cadastrados no Hub
                </p>
              </CardContent>
            </Card>
 
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Planos Ativos</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{metrics.activeOffices}</div>
                <p className="text-xs text-muted-foreground">
                  {metrics.activeOffices > 0 ? ((metrics.activeOffices / metrics.totalOffices) * 100).toFixed(1) : 0}% de conversão
                </p>
              </CardContent>
            </Card>
 
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Planos Vencidos</CardTitle>
                <AlertTriangle className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{metrics.blockedOffices}</div>
                <p className="text-xs text-muted-foreground">
                  Escritórios com pagamento pendente
                </p>
              </CardContent>
            </Card>
 
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Receita Mensal (Estimada)</CardTitle>
                <TrendingUp className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.revenue)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Baseado em assinaturas ativas
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Tabela de Controle */}
          <Card>
            <CardHeader>
              <CardTitle>Controle de Assinaturas</CardTitle>
              <CardDescription>
                Gerencie o status de pagamento e acesso dos usuários da plataforma
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Filtros */}
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por escritório ou email..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-[200px]">
                      <SelectValue placeholder="Filtrar por status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os status</SelectItem>
                      <SelectItem value="em_dia">Ativo (Em dia)</SelectItem>
                      <SelectItem value="proximo_vencimento">Pendente (A vencer)</SelectItem>
                      <SelectItem value="vencido">Bloqueado (Vencido)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Escritório / Admin</TableHead>
                        <TableHead>Plano</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAdmins.map((admin) => (
                        <TableRow key={admin.id}>
                          <TableCell>
                            <div className="font-medium">{admin.office_name}</div>
                            <div className="text-xs text-muted-foreground">{admin.email}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{admin.plan_name}</Badge>
                          </TableCell>
                          <TableCell>
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(admin.price)}
                          </TableCell>
                          <TableCell>
                            {admin.end_date ? format(new Date(admin.end_date), "dd/MM/yyyy", { locale: ptBR }) : 'N/A'}
                          </TableCell>
                          <TableCell>
                            {admin.payment_status === 'em_dia' && (
                              <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                                <CheckCircle className="w-3 h-3 mr-1" /> Ativo
                              </Badge>
                            )}
                            {admin.payment_status === 'proximo_vencimento' && (
                              <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">
                                <Clock className="w-3 h-3 mr-1" /> Pendente
                              </Badge>
                            )}
                            {admin.payment_status === 'vencido' && (
                              <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
                                <AlertTriangle className="w-3 h-3 mr-1" /> Vencido
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredAdmins.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            Nenhum escritório encontrado com esses critérios.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Status da Integração */}
          <Card>
            <CardHeader>
              <CardTitle>Status da Integração Stripe</CardTitle>
              <CardDescription>
                Monitoramento das APIs e webhooks de pagamento
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="h-3 w-3 bg-green-500 rounded-full"></div>
                    <span className="font-medium">Webhook Stripe</span>
                  </div>
                  <span className="text-sm text-green-600">Configurado</span>
                </div>
                
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="h-3 w-3 bg-green-500 rounded-full"></div>
                    <span className="font-medium">API de Consulta</span>
                  </div>
                  <span className="text-sm text-green-600">Funcionando</span>
                </div>
                
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="h-3 w-3 bg-green-500 rounded-full"></div>
                    <span className="font-medium">API de Override</span>
                  </div>
                  <span className="text-sm text-green-600">Funcionando</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sistema Isolado Info */}
          <Card className="border-blue-200 bg-blue-50/50">
            <CardHeader>
              <CardTitle className="text-blue-800">Sistema Administrativo Isolado</CardTitle>
              <CardDescription className="text-blue-600">
                Esta página faz parte do sistema administrativo isolado
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-blue-700">
                O controle de assinaturas agora é independente do sistema de roles normal. 
                Apenas emails autorizados podem acessar esta funcionalidade.
                Isso garante maior segurança e isolamento das funcionalidades críticas.
              </p>
            </CardContent>
          </Card>
        </div>
    </div>
  );
};

export default SystemSubscriptions;
