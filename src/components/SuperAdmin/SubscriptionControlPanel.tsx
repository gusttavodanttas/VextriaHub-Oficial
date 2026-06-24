import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSuperAdminOffices } from '@/hooks/useSuperAdminOffices';
import { 
  Search, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  RefreshCw, 
  Users, 
  TrendingUp,
  ArrowUpRight,
  Shield,
  CreditCard,
  Star
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const SubscriptionControlPanel: React.FC = () => {
  const { admins, loading, refresh } = useSuperAdminOffices();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Filtrar dados
  const filteredAdmins = admins.filter(admin => {
    const matchesSearch = !searchTerm || 
      admin.office_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      admin.office_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      admin.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesStatus = statusFilter === 'all';
    if (statusFilter === 'trial') matchesStatus = !!admin.is_trial && !admin.is_lifetime;
    if (statusFilter === 'em_dia') matchesStatus = admin.payment_status === 'em_dia' && !admin.is_trial && !admin.is_lifetime;
    if (statusFilter === 'vencido') matchesStatus = admin.payment_status === 'vencido';
    if (statusFilter === 'proximo_vencimento') matchesStatus = admin.payment_status === 'proximo_vencimento';
    if (statusFilter === 'lifetime') matchesStatus = admin.is_lifetime === true;
    
    return matchesSearch && matchesStatus;
  });

  // Cálculos de métricas reais
  const metrics = {
    totalOffices: admins.length,
    activeOffices: admins.filter(a => a.payment_status === 'em_dia' && !a.is_trial && !a.is_lifetime).length,
    trialOffices: admins.filter(a => a.is_trial).length,
    lifetimeOffices: admins.filter(a => a.is_lifetime).length,
    blockedOffices: admins.filter(a => a.payment_status === 'vencido').length,
    revenue: admins.reduce((acc, a) => acc + (a.payment_status === 'em_dia' && !a.is_trial && !a.is_lifetime ? a.price : 0), 0)
  };

  const getStatusBadge = (status: string, isTrial?: boolean, isLifetime?: boolean) => {
    if (isLifetime) {
      return (
        <Badge variant="outline" className="border-amber-500/50 text-amber-500 bg-transparent font-bold">
          Vitalício
        </Badge>
      );
    }
    
    if (isTrial) {
      return (
        <Badge variant="outline" className="border-purple-500/50 text-purple-500 bg-transparent font-bold">
          <Clock className="w-3 h-3 mr-1" /> Trial
        </Badge>
      );
    }

    switch (status) {
      case 'em_dia':
        return (
          <Badge variant="outline" className="border-emerald-500/50 text-emerald-500 bg-transparent font-bold">
            <CheckCircle className="w-3 h-3 mr-1" /> Ativo
          </Badge>
        );
      case 'proximo_vencimento':
        return (
          <Badge variant="outline" className="border-yellow-500/50 text-yellow-600 bg-transparent font-bold">
            <Clock className="w-3 h-3 mr-1" /> Pendente
          </Badge>
        );
      case 'vencido':
        return (
          <Badge variant="outline" className="border-rose-500/50 text-rose-500 bg-transparent font-bold">
            <AlertTriangle className="w-3 h-3 mr-1" /> Vencido
          </Badge>
        );
      default:
        return <Badge variant="outline" className="text-muted-foreground">N/A</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Cards de Métricas com visual limpo */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Card className="border-black/5 dark:border-white/5 bg-card/40 backdrop-blur-xl rounded-3xl shadow-premium hover-lift">
          <CardContent className="p-4">
            <div className="flex items-center justify-between pb-1">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Total Escritórios</p>
              <Users size={12} className="text-primary opacity-50" />
            </div>
            <div className="text-xl font-black">{metrics.totalOffices}</div>
          </CardContent>
        </Card>

        <Card className="border-black/5 dark:border-white/5 bg-card/40 backdrop-blur-xl rounded-3xl shadow-premium hover-lift">
          <CardContent className="p-4">
            <div className="flex items-center justify-between pb-1">
              <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Ativos</p>
              <CheckCircle size={12} className="text-emerald-500 opacity-50" />
            </div>
            <div className="text-xl font-black text-emerald-500">{metrics.activeOffices}</div>
          </CardContent>
        </Card>

        <Card className="border-black/5 dark:border-white/5 bg-card/40 backdrop-blur-xl rounded-3xl shadow-premium hover-lift">
          <CardContent className="p-4">
            <div className="flex items-center justify-between pb-1">
              <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Vitalício ⭐</p>
              <Star size={12} className="text-amber-500 opacity-50" />
            </div>
            <div className="text-xl font-black text-amber-500">{metrics.lifetimeOffices}</div>
          </CardContent>
        </Card>

        <Card className="border-black/5 dark:border-white/5 bg-card/40 backdrop-blur-xl rounded-3xl shadow-premium hover-lift">
          <CardContent className="p-4">
            <div className="flex items-center justify-between pb-1">
              <p className="text-[10px] font-black text-purple-500 uppercase tracking-widest">Trial</p>
              <Clock size={12} className="text-purple-500 opacity-50" />
            </div>
            <div className="text-xl font-black text-purple-500">{metrics.trialOffices}</div>
          </CardContent>
        </Card>

        <Card className="border-black/5 dark:border-white/5 bg-card/40 backdrop-blur-xl rounded-3xl shadow-premium hover-lift">
          <CardContent className="p-4">
            <div className="flex items-center justify-between pb-1">
              <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Vencidos</p>
              <AlertTriangle size={12} className="text-rose-500 opacity-50" />
            </div>
            <div className="text-xl font-black text-rose-500">{metrics.blockedOffices}</div>
          </CardContent>
        </Card>

        <Card className="border-black/5 dark:border-white/5 bg-card/40 backdrop-blur-xl rounded-3xl shadow-premium hover-lift">
          <CardContent className="p-4">
            <div className="flex items-center justify-between pb-1">
              <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">MRR Estimado</p>
              <TrendingUp size={12} className="text-blue-500 opacity-50" />
            </div>
            <div className="text-xl font-black text-blue-500">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(metrics.revenue)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Controle */}
      <Card className="border-black/5 dark:border-white/5 overflow-hidden bg-card/20 backdrop-blur-xl rounded-[2rem] shadow-premium">
        <CardHeader className="border-b border-black/5 dark:border-white/5 pb-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <CardTitle className="text-lg font-black flex items-center gap-2">
                <CreditCard className="text-primary h-5 w-5" />
                Gestão Financeira
              </CardTitle>
              <CardDescription className="text-xs font-medium">Monitoramento de pagamentos e prazos em tempo real.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={refresh} disabled={loading} className="h-8 hover:bg-muted/10">
              <RefreshCw className={`h-3 w-3 mr-2 ${loading ? 'animate-spin' : ''}`} /> Sincronizar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="p-4 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/50" />
              <Input
                placeholder="Buscar escritório ou email de cobrança..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-9 bg-black/[0.02] dark:bg-white/5 border-black/5 dark:border-white/10 rounded-xl"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[200px] h-9 bg-black/[0.02] dark:bg-white/5 border-black/5 dark:border-white/10 rounded-xl">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="em_dia">Ativo (Em dia)</SelectItem>
                <SelectItem value="proximo_vencimento">Pendente</SelectItem>
                <SelectItem value="vencido">Vencido</SelectItem>
                <SelectItem value="trial">Em Trial</SelectItem>
                <SelectItem value="lifetime">Vitalício ⭐</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-black/[0.02] dark:bg-white/5 hover:bg-black/[0.02] dark:hover:bg-white/5 border-none">
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest py-3 pl-6">Escritório / Admin</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest py-3 text-center">Plano</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest py-3 text-center">Valor</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest py-3 text-center">Vencimento</TableHead>
                  <TableHead className="text-right text-[10px] font-bold uppercase tracking-widest py-3 pr-6">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && admins.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-24 text-muted-foreground italic text-xs">Aguardando dados financeiros...</TableCell></TableRow>
                ) : filteredAdmins.map((admin) => (
                  <TableRow key={admin.id} className="hover:bg-black/[0.02] dark:hover:bg-white/5 border-black/5 dark:border-white/5 transition-colors">
                    <TableCell className="py-4 pl-6">
                      <div className="font-black text-sm tracking-tight">{admin.office_name}</div>
                      <div className="text-[10px] text-muted-foreground font-medium tracking-tight">{admin.office_email || admin.email}</div>
                    </TableCell>
                    <TableCell className="py-4 text-center">
                      <Badge variant="outline" className="font-bold border-muted/20 text-[10px] uppercase">
                        {admin.plan_name}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-4 text-center font-black text-sm">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(admin.price)}
                    </TableCell>
                    <TableCell className="py-4 text-center">
                      <span className="text-sm">
                        {admin.end_date ? format(new Date(admin.end_date), "dd/MM/yyyy") : 'N/A'}
                      </span>
                    </TableCell>
                    <TableCell className="py-4 text-right pr-6">
                      {getStatusBadge(admin.payment_status, admin.is_trial, admin.is_lifetime)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
