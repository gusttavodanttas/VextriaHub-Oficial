import { useEffect, useState } from 'react';
import { BellRing, Save } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useNormaAlertas } from '@/hooks/useJurisprudencia';

const ORGAOS = [
  { id: 'ANS', label: 'ANS', desc: 'Resoluções Normativas, RDC, Rol' },
  { id: 'CFO', label: 'CFO', desc: 'Resoluções, Decisões, Portarias' },
  { id: 'CRO', label: 'CROs', desc: 'Atos dos conselhos regionais no DOU' },
];

/** Configurações → Alertas de normas: preferência INDIVIDUAL; gera notificações quando a sincronização traz ato novo. */
export function NormaAlertasConfig() {
  const { prefs, isLoading, salvar } = useNormaAlertas();
  const [ativo, setAtivo] = useState(false);
  const [orgaos, setOrgaos] = useState<string[]>(['ANS', 'CFO', 'CRO']);
  const [termos, setTermos] = useState('');
  useEffect(() => { if (prefs) { setAtivo(prefs.ativo); setOrgaos(prefs.orgaos || []); setTermos((prefs.termos || []).join(', ')); } }, [prefs]);

  const toggleOrgao = (id: string) => setOrgaos((o) => o.includes(id) ? o.filter((x) => x !== id) : [...o, id]);
  const onSalvar = () => salvar.mutate({ ativo, orgaos, termos: termos.split(',').map((t) => t.trim()).filter((t) => t.length >= 3) });

  return (
    <Card className="glass-card rounded-[2rem] border-black/5 dark:border-border overflow-hidden shadow-premium">
      <CardHeader className="border-b border-black/5 dark:border-border pb-4 flex flex-row items-center gap-3">
        <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0"><BellRing className="h-5 w-5" /></div>
        <div>
          <CardTitle className="text-lg font-black">Alertas de normas</CardTitle>
          <CardDescription className="text-xs font-medium">Aviso em Notificações quando sair norma nova da ANS, do CFO ou dos CROs, ou que contenha os seus termos. Só para você.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-5">
        <div className="flex items-center justify-between rounded-2xl border border-black/5 dark:border-border p-4">
          <div><p className="text-sm font-black">Receber alertas de normas</p><p className="text-xs text-muted-foreground">Ligue para escolher os órgãos e termos.</p></div>
          <Switch checked={ativo} onCheckedChange={setAtivo} disabled={isLoading} />
        </div>
        <div className={cn('grid gap-2 sm:grid-cols-3', !ativo && 'opacity-50 pointer-events-none')}>
          {ORGAOS.map((o) => {
            const on = orgaos.includes(o.id);
            return (
              <button key={o.id} type="button" onClick={() => toggleOrgao(o.id)} aria-pressed={on}
                className={cn('rounded-2xl border-2 p-3 text-left transition-all', on ? 'border-primary bg-primary/5' : 'border-black/5 dark:border-border hover:border-primary/40')}>
                <p className={cn('text-sm font-black', on && 'text-primary')}>{o.label}</p>
                <p className="text-[11px] text-muted-foreground">{o.desc}</p>
              </button>
            );
          })}
        </div>
        <div className={cn('space-y-1.5', !ativo && 'opacity-50 pointer-events-none')}>
          <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Termos livres <span className="normal-case font-medium text-muted-foreground/60">(separados por vírgula; casam com título, ementa ou órgão)</span></Label>
          <Input value={termos} onChange={(e) => setTermos(e.target.value)} placeholder="plano de saúde, rol de procedimentos, odontologia" className="rounded-xl" />
        </div>
        <Button onClick={onSalvar} disabled={salvar.isPending || isLoading} className="rounded-xl gap-2"><Save className="h-4 w-4" />Salvar</Button>
      </CardContent>
    </Card>
  );
}
