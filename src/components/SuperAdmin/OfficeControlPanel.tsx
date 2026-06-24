import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useSuperAdminOffices, AdminOffice } from '@/hooks/useSuperAdminOffices';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Building2, Search, Eye, UserX, UserCheck, CreditCard, AlertCircle, CheckCircle, Clock, RefreshCw, Users, Save, Star, Shield, Calendar, Gift } from 'lucide-react';
import { format } from 'date-fns';
import { CriarUsuarioCortesia } from './CriarUsuarioCortesia';

export const OfficeControlPanel: React.FC = () => {
  const {
    admins,
    loading,
    error,
    refresh,
    updateOfficeStatus,
    updateOfficeFull,
    manageAccess,
    sendPaymentReminder
  } = useSuperAdminOffices();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedAdmin, setSelectedAdmin] = useState<AdminOffice | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<AdminOffice>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [discountInput, setDiscountInput] = useState<string>('');

  useEffect(() => {
    if (selectedAdmin) {
      setEditFormData({
        office_name: selectedAdmin.office_name,
        office_email: selectedAdmin.office_email,
        phone: selectedAdmin.phone,
        address: selectedAdmin.address,
        plan_name: selectedAdmin.plan_name as any,
        is_lifetime: selectedAdmin.is_lifetime
      });
      setDiscountInput('');
    }
  }, [selectedAdmin]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdmin?.office_id) return;
    setIsSubmitting(true);
    const success = await updateOfficeFull(selectedAdmin.office_id, editFormData);
    setIsSubmitting(false);
    if (success) {
      setDialogOpen(false);
    }
  };

  const handleGrantLifetime = async () => {
    if (!selectedAdmin?.office_id) return;
    const ok = await manageAccess(selectedAdmin.office_id, 'grant_lifetime');
    if (ok) setDialogOpen(false);
  };

  const handleApplyDiscount = async () => {
    if (!selectedAdmin?.office_id || !discountInput) return;
    await manageAccess(selectedAdmin.office_id, 'apply_discount', { discount_percent: Number(discountInput) });
  };

  const handleRemoveDiscount = async () => {
    if (!selectedAdmin?.office_id) return;
    await manageAccess(selectedAdmin.office_id, 'apply_discount', { discount_percent: 0 });
  };

  const filteredAdmins = admins.filter(admin => {
    const matchesSearch = !searchTerm ||
      admin.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      admin.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      admin.office_name?.toLowerCase().includes(searchTerm.toLowerCase());

    let matchesStatus = statusFilter === 'all';
    if (statusFilter === 'trial') matchesStatus = admin.is_trial;
    if (statusFilter === 'em_dia') matchesStatus = admin.payment_status === 'em_dia' && !admin.is_trial;
    if (statusFilter === 'vencido') matchesStatus = admin.payment_status === 'vencido';

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string, isTrial?: boolean, isLifetime?: boolean, planName?: string) => {
    if (planName === 'cortesia') {
      return (
        <Badge variant="outline" className="border-emerald-600/60 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 font-bold">
          <Gift className="w-3 h-3 mr-1" /> Cortesia
        </Badge>
      );
    }
    if (isLifetime) {
      return (
        <Badge variant="outline" className="border-amber-500/50 text-amber-500 bg-transparent font-bold">
          <Star className="w-3 h-3 mr-1 fill-amber-500" /> Vitalício
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
      case 'vencido':
        return (
          <Badge variant="outline" className="border-rose-500/50 text-rose-500 bg-transparent font-bold">
            <AlertCircle className="w-3 h-3 mr-1" /> Vencido
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground">Pendente</Badge>
        );
    }
  };

  const stats = {
    total: admins.length,
    emDia: admins.filter(a => a.payment_status === 'em_dia' && !a.is_trial).length,
    trial: admins.filter(a => a.is_trial).length,
    vencidos: admins.filter(a => a.payment_status === 'vencido').length,
  };

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-black/5 dark:border-white/5 bg-card/40 backdrop-blur-xl rounded-3xl shadow-premium hover-lift">
          <CardContent className="p-4">
            <div className="flex items-center justify-between pb-1">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Escritórios</p>
              <Users size={12} className="text-primary opacity-50" />
            </div>
            <div className="text-xl font-black">{stats.total}</div>
          </CardContent>
        </Card>
        <Card className="border-black/5 dark:border-white/5 bg-card/40 backdrop-blur-xl rounded-3xl shadow-premium hover-lift">
          <CardContent className="p-4">
            <div className="flex items-center justify-between pb-1">
              <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Ativos</p>
              <CheckCircle size={12} className="text-emerald-500 opacity-50" />
            </div>
            <div className="text-xl font-black text-emerald-500">{stats.emDia}</div>
          </CardContent>
        </Card>
        <Card className="border-black/5 dark:border-white/5 bg-card/40 backdrop-blur-xl rounded-3xl shadow-premium hover-lift">
          <CardContent className="p-4">
            <div className="flex items-center justify-between pb-1">
              <p className="text-[10px] font-black text-purple-500 uppercase tracking-widest">Trials</p>
              <Clock size={12} className="text-purple-500 opacity-50" />
            </div>
            <div className="text-xl font-black text-purple-500">{stats.trial}</div>
          </CardContent>
        </Card>
        <Card className="border-black/5 dark:border-white/5 bg-card/40 backdrop-blur-xl rounded-3xl shadow-premium hover-lift">
          <CardContent className="p-4">
            <div className="flex items-center justify-between pb-1">
              <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Vencidos</p>
              <AlertCircle size={12} className="text-rose-500 opacity-50" />
            </div>
            <div className="text-xl font-black text-rose-500">{stats.vencidos}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-black/5 dark:border-white/5 overflow-hidden bg-card/20 backdrop-blur-xl rounded-[2rem] shadow-premium">
        <CardHeader className="border-b border-black/5 dark:border-white/5 pb-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <CardTitle className="text-lg font-black flex items-center gap-2">
                <Shield className="text-primary h-5 w-5" /> Administração Global
              </CardTitle>
              <CardDescription className="text-xs font-medium">Visualize e edite os dados institucionais dos escritórios.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <CriarUsuarioCortesia onSuccess={refresh} />
              <Button type="button" variant="ghost" size="sm" onClick={refresh} disabled={loading} className="h-8 hover:bg-muted/10">
                <RefreshCw className={`h-3 w-3 mr-2 ${loading ? 'animate-spin' : ''}`} /> Atualizar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="p-4 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/50" />
              <Input
                placeholder="Escritório ou Administrador..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-9 bg-black/[0.02] dark:bg-white/5 border-black/5 dark:border-white/10 rounded-xl"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[150px] h-9 bg-black/[0.02] dark:bg-white/5 border-black/5 dark:border-white/10 rounded-xl">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="em_dia">Ativos</SelectItem>
                <SelectItem value="trial">Trials</SelectItem>
                <SelectItem value="vencido">Vencidos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-black/[0.02] dark:bg-white/5 hover:bg-black/[0.02] dark:hover:bg-white/5 border-none">
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest py-3 pl-6">Identidade</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest py-3">Escritório</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest py-3 text-center">Cadastro</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest py-3 text-center">Status</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-widest py-3 text-center">Vencimento</TableHead>
                  <TableHead className="text-right text-[10px] font-bold uppercase tracking-widest py-3 pr-6">Gerenciar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && admins.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-24 text-muted-foreground italic text-xs">Sincronizando base de dados...</TableCell></TableRow>
                ) : filteredAdmins.map((admin) => (
                  <TableRow key={admin.id} className="hover:bg-black/[0.02] dark:hover:bg-white/5 border-black/5 dark:border-white/5 transition-colors">
                    <TableCell className="py-4 pl-6">
                      <div className="flex flex-col">
                        <span className="font-black text-sm tracking-tight">{admin.full_name}</span>
                        <span className="text-[10px] text-muted-foreground font-medium tracking-tight">{admin.email}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-primary/80">{admin.office_name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-4 text-center">
                      <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
                        <Calendar size={12} />
                        <span className="text-xs">{admin.created_at ? format(new Date(admin.created_at), "dd/MM/yyyy") : "--/--/----"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {getStatusBadge(admin.payment_status, admin.is_trial, admin.is_lifetime, admin.plan_name)}
                        {!admin.active && <Badge variant="destructive" className="text-[9px] px-1 h-4 font-bold">SUSPENSO</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="py-4 text-center font-bold text-sm tabular-nums text-muted-foreground">
                      {admin.end_date ? format(new Date(admin.end_date), "dd/MM/yyyy") : "---"}
                    </TableCell>
                    <TableCell className="py-4 text-right pr-6">
                      <div className="flex items-center justify-end gap-1">
                        <Dialog
                          open={dialogOpen && selectedAdmin?.office_id === admin.office_id}
                          onOpenChange={(open) => {
                            if (open) {
                              setSelectedAdmin(admin);
                              setEditFormData({
                                office_name: admin.office_name,
                                office_email: admin.office_email,
                                phone: admin.phone,
                                address: admin.address,
                                plan_name: admin.plan_name as any,
                                is_lifetime: admin.is_lifetime,
                              });
                              setDialogOpen(true);
                            } else {
                              setDialogOpen(false);
                              setSelectedAdmin(null);
                            }
                          }}>
                          <DialogTrigger asChild>
                            <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full hover:bg-muted/10">
                              <Eye size={16} className="text-primary/70" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-[550px] border-none shadow-2xl rounded-[2rem] bg-background max-h-[90vh] flex flex-col">
                            <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
                              <div className="p-6 bg-black/[0.02] dark:bg-white/5 border-b border-black/5 dark:border-white/10 shrink-0">
                                <DialogHeader>
                                  <DialogTitle className="flex items-center gap-2 text-xl font-black">
                                    <Building2 className="text-primary" /> Editar Escritório
                                  </DialogTitle>
                                  <DialogDescription className="text-xs">Ajuste os dados cadastrais e as configurações de plano.</DialogDescription>
                                </DialogHeader>
                              </div>
                              <div className="p-6 space-y-6 overflow-y-auto flex-1">
                                <div className="space-y-4">
                                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60 border-b border-muted/20 pb-1">Perfil do Escritório</h4>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                      <Label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Nome Fantasia</Label>
                                      <Input value={editFormData.office_name || ''} onChange={(e) => setEditFormData({ ...editFormData, office_name: e.target.value })} className="h-10 bg-muted/20 border-none rounded-xl" />
                                    </div>
                                    <div className="space-y-1.5">
                                      <Label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">E-mail para Contato</Label>
                                      <Input type="email" value={editFormData.office_email || ''} onChange={(e) => setEditFormData({ ...editFormData, office_email: e.target.value })} className="h-10 bg-muted/20 border-none rounded-xl" />
                                    </div>
                                    <div className="space-y-1.5">
                                      <Label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Telefone</Label>
                                      <Input value={editFormData.phone || ''} onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })} className="h-10 bg-muted/20 border-none rounded-xl" />
                                    </div>
                                    <div className="space-y-1.5">
                                      <Label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Endereço Completo</Label>
                                      <Input value={editFormData.address || ''} onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })} className="h-10 bg-muted/20 border-none rounded-xl" />
                                    </div>
                                  </div>

                                  <div className="space-y-4">
                                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60 border-b border-muted/20 pb-1">Gestão de Faturamento & Stripe (A + B)</h4>
                                    <div className="grid grid-cols-2 gap-3">
                                      <div className="p-4 bg-muted/10 rounded-2xl border border-muted/10 space-y-3">
                                        <div className="space-y-0.5">
                                          <Label className="text-[10px] font-bold uppercase text-amber-500">Cenário A: Desconto</Label>
                                          <p className="text-[9px] text-muted-foreground leading-tight">Aplica cupom no Stripe</p>
                                        </div>
                                        <div className="flex gap-2">
                                          <Input
                                            type="number"
                                            placeholder="%"
                                            value={discountInput}
                                            onChange={(e) => setDiscountInput(e.target.value)}
                                            className="h-8 w-16 bg-background rounded-lg text-xs"
                                          />
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            className="h-8 text-[10px] uppercase font-bold"
                                            onClick={handleApplyDiscount}
                                          >
                                            Aplicar
                                          </Button>
                                        </div>
                                      </div>
                                      <div className="p-4 bg-muted/10 rounded-2xl border border-muted/10 space-y-3">
                                        <div className="space-y-0.5">
                                          <Label className="text-[10px] font-bold uppercase text-emerald-500">Cenário B: Vitalício</Label>
                                          <p className="text-[9px] text-muted-foreground leading-tight">Cancela Stripe + Libera</p>
                                        </div>
                                        <Button
                                          type="button"
                                          size="sm"
                                          className="w-full h-8 text-[10px] uppercase font-bold bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/20"
                                          variant="outline"
                                          onClick={handleGrantLifetime}
                                        >
                                          Tornar Vitalício
                                        </Button>
                                      </div>
                                    </div>
                                    {admin.manual_discount_percent > 0 && (
                                      <div className="px-3 py-1.5 bg-amber-500/5 border border-amber-500/10 rounded-lg flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-amber-600 uppercase">Desconto Ativo: {admin.manual_discount_percent}%</span>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          className="h-4 text-[10px] text-amber-600/60"
                                          onClick={handleRemoveDiscount}
                                        >
                                          Remover
                                        </Button>
                                      </div>
                                    )}
                                  </div>

                                  <div className="space-y-4 mt-6">
                                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60 border-b border-muted/20 pb-1">Configurações Gerais</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                      <div className="space-y-1.5">
                                        <Label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Plano UI (Dashboard)</Label>
                                        <Select
                                          value={editFormData.plan_name}
                                          onValueChange={(val) => setEditFormData({ ...editFormData, plan_name: val as any })}
                                        >
                                          <SelectTrigger className="h-10 bg-muted/20 border-none rounded-xl">
                                            <SelectValue placeholder="Selecione o plano" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="trial">Trial</SelectItem>
                                            <SelectItem value="starter">Starter</SelectItem>
                                            <SelectItem value="pro">Pro</SelectItem>
                                            <SelectItem value="business">Business</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <DialogFooter className="p-6 pt-2">
                                <Button type="submit" disabled={isSubmitting} className="w-full h-12 rounded-2xl font-black bg-primary text-primary-foreground gap-2 shadow-lg shadow-primary/10">
                                  {isSubmitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save size={18} />}
                                  {isSubmitting ? 'Atualizando Banco...' : 'Publicar Alterações'}
                                </Button>
                              </DialogFooter>
                            </form>
                          </DialogContent>
                        </Dialog>
                        <Button type="button" variant="ghost" size="sm" onClick={() => sendPaymentReminder(admin.email || '', admin.office_name || '')} className="h-8 w-8 p-0 text-blue-500/60 hover:text-blue-500 hover:bg-blue-500/5 transition-colors">
                          <CreditCard size={15} />
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => updateOfficeStatus(admin.office_id || '', !admin.active)}
                          className={`h-8 w-8 p-0 rounded-full transition-colors ${admin.active ? 'text-rose-500/60 hover:text-rose-500 hover:bg-rose-500/5' : 'text-emerald-500/60 hover:text-emerald-500 hover:bg-emerald-500/5'}`}>
                          {admin.active ? <UserX size={15} /> : <UserCheck size={15} />}
                        </Button>
                      </div>
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
