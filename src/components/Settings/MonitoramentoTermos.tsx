import { useState, useCallback } from 'react';
import { DeleteConfirmDialog } from '@/components/ui/DeleteConfirmDialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useMonitoramentoTermos, type TermoTipo } from '@/hooks/useMonitoramentoTermos';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { SearchCheck, Plus, Trash2, Loader2, ShieldAlert, AlertTriangle } from 'lucide-react';

const TIPO_LABEL: Record<TermoTipo, string> = {
  nome: 'Nome da parte',
  processo: 'Nº do processo',
  cpf_cnpj: 'CPF/CNPJ',
  oab: 'OAB avulsa',
};
const TIPO_PLACEHOLDER: Record<TermoTipo, string> = {
  nome: 'Ex.: João da Silva',
  processo: '0000000-00.0000.0.00.0000',
  cpf_cnpj: '000.000.000-00',
  oab: '123456',
};

const LIMITE_TERMOS = 15;

/**
 * Termos livres que o robô diário de publicações também acompanha, além das
 * OABs monitoradas: nome de parte, número de processo, CPF/CNPJ ou uma OAB
 * avulsa (ex.: a parte contrária, que não pertence a um advogado do escritório).
 */
export function MonitoramentoTermos() {
  const { user } = useAuth();
  const { canManageOffice } = useUserRole();
  const { toast } = useToast();
  const { termos, loading, error, refresh } = useMonitoramentoTermos();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{ termo: string; tipo: TermoTipo; seccional: string }>({ termo: '', tipo: 'nome', seccional: '' });

  const atLimite = termos.length >= LIMITE_TERMOS;

  const add = useCallback(async () => {
    const termo = form.termo.trim();
    if (!termo) { toast({ title: 'Informe o termo a monitorar', variant: 'destructive' }); return; }
    if (!user?.office_id) { toast({ title: 'Escritório não identificado', variant: 'destructive' }); return; }
    setSaving(true);
    const { error } = await supabase.from('monitoramento_termos').insert({
      office_id: user.office_id,
      termo,
      tipo: form.tipo,
      seccional: form.seccional.trim() ? form.seccional.trim().toUpperCase() : null,
    });
    setSaving(false);
    if (error) {
      toast({ title: 'Erro ao adicionar', description: error.message, variant: 'destructive' });
      return;
    }
    setForm({ termo: '', tipo: form.tipo, seccional: '' });
    toast({ title: 'Termo adicionado ao monitoramento' });
    refresh();
  }, [form, user, toast, refresh]);

  // .select('id') nos dois: a RLS barrando casa 0 linhas sem erro — o switch/lista
  // mostravam a mudança e ela sumia no F5.
  const toggleAtivo = useCallback(async (id: string, ativo: boolean) => {
    const { data, error } = await supabase.from('monitoramento_termos').update({ ativo }).eq('id', id).select('id');
    if (error || !data?.length) { toast({ title: 'Erro ao atualizar', description: error?.message ?? 'Sem permissão para alterar este termo.', variant: 'destructive' }); return; }
    refresh();
  }, [toast, refresh]);

  const [removeTarget, setRemoveTarget] = useState<{ id: string; termo: string } | null>(null);
  const remove = useCallback(async (id: string) => {
    const { data, error } = await supabase.from('monitoramento_termos').delete().eq('id', id).select('id');
    if (error || !data?.length) { toast({ title: 'Erro ao remover', description: error?.message ?? 'Sem permissão para remover este termo.', variant: 'destructive' }); return; }
    toast({ title: 'Termo removido do monitoramento' });
    refresh();
  }, [toast, refresh]);

  return (
    <Card className="glass-card rounded-[2rem] border-black/5 dark:border-border overflow-hidden shadow-premium">
      <CardHeader className="border-b border-black/5 dark:border-border pb-4 flex flex-row items-center gap-3">
        <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0"><SearchCheck className="h-5 w-5" /></div>
        <div className="flex-1 min-w-0">
          <CardTitle className="text-lg font-black">Monitoramento por termo</CardTitle>
          <CardDescription className="text-xs font-medium">
            Acompanhe intimações por nome de parte, número de processo, CPF/CNPJ ou OAB da parte contrária — além das suas OABs monitoradas. Processo ainda não cadastrado cai em "Processos Encontrados". {termos.length} de {LIMITE_TERMOS} usados.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="p-4 md:p-6 space-y-4">
        {!canManageOffice ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Só o administrador do escritório pode gerenciar o monitoramento por termo.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-2 p-3 rounded-2xl bg-muted/30 border border-black/5 dark:border-border">
              <div className="space-y-1.5 w-40">
                <Label className="text-xs font-bold">Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v as TermoTipo })}>
                  <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TIPO_LABEL) as TermoTipo[]).map((t) => (
                      <SelectItem key={t} value={t}>{TIPO_LABEL[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 flex-1 min-w-[160px]">
                <Label className="text-xs font-bold">Termo</Label>
                <Input value={form.termo} onChange={(e) => setForm({ ...form, termo: e.target.value })} placeholder={TIPO_PLACEHOLDER[form.tipo]} className="rounded-xl h-11" />
              </div>
              <div className="space-y-1.5 w-24">
                <Label className="text-xs font-bold">UF (opc.)</Label>
                <Input value={form.seccional} onChange={(e) => setForm({ ...form, seccional: e.target.value.toUpperCase().slice(0, 2) })} placeholder="DF" className="rounded-xl h-11 uppercase" />
              </div>
              <Button onClick={add} disabled={saving || atLimite} className="rounded-xl h-11 font-bold gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Adicionar
              </Button>
            </div>

            {atLimite && (
              <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-500/10 rounded-xl px-3 py-2.5">
                <ShieldAlert className="h-4 w-4 shrink-0" /> Limite de {LIMITE_TERMOS} termos monitorados atingido. Remova um termo para adicionar outro.
              </div>
            )}

            {error && (
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
                <div className="flex items-center gap-2.5 min-w-0">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                  <p className="text-xs font-bold text-destructive truncate">{error}</p>
                </div>
                <Button variant="outline" size="sm" onClick={refresh} className="rounded-xl font-bold shrink-0">Tentar novamente</Button>
              </div>
            )}

            {loading ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary/40" /></div>
              : error ? null
              : termos.length === 0 ? <p className="text-center py-8 text-sm text-muted-foreground">Nenhum termo monitorado ainda. Adicione um acima para o robô começar a acompanhar.</p>
              : (
                <div className="space-y-2">
                  {termos.map((t) => (
                    <div key={t.id} className="flex items-center gap-3 p-3.5 rounded-2xl border border-black/5 dark:border-border bg-black/[0.01] dark:bg-white/[0.01]">
                      <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0 font-black text-[10px] text-center">{TIPO_LABEL[t.tipo].split(' ')[0]}</div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-sm truncate">{t.termo}{t.seccional ? ` (${t.seccional})` : ''}</p>
                        <p className="text-xs text-muted-foreground">
                          {TIPO_LABEL[t.tipo]}
                          {t.ultima_busca ? ` · última busca ${new Date(t.ultima_busca).toLocaleDateString('pt-BR')}` : ' · ainda não buscado'}
                        </p>
                      </div>
                      <Switch checked={t.ativo} onCheckedChange={(v) => toggleAtivo(t.id, v)} aria-label={t.ativo ? 'Ativo' : 'Pausado'} />
                      <Button variant="ghost" size="icon" onClick={() => setRemoveTarget({ id: t.id, termo: t.termo })} className="h-9 w-9 text-rose-500/70 hover:text-rose-500 shrink-0" title="Remover" aria-label="Remover termo"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </div>
              )}
          </>
        )}
      </CardContent>
      <DeleteConfirmDialog
        open={!!removeTarget}
        onOpenChange={(o) => { if (!o) setRemoveTarget(null); }}
        title="Parar de monitorar termo"
        description={`O robô deixa de buscar publicações com "${removeTarget?.termo ?? ''}".`}
        confirmText="Remover"
        onConfirm={() => { const alvo = removeTarget; setRemoveTarget(null); if (alvo) remove(alvo.id); }}
      />
    </Card>
  );
}
