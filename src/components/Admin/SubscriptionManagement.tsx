import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useSubscriptions } from '@/hooks/useSubscriptions';
import { useOfficeManagement } from '@/hooks/useOfficeManagement';
import { useToast } from '@/hooks/use-toast';
import { CreditCard, Plus, Edit, Pause, Play, X, Search, Building2, Star } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { NovaSubscription } from '@/types/database';

export const SubscriptionManagement: React.FC = () => {
  const { 
    subscriptions, 
    loading, 
    createSubscription, 
    updateSubscription, 
    cancelSubscription, 
    reactivateSubscription,
    refresh 
  } = useSubscriptions();
  const { offices } = useOfficeManagement();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState<NovaSubscription>({
    office_id: '',
    plan: 'basico',
    status: 'active',
    start_date: new Date().toISOString().split('T')[0],
    end_date: null,
    price: 0,
    billing_cycle: 'monthly',
    stripe_subscription_id: null,
    stripe_customer_id: null,
    access_status: 'trial',
    payment_status: 'pending',
    checkout_url: null,
    plan_name: null,
    plan_type: null,
    payment_confirmed: false,
    is_trial: false,
    trial_start_date: null,
    trial_end_date: null,
    checkout_expires_at: null,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (editingSubscription) {
        const updated = await updateSubscription(editingSubscription.id, formData);
        if (updated) {
          toast({
            title: "Assinatura atualizada",
            description: "A assinatura foi atualizada com sucesso.",
          });
        }
      } else {
        const created = await createSubscription(formData);
        if (created) {
          toast({
            title: "Assinatura criada",
            description: "A assinatura foi criada com sucesso.",
          });
        }
      }
      
      setDialogOpen(false);
      resetForm();
      refresh();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao salvar a assinatura.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      office_id: '',
      plan: 'basico',
      status: 'active',
      start_date: new Date().toISOString().split('T')[0],
      end_date: null,
      price: 0,
      billing_cycle: 'monthly',
      stripe_subscription_id: null,
      stripe_customer_id: null,
      access_status: 'trial',
      payment_status: 'pending',
      checkout_url: null,
      plan_name: null,
      plan_type: null,
      payment_confirmed: false,
      is_trial: false,
      trial_start_date: null,
      trial_end_date: null,
      checkout_expires_at: null,
    });
    setEditingSubscription(null);
  };

  const handleEdit = (subscription: any) => {
    setEditingSubscription(subscription);
    setFormData({
      office_id: subscription.office_id,
      plan: subscription.plan,
      status: subscription.status,
      start_date: subscription.start_date,
      end_date: subscription.end_date,
      price: subscription.price || 0,
      billing_cycle: subscription.billing_cycle || 'monthly',
      stripe_subscription_id: subscription.stripe_subscription_id,
      stripe_customer_id: subscription.stripe_customer_id || null,
      access_status: subscription.access_status || 'trial',
      payment_status: subscription.payment_status || 'pending',
      checkout_url: subscription.checkout_url || null,
      plan_name: subscription.plan_name || null,
      plan_type: subscription.plan_type || null,
      payment_confirmed: subscription.payment_confirmed || false,
      is_trial: subscription.is_trial || false,
      trial_start_date: subscription.trial_start_date || null,
      trial_end_date: subscription.trial_end_date || null,
      checkout_expires_at: subscription.checkout_expires_at || null,
    });
    setDialogOpen(true);
  };

  const handleCancel = async (subscriptionId: string, officeName: string) => {
    if (confirm(`Tem certeza que deseja cancelar a assinatura de "${officeName}"?`)) {
      const success = await cancelSubscription(subscriptionId);
      if (success) {
        toast({
          title: "Assinatura cancelada",
          description: `A assinatura de "${officeName}" foi cancelada.`,
        });
        refresh();
      }
    }
  };

  const handleReactivate = async (subscriptionId: string, officeName: string) => {
    const success = await reactivateSubscription(subscriptionId);
    if (success) {
      toast({
        title: "Assinatura reativada",
        description: `A assinatura de "${officeName}" foi reativada.`,
      });
      refresh();
    }
  };

  // Filtros
  const filteredSubscriptions = subscriptions.filter(subscription => {
    const officeName = (subscription as any).office?.name || '';
    const matchesSearch = officeName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || subscription.status === statusFilter;
    const matchesPlan = planFilter === 'all' || subscription.plan === planFilter;
    
    return matchesSearch && matchesStatus && matchesPlan;
  });

  const getPlanDisplayName = (plan: string) => {
    const names: Record<string, string> = {
      trial: 'Trial',
      basico: 'Básico',
      intermediario: 'Intermediário',
      avancado: 'Avançado',
      premium: 'Premium',
    };
    return names[plan] || plan;
  };

  const getStatusDisplayName = (status: string) => {
    const names: Record<string, string> = {
      active: 'Ativa',
      inactive: 'Inativa',
      suspended: 'Suspensa',
      cancelled: 'Cancelada',
    };
    return names[status] || status;
  };

  const getStatusBadgeVariant = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: 'default',
      inactive: 'secondary',
      suspended: 'destructive',
      cancelled: 'outline',
    };
    return variants[status] || 'outline';
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando assinaturas...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header e controles */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold">Gerenciar Assinaturas</h2>
          <p className="text-sm text-muted-foreground">
            {subscriptions.length} assinatura(s) cadastrada(s)
          </p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Nova Assinatura
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>
                {editingSubscription ? 'Editar Assinatura' : 'Nova Assinatura'}
              </DialogTitle>
              <DialogDescription>
                {editingSubscription 
                  ? 'Atualize as informações da assinatura.'
                  : 'Preencha os dados da nova assinatura.'
                }
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="office">Escritório *</Label>
                <Select 
                  value={formData.office_id} 
                  onValueChange={(value) => setFormData({ ...formData, office_id: value })}
                  disabled={!!editingSubscription}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o escritório" />
                  </SelectTrigger>
                  <SelectContent>
                    {offices.map((office) => (
                      <SelectItem key={office.id} value={office.id}>
                        {office.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="plan">Plano *</Label>
                  <Select 
                    value={formData.plan} 
                    onValueChange={(value: any) => setFormData({ ...formData, plan: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                     <SelectContent>
                      <SelectItem value="basico">Básico</SelectItem>
                      <SelectItem value="intermediario">Intermediário</SelectItem>
                      <SelectItem value="avancado">Avançado</SelectItem>
                      <SelectItem value="premium">Premium</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="status">Status *</Label>
                  <Select 
                    value={formData.status} 
                    onValueChange={(value: any) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Ativa</SelectItem>
                      <SelectItem value="inactive">Inativa</SelectItem>
                      <SelectItem value="suspended">Suspensa</SelectItem>
                      <SelectItem value="cancelled">Cancelada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Preço (R$)</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="billing_cycle">Ciclo</Label>
                  <Select 
                    value={formData.billing_cycle} 
                    onValueChange={(value) => setFormData({ ...formData, billing_cycle: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Mensal</SelectItem>
                      <SelectItem value="yearly">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="start_date">Data de Início</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>
              
              {formData.status === 'cancelled' && (
                <div className="space-y-2">
                  <Label htmlFor="end_date">Data de Fim</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={formData.end_date || ''}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  />
                </div>
              )}
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Salvando...' : (editingSubscription ? 'Atualizar' : 'Criar')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Métricas rápidas */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">
              {subscriptions.filter(s => s.status === 'active').length}
            </div>
            <p className="text-sm text-muted-foreground">Assinaturas Ativas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-amber-600">
              {subscriptions.filter(s => s.status === 'suspended').length}
            </div>
            <p className="text-sm text-muted-foreground">Suspensas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">
              {subscriptions.filter(s => s.status === 'cancelled').length}
            </div>
            <p className="text-sm text-muted-foreground">Canceladas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-primary">
              R$ {subscriptions
                .filter(s => s.status === 'active')
                .reduce((sum, s) => sum + (s.price || 0), 0)
                .toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-sm text-muted-foreground">Receita Mensal</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="search">Buscar Escritório</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Nome do escritório..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Ativas</SelectItem>
                  <SelectItem value="inactive">Inativas</SelectItem>
                  <SelectItem value="suspended">Suspensas</SelectItem>
                  <SelectItem value="cancelled">Canceladas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="plan-filter">Plano</Label>
              <Select value={planFilter} onValueChange={setPlanFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                 <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="basico">Básico</SelectItem>
                  <SelectItem value="intermediario">Intermediário</SelectItem>
                  <SelectItem value="avancado">Avançado</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de assinaturas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Assinaturas ({filteredSubscriptions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Escritório</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Ciclo</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead>Fim</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSubscriptions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <CreditCard className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                      <p className="text-muted-foreground">
                        {searchTerm || statusFilter !== 'all' || planFilter !== 'all'
                          ? 'Nenhuma assinatura encontrada com os filtros aplicados.'
                          : 'Nenhuma assinatura cadastrada ainda.'
                        }
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSubscriptions.map((subscription) => (
                    <TableRow key={subscription.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-primary" />
                          {(subscription as any).office?.name || 'Escritório não encontrado'}
                        </div>
                      </TableCell>
                       <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge variant="outline">
                            {getPlanDisplayName(subscription.plan)}
                          </Badge>
                          {(subscription as any).office?.is_lifetime && (
                            <Badge className="bg-amber-500 hover:bg-amber-600 border-none text-[10px] h-5">
                              <Star className="h-3 w-3 mr-1 fill-current" />
                              Vitalício
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(subscription.status)}>
                          {getStatusDisplayName(subscription.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {subscription.price ? `R$ ${subscription.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}
                      </TableCell>
                      <TableCell className="capitalize">
                        {subscription.billing_cycle === 'monthly' ? 'Mensal' : 'Anual'}
                      </TableCell>
                      <TableCell>
                        {format(new Date(subscription.start_date), 'dd/MM/yyyy', { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        {subscription.end_date 
                          ? format(new Date(subscription.end_date), 'dd/MM/yyyy', { locale: ptBR })
                          : '-'
                        }
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(subscription)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {subscription.status === 'active' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCancel(subscription.id, (subscription as any).office?.name)}
                              className="text-destructive hover:text-destructive"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                          {subscription.status === 'cancelled' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleReactivate(subscription.id, (subscription as any).office?.name)}
                              className="text-green-600 hover:text-green-600"
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};