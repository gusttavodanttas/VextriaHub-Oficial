import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Tag, Plus, Pencil, Loader2, Link2, Check, Power } from 'lucide-react';

interface Plan { id?: string; plan_type: string; plan_name: string; price_cents: number; cycle: string; trial_days: number | null; is_active: boolean; }

const CYCLES = [
  { v: 'MONTHLY', label: 'Mensal' },
  { v: 'QUARTERLY', label: 'Trimestral' },
  { v: 'SEMIANNUALLY', label: 'Semestral' },
  { v: 'YEARLY', label: 'Anual' },
];
const cycleLabel = (c: string) => CYCLES.find((x) => x.v === c)?.label || c;
const brl = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100);
const EMPTY: Plan = { plan_type: '', plan_name: '', price_cents: 0, cycle: 'MONTHLY', trial_days: 7, is_active: true };

export function PlanManagement() {
  const { toast } = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [form, setForm] = useState<Plan>(EMPTY);
  const [preco, setPreco] = useState('');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('plan_configs').select('*').order('price_cents');
    setPlans((data as Plan[]) || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditing(null); setForm(EMPTY); setPreco(''); setOpen(true); };
  const openEdit = (p: Plan) => { setEditing(p); setForm({ ...p }); setPreco(((p.price_cents || 0) / 100).toFixed(2).replace('.', ',')); setOpen(true); };

  const salvar = async () => {
    const cents = Math.round((parseFloat(preco.replace(/\./g, '').replace(',', '.')) || 0) * 100);
    if (!form.plan_name.trim() || !form.plan_type.trim() || cents <= 0) {
      toast({ title: 'Preencha nome, código e preço', variant: 'destructive' }); return;
    }
    setSaving(true);
    const row = {
      plan_type: form.plan_type.trim().toUpperCase().replace(/\s+/g, '_'),
      plan_name: form.plan_name.trim(), price_cents: cents, cycle: form.cycle,
      trial_days: Number(form.trial_days) || 0, is_active: form.is_active,
    };
    const res = editing?.id
      ? await supabase.from('plan_configs').update(row).eq('id', editing.id)
      : await supabase.from('plan_configs').insert(row);
    setSaving(false);
    if (res.error) {
      const dup = /duplicate|unique/i.test(res.error.message);
      toast({ title: 'Erro ao salvar', description: dup ? 'Já existe um plano ATIVO com esse código. Use outro código ou desative o antigo.' : res.error.message, variant: 'destructive' });
      return;
    }
    toast({ title: editing ? 'Plano atualizado' : 'Plano criado' });
    setOpen(false); load();
  };

  const toggle = async (p: Plan) => {
    const { error } = await supabase.from('plan_configs').update({ is_active: !p.is_active }).eq('id', p.id!);
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else load();
  };

  const copyLink = async (p: Plan) => {
    const link = `${window.location.origin}/cadastro?plano=${encodeURIComponent(p.plan_type)}`;
    try { await navigator.clipboard.writeText(link); setCopied(p.plan_type); setTimeout(() => setCopied(null), 1600); }
    catch { toast({ title: 'Link de cadastro', description: link }); }
  };

  return (
    <Card className="border-black/5 dark:border-border bg-card/20 rounded-[2rem] shadow-premium overflow-hidden">
      <CardHeader className="border-b border-black/5 dark:border-border pb-4 flex flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0"><Tag className="h-5 w-5" /></div>
          <div>
            <CardTitle className="text-lg font-black">Gestão de Planos</CardTitle>
            <CardDescription className="text-xs font-medium">Crie e edite planos, ciclos (mensal/semestral/anual) e o link de cadastro de cada um.</CardDescription>
          </div>
        </div>
        <Button onClick={openNew} className="rounded-xl font-bold gap-2"><Plus className="h-4 w-4" /> Novo plano</Button>
      </CardHeader>
      <CardContent className="p-4 md:p-5 space-y-2.5">
        {loading ? <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary/40" /></div>
          : plans.length === 0 ? <p className="text-center py-10 text-sm text-muted-foreground">Nenhum plano cadastrado. Clique em "Novo plano".</p>
          : plans.map((p) => (
            <div key={p.id} className={`flex flex-wrap items-center gap-3 p-4 rounded-2xl border ${p.is_active ? 'border-black/5 dark:border-border bg-black/[0.01] dark:bg-white/[0.01]' : 'border-dashed border-black/10 dark:border-border opacity-60'}`}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm">{p.plan_name}</span>
                  <Badge variant="secondary" className="rounded-md text-[10px] font-black">{cycleLabel(p.cycle)}</Badge>
                  <span className="font-mono text-[10px] text-muted-foreground">{p.plan_type}</span>
                  {!p.is_active && <Badge variant="outline" className="text-[9px]">inativo</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{brl(p.price_cents)} · {p.trial_days ? `${p.trial_days} dias de trial` : 'sem trial'}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="sm" onClick={() => copyLink(p)} className="h-8 gap-1.5 text-xs" title="Copiar link de cadastro">
                  {copied === p.plan_type ? <><Check className="h-3.5 w-3.5 text-emerald-500" /> Copiado</> : <><Link2 className="h-3.5 w-3.5" /> Link</>}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => openEdit(p)} className="h-8 w-8" title="Editar"><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => toggle(p)} className={`h-8 w-8 ${p.is_active ? 'text-rose-500/70 hover:text-rose-500' : 'text-emerald-500/70 hover:text-emerald-500'}`} title={p.is_active ? 'Desativar' : 'Ativar'}><Power className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[460px] rounded-[1.5rem]">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar plano' : 'Novo plano'}</DialogTitle>
            <DialogDescription className="text-xs">O código identifica o plano no link de cadastro e na cobrança — deve ser único entre os ativos.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs font-bold">Nome do plano</Label>
                <Input value={form.plan_name} onChange={(e) => setForm({ ...form, plan_name: e.target.value })} placeholder="Ex: Avançado Anual" className="rounded-xl h-11" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Código</Label>
                <Input value={form.plan_type} onChange={(e) => setForm({ ...form, plan_type: e.target.value })} placeholder="AVANCADO_ANUAL" className="rounded-xl h-11 font-mono uppercase" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Preço (R$)</Label>
                <Input value={preco} onChange={(e) => setPreco(e.target.value)} placeholder="197,00" inputMode="decimal" className="rounded-xl h-11" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Ciclo de cobrança</Label>
                <Select value={form.cycle} onValueChange={(v) => setForm({ ...form, cycle: v })}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>{CYCLES.map((c) => <SelectItem key={c.v} value={c.v}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Dias de trial</Label>
                <Input type="number" min={0} value={form.trial_days ?? 0} onChange={(e) => setForm({ ...form, trial_days: parseInt(e.target.value) || 0 })} className="rounded-xl h-11" />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border p-3">
              <Label className="text-sm font-bold">Plano ativo (aparece no cadastro)</Label>
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={salvar} disabled={saving} className="rounded-xl font-bold gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {editing ? 'Salvar' : 'Criar plano'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
