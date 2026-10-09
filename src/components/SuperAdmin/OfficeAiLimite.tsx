import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sparkles, RefreshCw, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/lib/errors';
import { limparAiLimite, salvarAiLimite, useAiUsoEscritorio } from '@/hooks/useAiLimites';

// Seção "Inteligência artificial" do diálogo de edição de escritório (super
// admin): consumo do mês e teto por escritório. Salva fora do submit do form
// principal, como as ações de acesso/cobrança.

const fmt = (n: number) => n.toLocaleString('pt-BR');

export function OfficeAiLimite({ officeId }: { officeId: string }) {
  const { toast } = useToast();
  const { uso, limite, loading, error, refetch } = useAiUsoEscritorio(officeId);
  const [chamadas, setChamadas] = useState('');
  const [voz, setVoz] = useState('');
  const [obs, setObs] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setChamadas(limite?.limite_chamadas == null ? '' : String(limite.limite_chamadas));
    setVoz(limite?.limite_voz_caracteres == null ? '' : String(limite.limite_voz_caracteres));
    setObs(limite?.observacao ?? '');
  }, [limite]);

  const parse = (v: string): number | null => {
    const t = v.trim();
    if (t === '') return null;
    const n = Number(t);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
  };

  const salvar = async () => {
    setSaving(true);
    try {
      await salvarAiLimite(officeId, {
        limite_chamadas: parse(chamadas),
        limite_voz_caracteres: parse(voz),
        observacao: obs.trim() || null,
      });
      toast({ title: 'Teto de IA salvo', description: 'Vale a partir da próxima chamada do escritório.' });
      await refetch();
    } catch (e) {
      toast({ title: 'Não foi possível salvar o teto', description: getErrorMessage(e), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const restaurar = async () => {
    setSaving(true);
    try {
      await limparAiLimite(officeId);
      toast({ title: 'Teto removido', description: 'O escritório volta ao padrão global.' });
      await refetch();
    } catch (e) {
      toast({ title: 'Não foi possível remover o teto', description: getErrorMessage(e), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 mt-6">
      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60 border-b border-muted/20 pb-1 flex items-center gap-1.5">
        <Sparkles className="h-3 w-3" /> Inteligência artificial
      </h4>

      {error ? (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs">
          <span className="text-destructive font-bold truncate">{error}</span>
          <Button type="button" size="sm" variant="outline" onClick={refetch} className="h-7 rounded-lg text-xs">Tentar de novo</Button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { label: 'Chamadas no mês', value: fmt(uso.chamadas) },
            { label: 'Tokens no mês', value: fmt(uso.tokens_prompt + uso.tokens_resposta) },
            { label: 'Voz (caracteres)', value: fmt(uso.voz_caracteres) },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-border bg-muted/20 py-2">
              <p className="text-base font-black">{loading ? '…' : s.value}</p>
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Teto de chamadas/mês</Label>
          <Input type="number" min={0} value={chamadas} onChange={e => setChamadas(e.target.value)}
            placeholder="padrão global" className="h-10 bg-muted/20 border-none rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Teto de voz (caracteres/mês)</Label>
          <Input type="number" min={0} value={voz} onChange={e => setVoz(e.target.value)}
            placeholder="padrão global" className="h-10 bg-muted/20 border-none rounded-xl" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Observação (opcional)</Label>
        <Input value={obs} onChange={e => setObs(e.target.value)} placeholder="Ex.: cortesia negociada até dezembro"
          className="h-10 bg-muted/20 border-none rounded-xl" />
      </div>
      <p className="text-[10px] text-muted-foreground">Vazio usa o padrão global das functions. Zero libera sem teto. O contador zera no dia 1º.</p>

      <div className="flex gap-2">
        <Button type="button" variant="outline" disabled={saving || !limite} onClick={restaurar} className="h-10 rounded-xl gap-1.5">
          <RotateCcw className="h-3.5 w-3.5" /> Voltar ao padrão
        </Button>
        <Button type="button" disabled={saving} onClick={salvar} className="h-10 rounded-xl gap-1.5 ml-auto">
          {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Salvar teto
        </Button>
      </div>
    </div>
  );
}
