import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Users, 
  CreditCard, 
  AlertTriangle, 
  CheckCircle, 
  TrendingUp, 
  Clock,
  Shield,
  UserX
} from 'lucide-react';
import type { SubscriptionStats } from '@/hooks/useSubscriptionAPI';

interface SubscriptionDashboardProps {
  stats: SubscriptionStats | null;
  loading: boolean;
}

export const SubscriptionDashboard: React.FC<SubscriptionDashboardProps> = ({ 
  stats, 
  loading 
}) => {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[...Array(8)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="flex items-center justify-between space-y-0 pb-2">
                <div className="h-4 bg-gray-200 rounded w-20"></div>
                <div className="h-4 w-4 bg-gray-200 rounded"></div>
              </div>
              <div className="h-8 bg-gray-200 rounded w-16 mb-1"></div>
              <div className="h-3 bg-gray-200 rounded w-24"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) {
    return (
      <Card className="mb-8">
        <CardContent className="p-6 text-center">
          <AlertTriangle className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500">Não foi possível carregar as estatísticas.</p>
        </CardContent>
      </Card>
    );
  }

  const metrics = [
    {
      title: "Total de Usuários",
      value: stats.total_users,
      icon: Users,
      description: "usuários cadastrados",
      color: "text-blue-600",
      bgColor: "bg-blue-100"
    },
    {
      title: "Usuários Ativos",
      value: stats.active_users,
      icon: CheckCircle,
      description: "com acesso liberado",
      color: "text-green-600",
      bgColor: "bg-green-100"
    },
    {
      title: "Usuários Bloqueados",
      value: stats.blocked_users,
      icon: UserX,
      description: "sem acesso",
      color: "text-red-600",
      bgColor: "bg-red-100"
    },
    {
      title: "Usuários Suspensos",
      value: stats.suspended_users,
      icon: Shield,
      description: "temporariamente",
      color: "text-orange-600",
      bgColor: "bg-orange-100"
    },
    {
      title: "Pagamentos em Dia",
      value: stats.paid_users,
      icon: CreditCard,
      description: "pagamentos confirmados",
      color: "text-green-600",
      bgColor: "bg-green-100"
    },
    {
      title: "Pagamentos em Atraso",
      value: stats.overdue_users,
      icon: AlertTriangle,
      description: "precisam atenção",
      color: "text-red-600",
      bgColor: "bg-red-100"
    },
    {
      title: "Pagamentos Pendentes",
      value: stats.pending_users,
      icon: Clock,
      description: "aguardando confirmação",
      color: "text-yellow-600",
      bgColor: "bg-yellow-100"
    },
    {
      title: "Receita Mensal",
      value: `R$ ${stats.total_revenue.toFixed(2)}`,
      icon: TrendingUp,
      description: "receita total estimada",
      color: "text-purple-600",
      bgColor: "bg-purple-100"
    }
  ];

  return (
    <div className="mb-8">
      {/* Cards principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {metrics.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <Card key={index} className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {metric.title}
                </CardTitle>
                <div className={`p-2 rounded-full ${metric.bgColor}`}>
                  <Icon className={`h-4 w-4 ${metric.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metric.value}</div>
                <p className="text-xs text-muted-foreground">
                  {metric.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Cards de alertas e insights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Taxa de conversão de pagamento */}
        <Card className="border-green-200">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-green-800">
              Taxa de Pagamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats.total_users > 0 ? 
                Math.round((stats.paid_users / stats.total_users) * 100) : 0}%
            </div>
            <p className="text-xs text-green-600">
              {stats.paid_users} de {stats.total_users} usuários pagaram
            </p>
          </CardContent>
        </Card>

        {/* Usuários em risco */}
        <Card className="border-yellow-200">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-yellow-800">
              Usuários em Risco
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {stats.users_at_risk}
            </div>
            <p className="text-xs text-yellow-600">
              até 7 dias de atraso
            </p>
          </CardContent>
        </Card>

        {/* Receita confirmada */}
        <Card className="border-blue-200">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-blue-800">
              Receita Confirmada
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              R$ {stats.paid_revenue.toFixed(2)}
            </div>
            <p className="text-xs text-blue-600">
              de pagamentos confirmados
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alertas importantes */}
      {(stats.overdue_users > 0 || stats.max_overdue_days > 30) && (
        <Card className="mt-6 border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <div>
                <h4 className="font-medium text-red-800">Atenção Necessária</h4>
                <div className="text-sm text-red-700 mt-1">
                  {stats.overdue_users > 0 && (
                    <p>• {stats.overdue_users} usuários com pagamento em atraso</p>
                  )}
                  {stats.max_overdue_days > 30 && (
                    <p>• Maior atraso: {stats.max_overdue_days} dias</p>
                  )}
                  {stats.blocked_users > 0 && (
                    <p>• {stats.blocked_users} usuários bloqueados precisam de atenção</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};