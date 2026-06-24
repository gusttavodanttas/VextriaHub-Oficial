import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Gift, Loader2, UserPlus } from 'lucide-react';

interface Props {
  onSuccess?: () => void;
}

export const CriarUsuarioCortesia: React.FC<Props> = ({ onSuccess }) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    nome: '',
    email: '',
    senha: '',
    nomeEscritorio: '',
    oab: '',
    oab_uf: '',
    plano: 'professional' as 'basic' | 'professional' | 'enterprise',
  });

  const reset = () =>
    setForm({ nome: '', email: '', senha: '', nomeEscritorio: '', oab: '', oab_uf: '', plano: 'professional' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome || !form.email || !form.senha || !form.nomeEscritorio) {
      toast({ title: 'Preencha todos os campos obrigatórios.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      // 1. Criar usuário no Auth
      const { data: authData, error: authError } = await supabase.auth.admin
        ? // Admin API não disponível no client — usamos signUp que auto-confirma via e-mail
          await (supabase.auth as any).admin.createUser({
            email: form.email,
            password: form.senha,
            email_confirm: true,
            user_metadata: { full_name: form.nome },
          })
        : { data: null, error: new Error('Admin API indisponível') };

      // Fallback: usa service role via Edge Function
      if (authError || !authData?.user) {
        const { data: fnData, error: fnError } = await supabase.functions.invoke('super-worker', {
          body: {
            nome: form.nome,
            email: form.email,
            senha: form.senha,
            nome_escritorio: form.nomeEscritorio,
            oab: form.oab,
            oab_uf: form.oab_uf,
            plano: form.plano,
          },
        });

        if (fnError) throw fnError;
        if (fnData?.error) throw new Error(fnData.error);

        toast({
          title: '✅ Usuário criado com cortesia!',
          description: `${form.nome} (${form.email}) — escritório "${form.nomeEscritorio}" criado com plano ${form.plano}.`,
        });
        reset();
        setOpen(false);
        onSuccess?.();
        return;
      }

      // Se admin API funcionou diretamente (ambiente local com service key exposta — não recomendado em prod)
      toast({
        title: '✅ Usuário criado com cortesia!',
        description: `${form.nome} — escritório "${form.nomeEscritorio}" com plano ${form.plano}.`,
      });
      reset();
      setOpen(false);
      onSuccess?.();
    } catch (err: any) {
      toast({ title: 'Erro ao criar usuário', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 rounded-2xl h-11 px-5 font-bold shadow-premium bg-emerald-600 hover:bg-emerald-700 text-white">
          <Gift className="h-4 w-4" />
          Criar Usuário Cortesia
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-lg rounded-3xl max-h-[90vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2 text-xl font-black">
            <UserPlus className="h-5 w-5 text-emerald-600" />
            Novo Usuário — Acesso Cortesia
          </DialogTitle>
          <DialogDescription>
            Crie um usuário e escritório com acesso gratuito. Sem cobrança, sem período de trial.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
        <div className="overflow-y-auto flex-1 space-y-4 py-2 pr-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label htmlFor="nome">Nome completo <span className="text-red-500">*</span></Label>
              <Input
                id="nome"
                placeholder="Dr. João Silva"
                value={form.nome}
                onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                required
              />
            </div>

            <div className="col-span-2 space-y-1">
              <Label htmlFor="email">E-mail <span className="text-red-500">*</span></Label>
              <Input
                id="email"
                type="email"
                placeholder="joao@escritorio.com.br"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                required
              />
            </div>

            <div className="col-span-2 space-y-1">
              <Label htmlFor="senha">Senha provisória <span className="text-red-500">*</span></Label>
              <Input
                id="senha"
                type="password"
                placeholder="Mínimo 8 caracteres"
                value={form.senha}
                onChange={e => setForm(f => ({ ...f, senha: e.target.value }))}
                minLength={8}
                required
              />
            </div>

            <div className="col-span-2 space-y-1">
              <Label htmlFor="escritorio">Nome do escritório <span className="text-red-500">*</span></Label>
              <Input
                id="escritorio"
                placeholder="Silva & Associados Advocacia"
                value={form.nomeEscritorio}
                onChange={e => setForm(f => ({ ...f, nomeEscritorio: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="oab">OAB (opcional)</Label>
              <Input
                id="oab"
                placeholder="123456"
                value={form.oab}
                onChange={e => setForm(f => ({ ...f, oab: e.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="oab_uf">UF OAB</Label>
              <Input
                id="oab_uf"
                placeholder="SP"
                maxLength={2}
                value={form.oab_uf}
                onChange={e => setForm(f => ({ ...f, oab_uf: e.target.value.toUpperCase() }))}
              />
            </div>

            <div className="col-span-2 space-y-1">
              <Label>Plano cortesia</Label>
              <Select value={form.plano} onValueChange={v => setForm(f => ({ ...f, plano: v as any }))}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">Básico — até 30 processos</SelectItem>
                  <SelectItem value="professional">Profissional — até 100 processos</SelectItem>
                  <SelectItem value="enterprise">Enterprise — ilimitado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-4 text-sm text-emerald-800 dark:text-emerald-300 flex gap-2">
            <Gift className="h-4 w-4 mt-0.5 shrink-0" />
            <span>Acesso vitalício sem cobrança. O usuário receberá as credenciais para fazer login imediatamente.</span>
          </div>
        </div>

          <DialogFooter className="pt-4 shrink-0 border-t mt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="rounded-xl">
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              {loading ? 'Criando...' : 'Criar com Cortesia'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
