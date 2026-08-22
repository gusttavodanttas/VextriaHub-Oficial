import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Radar, Plus, Trash2, Loader2, ShieldAlert } from 'lucide-react';

interface MonitoredOab { id: string; oab: string; uf: string; label: string | null; }

/**
 * Gestão das OABs que o escritório monitora. O robô diário e a busca só olham
 * estas OABs (curadas pelo admin), até o teto do plano (plan_configs.max_oabs).
 */
export function MonitoredOabs() {
  const { user } = useAuth();
  const { canManageOffice } = useUserRole();
  const { toast } = useToast();
  const [rows, setRows] = useState<MonitoredOab[]>([]);
  const [quota, setQuota] = useState<{ used: number; limit: number }>({ used: 0, limit: 1 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ oab: '', uf: '', label: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: list }, { data: q }] = await Promise.all([
      supabase.from('monitored_oabs').select('id, oab, uf, label').order('created_at'),
      supabase.rpc('my_oab_quota'),
    ]);
    const listRows = (list as MonitoredOab[]) || [];
    setRows(listRows);
    const qq = (q ?? {}) as { used?: number; limit?: number };
    setQuota({ used: qq.used ?? listRows.length, limit: qq.limit ?? 1 });
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const unlimited = quota.limit >= 9999;
  const atLimit = !unlimited && quota.used >= quota.limit;

  const add = async () => {
    const oab = form.oab.replace(/\D/g, '');
    const uf = form.uf.trim().toUpperCase();
    if (!oab || uf.length !== 2) { toast({ title: 'Informe a OAB e a UF (2 letras)', variant: 'destructive' }); return; }
    if (!user?.office_id) { toast({ title: 'Escritório não identificado', variant: 'destructive' }); return; }
    setSaving(true);
    const { error } = await supabase.from('monitored_oabs').insert({
      office_id: user.office_id, oab, uf, label: form.label.trim() || null, added_by: user.id,
    });
    setSaving(false);
    if (error) {
      const quotaHit = /Limite de OABs/i.test(error.message);
      const dup = /duplicate|unique/i.test(error.message);
      toast({
        title: quotaHit ? 'Limite do plano atingido' : dup ? 'Essa OAB já está no monitoramento' : 'Erro ao adicionar',
        description: quotaHit ? 'Faça upgrade do plano para monitorar mais OABs.' : dup ? undefined : error.message,
        variant: 'destructive',
      });
      return;
    }
    setForm({ oab: '', uf: '', label: '' });
    toast({ title: 'OAB adicionada ao monitoramento' });
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('monitored_oabs').delete().eq('id', id);
    if (error) { toast({ title: 'Erro ao remover', description: error.message, variant: 'destructive' }); return; }
    setRows((prev) => prev.filter((r) => r.id !== id));
    setQuota((qq) => ({ ...qq, used: Math.max(0, qq.used - 1) }));
    toast({ title: 'OAB removida do monitoramento' });
  };

  return (
    <Card className="glass-card rounded-[2rem] border-black/5 dark:border-border overflow-hidden shadow-premium">
      <CardHeader className="border-b border-black/5 dark:border-border pb-4 flex flex-row items-center gap-3">
        <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0"><Radar className="h-5 w-5" /></div>
        <div className="flex-1 min-w-0">
          <CardTitle className="text-lg font-black">OABs monitoradas</CardTitle>
          <CardDescription className="text-xs font-medium">
            O robô diário e a busca acompanham publicações e processos só destas OABs.{' '}
            {unlimited ? 'Seu plano é sem limite.' : `${quota.used} de ${quota.limit} usadas no seu plano.`}
          </CardDescription>
        </div>
        {!unlimited && (
          <span className={`text-sm font-black px-3 py-1.5 rounded-xl shrink-0 ${atLimit ? 'bg-amber-500/10 text-amber-600' : 'bg-primary/10 text-primary'}`}>{quota.used}/{quota.limit}</span>
        )}
      </CardHeader>
      <CardContent className="p-4 md:p-6 space-y-4">
        {!canManageOffice ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Só o administrador do escritório pode gerenciar as OABs monitoradas.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-2 p-3 rounded-2xl bg-muted/30 border border-black/5 dark:border-border">
              <div className="space-y-1.5 flex-1 min-w-[140px]">
                <Label className="text-xs font-bold">Nome do advogado (opcional)</Label>
                <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Dra. Fulana de Tal" className="rounded-xl h-11" />
              </div>
              <div className="space-y-1.5 w-28">
                <Label className="text-xs font-bold">OAB (nº)</Label>
                <Input value={form.oab} onChange={(e) => setForm({ ...form, oab: e.target.value })} placeholder="123456" inputMode="numeric" className="rounded-xl h-11" />
              </div>
              <div className="space-y-1.5 w-20">
                <Label className="text-xs font-bold">UF</Label>
                <Input value={form.uf} onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase().slice(0, 2) })} placeholder="DF" className="rounded-xl h-11 uppercase" />
              </div>
              <Button onClick={add} disabled={saving || atLimit} className="rounded-xl h-11 font-bold gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Adicionar
              </Button>
            </div>

            {atLimit && (
              <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-500/10 rounded-xl px-3 py-2.5">
                <ShieldAlert className="h-4 w-4 shrink-0" /> Você atingiu o limite de OABs do seu plano. Faça upgrade para monitorar mais.
              </div>
            )}

            {loading ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary/40" /></div>
              : rows.length === 0 ? <p className="text-center py-8 text-sm text-muted-foreground">Nenhuma OAB monitorada ainda. Adicione a sua acima para o robô começar a acompanhar.</p>
              : (
                <div className="space-y-2">
                  {rows.map((r) => (
                    <div key={r.id} className="flex items-center gap-3 p-3.5 rounded-2xl border border-black/5 dark:border-border bg-black/[0.01] dark:bg-white/[0.01]">
                      <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0 font-black text-[11px]">{r.uf}</div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-sm truncate">{r.label || `OAB ${r.oab}/${r.uf}`}</p>
                        <p className="text-xs text-muted-foreground">OAB {r.oab}/{r.uf}</p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => remove(r.id)} className="h-9 w-9 text-rose-500/70 hover:text-rose-500 shrink-0" title="Remover"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </div>
              )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
