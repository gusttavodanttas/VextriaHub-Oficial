import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Search, 
  Users, 
  AlertCircle, 
  CheckCircle, 
  Clock,
  MoreHorizontal,
  RefreshCw
} from 'lucide-react';
import type { SubscriptionData } from '@/hooks/useSubscriptionAPI';

interface SubscriptionTableProps {
  data: SubscriptionData[];
  loading: boolean;
  onRefresh: () => void;
}

export const SubscriptionTable: React.FC<SubscriptionTableProps> = ({ 
  data, 
  loading, 
  onRefresh 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [accessFilter, setAccessFilter] = useState<string>('all');

  // Filtrar dados
  const filteredData = data.filter(subscription => {
    const matchesSearch = !searchTerm || 
      subscription.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      subscription.profiles?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      subscription.offices?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || subscription.payment_status === statusFilter;
    const matchesAccess = accessFilter === 'all' || subscription.access_status === accessFilter;
    
    return matchesSearch && matchesStatus && matchesAccess;
  });

  const getPaymentStatusBadge = (status: string) => {
    const styles = {
      paid: 'bg-green-100 text-green-800 border-green-200',
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200', 
      overdue: 'bg-red-100 text-red-800 border-red-200',
      canceled: 'bg-gray-100 text-gray-800 border-gray-200',
      unknown: 'bg-gray-100 text-gray-800 border-gray-200'
    };
    
    const labels = {
      paid: 'Pago',
      pending: 'Pendente',
      overdue: 'Em Atraso',
      canceled: 'Cancelado',
      unknown: 'Desconhecido'
    };

    return (
      <Badge className={styles[status as keyof typeof styles] || styles.unknown}>
        {labels[status as keyof typeof labels] || status}
      </Badge>
    );
  };

  const getAccessStatusBadge = (status: string) => {
    const styles = {
      active: 'bg-green-100 text-green-800 border-green-200',
      blocked: 'bg-red-100 text-red-800 border-red-200',
      suspended: 'bg-orange-100 text-orange-800 border-orange-200'
    };
    
    const labels = {
      active: 'Liberado',
      blocked: 'Bloqueado', 
      suspended: 'Suspenso'
    };

    return (
      <Badge className={styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800'}>
        {labels[status as keyof typeof labels] || status}
      </Badge>
    );
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Controle de Assinaturas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-48"></div>
                <div className="h-4 bg-gray-200 rounded w-32"></div>
                <div className="h-4 bg-gray-200 rounded w-24"></div>
                <div className="h-4 bg-gray-200 rounded w-20"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Controle de Assinaturas ({filteredData.length})
          </CardTitle>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onRefresh}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, email ou escritório..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Status do Pagamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              <SelectItem value="paid">Pago</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
              <SelectItem value="overdue">Em Atraso</SelectItem>
              <SelectItem value="canceled">Cancelado</SelectItem>
            </SelectContent>
          </Select>

          <Select value={accessFilter} onValueChange={setAccessFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Status de Acesso" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Acessos</SelectItem>
              <SelectItem value="active">Liberado</SelectItem>
              <SelectItem value="blocked">Bloqueado</SelectItem>
              <SelectItem value="suspended">Suspenso</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tabela */}
        {filteredData.length === 0 ? (
          <div className="text-center py-12">
            <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Nenhum usuário encontrado
            </h3>
            <p className="text-gray-500">
              {searchTerm || statusFilter !== 'all' || accessFilter !== 'all' 
                ? 'Tente ajustar os filtros de busca.' 
                : 'Não há usuários cadastrados no sistema.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Escritório</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Status Pagamento</TableHead>
                  <TableHead>Status Acesso</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Atraso</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((subscription) => (
                  <TableRow key={subscription.id} className="hover:bg-muted/50">
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {subscription.profiles?.full_name || 'Nome não informado'}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {subscription.profiles?.email}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {subscription.offices?.name || '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {subscription.plan_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {getPaymentStatusBadge(subscription.payment_status)}
                    </TableCell>
                    <TableCell>
                      {getAccessStatusBadge(subscription.access_status)}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {formatCurrency(subscription.monthly_fee)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {formatDate(subscription.due_date)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {subscription.days_overdue > 0 ? (
                        <div className="flex items-center gap-1 text-red-600">
                          <AlertCircle className="h-3 w-3" />
                          <span className="text-sm font-medium">
                            {subscription.days_overdue} dias
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-green-600">
                          <CheckCircle className="h-3 w-3" />
                          <span className="text-sm">
                            Em dia
                          </span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="h-8 w-8 p-0"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};