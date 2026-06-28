import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useOfficeManagement } from '@/hooks/useOfficeManagement';
import { useToast } from '@/hooks/use-toast';
import { Building2, Save, BarChart3, CreditCard, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPhone, isValidPhone } from '@/lib/phone';
import { PermissionGuard } from '@/components/Auth/PermissionGuard';

export const OfficeSettings: React.FC = () => {
  const { office } = useAuth();
  const { updateOffice } = useOfficeManagement();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: office?.name || '',
    email: office?.email || '',
    phone: formatPhone(office?.phone || ''),
    address: office?.address || '',
  });

  // Busca dados frescos do banco ao montar (o office do contexto pode estar desatualizado)
  useEffect(() => {
    if (!office?.id) return;
    let cancel = false;
    (async () => {
      const { data } = await supabase
        .from('offices')
        .select('name, email, phone, address')
        .eq('id', office.id)
        .maybeSingle();
      if (cancel || !data) return;
      setFormData({
        name: data.name || '',
        email: data.email || '',
        phone: formatPhone(data.phone || ''),
        address: data.address || '',
      });
    })();
    return () => { cancel = true; };
  }, [office?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!office?.id) return;
    if (!isValidPhone(formData.phone)) {
      toast({ title: "Telefone inválido", description: "Use o formato (XX) XXXXX-XXXX.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const result = await updateOffice(office.id, formData);
      if (result) {
        toast({ title: "Escritório atualizado", description: "As informações foram salvas com sucesso." });
      }
    } catch (error) {
      toast({ title: "Erro ao atualizar", description: "Não foi possível salvar as alterações.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  if (!office) {
    return (
      <Card className="glass-card rounded-[2rem] border-black/5 dark:border-border shadow-premium">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Building2 className="h-7 w-7 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-black">Nenhum escritório encontrado</h3>
          <p className="text-sm text-muted-foreground text-center mt-1">Você não está associado a nenhum escritório.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <PermissionGuard permission="canManageOffice">
      <div className="space-y-6">
        {/* Informações */}
        <Card className="glass-card rounded-[2rem] border-black/5 dark:border-border overflow-hidden shadow-premium">
          <CardHeader className="border-b border-black/5 dark:border-border pb-4 flex flex-row items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-black">Informações do Escritório</CardTitle>
              <CardDescription className="text-xs font-medium">Dados básicos exibidos em documentos e relatórios</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-5 md:p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-xs font-bold">Nome do Escritório</Label>
                  <Input id="name" value={formData.name} onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))} placeholder="Nome do escritório" required className="h-11 rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-bold">E-mail</Label>
                  <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))} placeholder="contato@escritorio.com" className="h-11 rounded-xl" />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="phone" className="text-xs font-bold">Telefone</Label>
                  <Input
                    id="phone"
                    inputMode="numeric"
                    value={formData.phone}
                    onChange={(e) => setFormData((p) => ({ ...p, phone: formatPhone(e.target.value) }))}
                    placeholder="(11) 99999-9999"
                    className={cn("h-11 rounded-xl", formData.phone && !isValidPhone(formData.phone) && "border-destructive focus-visible:ring-destructive")}
                  />
                  {formData.phone && !isValidPhone(formData.phone) && (
                    <p className="text-[11px] font-bold text-destructive">Telefone incompleto ou inválido.</p>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="address" className="text-xs font-bold">Endereço</Label>
                <Textarea id="address" value={formData.address} onChange={(e) => setFormData((p) => ({ ...p, address: e.target.value }))} placeholder="Endereço completo do escritório" rows={3} className="rounded-xl resize-none" />
              </div>
              <Button type="submit" disabled={isLoading} className="rounded-xl font-bold gap-2">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {isLoading ? 'Salvando…' : 'Salvar Alterações'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Plano / Estatísticas */}
          <Card className="glass-card rounded-[2rem] border-black/5 dark:border-border overflow-hidden shadow-premium">
            <CardHeader className="border-b border-black/5 dark:border-border pb-4 flex flex-row items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <BarChart3 className="h-5 w-5" />
              </div>
              <CardTitle className="text-lg font-black">Plano & Limites</CardTitle>
            </CardHeader>
            <CardContent className="p-5 md:p-6 space-y-3">
              <Row label="Plano atual"><Badge className="rounded-full font-black uppercase">{office.plan}</Badge></Row>
              <Row label="Máximo de usuários"><span className="font-black">{office.max_users}</span></Row>
              <Row label="Status">
                <span className={cn(
                  "px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase border",
                  office.active ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" : "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
                )}>
                  {office.active ? 'Ativo' : 'Inativo'}
                </span>
              </Row>
            </CardContent>
          </Card>

          {/* Assinatura */}
          <Card className="glass-card rounded-[2rem] border-black/5 dark:border-border overflow-hidden shadow-premium">
            <CardHeader className="border-b border-black/5 dark:border-border pb-4 flex flex-row items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <CreditCard className="h-5 w-5" />
              </div>
              <CardTitle className="text-lg font-black">Assinatura</CardTitle>
            </CardHeader>
            <CardContent className="p-5 md:p-6 flex flex-col justify-between gap-4 h-[calc(100%-73px)]">
              <p className="text-sm text-muted-foreground">
                Para alterar seu plano ou gerenciar sua assinatura, fale com o suporte.
              </p>
              <Button variant="outline" className="w-full rounded-xl font-bold">Falar com Suporte</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </PermissionGuard>
  );
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.02]">
      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{label}</span>
      {children}
    </div>
  );
}
