import React, { useState, useEffect, useRef } from 'react';
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
import { Building2, Save, BarChart3, CreditCard, Loader2, Camera } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPhone, isValidPhone } from '@/lib/phone';
import { uploadPublicImage, validateImage } from '@/lib/uploadImage';
import { PermissionGuard } from '@/components/Auth/PermissionGuard';

function formatCnpj(v: string): string {
  const d = (v || '').replace(/\D/g, '').slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

export const OfficeSettings: React.FC = () => {
  const { office } = useAuth();
  const { updateOffice } = useOfficeManagement();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);
  const [logoUrl, setLogoUrl] = useState((office as any)?.logo_url || '');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [fiscal, setFiscal] = useState({ cnpj: '', razao_social: '', inscricao: '' });
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
        .select('name, email, phone, address, logo_url, settings')
        .eq('id', office.id)
        .maybeSingle();
      if (cancel || !data) return;
      setFormData({
        name: data.name || '',
        email: data.email || '',
        phone: formatPhone(data.phone || ''),
        address: data.address || '',
      });
      setLogoUrl((data as any).logo_url || '');
      const f = (data as any).settings?.fiscal;
      if (f) setFiscal({ cnpj: f.cnpj || '', razao_social: f.razao_social || '', inscricao: f.inscricao || '' });
    })();
    return () => { cancel = true; };
  }, [office?.id]);

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !office?.id) return;
    const err = validateImage(file);
    if (err) { toast({ variant: "destructive", title: "Imagem inválida", description: err }); return; }
    try {
      setUploadingLogo(true);
      const url = await uploadPublicImage("logos", file, office.id);
      const { error } = await supabase.from("offices").update({ logo_url: url }).eq("id", office.id);
      if (error) throw error;
      setLogoUrl(url);
      toast({ title: "Logo atualizada", description: "A logo do escritório foi alterada." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro ao enviar logo", description: err?.message || "Verifique se o bucket de imagens existe." });
    } finally {
      setUploadingLogo(false);
      if (logoRef.current) logoRef.current.value = "";
    }
  };

  const emailValido = !formData.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!office?.id) return;
    if (!isValidPhone(formData.phone)) {
      toast({ title: "Telefone inválido", description: "Use o formato (XX) XXXXX-XXXX.", variant: "destructive" });
      return;
    }
    if (!emailValido) {
      toast({ title: "E-mail inválido", description: "Verifique o e-mail do escritório.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const result = await updateOffice(office.id, formData);
      // Dados fiscais ficam em offices.settings (jsonb)
      const { data: cur } = await supabase.from("offices").select("settings").eq("id", office.id).maybeSingle();
      const merged = { ...((cur?.settings as any) || {}), fiscal };
      await supabase.from("offices").update({ settings: merged }).eq("id", office.id);
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
            {/* Logo */}
            <div className="flex items-center gap-4 pb-5 mb-5 border-b border-black/5 dark:border-border">
              <div className="relative group/logo">
                <div className="h-20 w-20 rounded-2xl border border-black/10 dark:border-border bg-black/[0.02] dark:bg-white/[0.02] flex items-center justify-center overflow-hidden">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo do escritório" className="h-full w-full object-contain" />
                  ) : (
                    <Building2 className="h-8 w-8 text-muted-foreground/40" />
                  )}
                </div>
                <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                <button
                  type="button"
                  onClick={() => logoRef.current?.click()}
                  disabled={uploadingLogo}
                  aria-label="Alterar logo"
                  className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg border-2 border-background hover:scale-105 transition-transform disabled:opacity-60"
                >
                  {uploadingLogo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                </button>
              </div>
              <div>
                <p className="font-bold text-sm">Logo do escritório</p>
                <p className="text-xs text-muted-foreground">PNG ou JPG, até 3MB. Aparece no perfil da equipe.</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-xs font-bold">Nome do Escritório</Label>
                  <Input id="name" value={formData.name} onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))} placeholder="Nome do escritório" required className="h-11 rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-bold">E-mail</Label>
                  <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))} placeholder="contato@escritorio.com" className={cn("h-11 rounded-xl", !emailValido && "border-destructive focus-visible:ring-destructive")} />
                  {!emailValido && <p className="text-[11px] font-bold text-destructive">E-mail inválido.</p>}
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

              {/* Dados fiscais */}
              <div className="pt-4 mt-2 border-t border-black/5 dark:border-border space-y-4">
                <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/60">Dados fiscais (para contratos e documentos)</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">CNPJ</Label>
                    <Input value={fiscal.cnpj} onChange={(e) => setFiscal((p) => ({ ...p, cnpj: formatCnpj(e.target.value) }))} placeholder="00.000.000/0000-00" inputMode="numeric" className="h-11 rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">Inscrição (estadual/municipal)</Label>
                    <Input value={fiscal.inscricao} onChange={(e) => setFiscal((p) => ({ ...p, inscricao: e.target.value }))} placeholder="Opcional" className="h-11 rounded-xl" />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <Label className="text-xs font-bold">Razão social</Label>
                    <Input value={fiscal.razao_social} onChange={(e) => setFiscal((p) => ({ ...p, razao_social: e.target.value }))} placeholder="Razão social completa" className="h-11 rounded-xl" />
                  </div>
                </div>
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
