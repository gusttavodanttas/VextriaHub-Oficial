import { useEffect, useState } from 'react';
import { ExternalLink, ShieldCheck, Ban } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useJurisReviews } from '@/hooks/useJurisprudencia';
import { type JurisDoc, docTitulo, urlIgual } from '@/lib/juris';

interface Props {
  doc: JurisDoc | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

/**
 * Conferência humana (regra do kit): abrir a fonte oficial, conferir número, órgão, data, relator e
 * texto, e colar a MESMA URL que está registrada. Só então o registro passa a CONFERIDO — para este
 * advogado. Nada é automático aqui de propósito.
 */
export function ConferirDialog({ doc, open, onOpenChange }: Props) {
  const { conferir, bloquear } = useJurisReviews();
  const [url, setUrl] = useState('');
  const [nota, setNota] = useState('');
  const [motivo, setMotivo] = useState('');
  const [modo, setModo] = useState<'conferir' | 'bloquear'>('conferir');

  useEffect(() => { if (open) { setUrl(''); setNota(''); setMotivo(''); setModo('conferir'); } }, [open, doc?.doc_id]);
  if (!doc) return null;
  const urlOk = urlIgual(url, doc.official_url) && url.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-black">{modo === 'conferir' ? 'Conferir na fonte oficial' : 'Bloquear para uso jurídico'}</DialogTitle>
          <DialogDescription className="text-xs">{docTitulo(doc)}</DialogDescription>
        </DialogHeader>

        {modo === 'conferir' ? (
          <div className="space-y-4">
            <ol className="text-[13px] leading-relaxed space-y-1 list-decimal pl-4">
              <li>Abra a fonte oficial e confira número, órgão, data, relator e o texto.</li>
              <li>Veja se houve superação, revisão de tese ou cancelamento.</li>
              <li>Cole aqui a URL exatamente como abriu.</li>
            </ol>
            <Button asChild variant="outline" className="rounded-xl w-full gap-2">
              <a href={doc.official_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" />Abrir fonte oficial</a>
            </Button>
            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">URL que você abriu *</Label>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className="rounded-xl" />
              {url && !urlOk && <p className="text-[11px] text-rose-500 font-bold">Diferente da URL oficial registrada. Confira e cole a mesma.</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Nota (opcional)</Label>
              <Textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={2} className="rounded-xl resize-none" placeholder="Ex.: tese ainda vigente; aplicável ao caso X" />
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Motivo *</Label>
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} className="rounded-xl resize-none" placeholder="Ex.: tese superada pelo Tema 1.194; súmula cancelada" />
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="ghost" className="rounded-xl mr-auto text-rose-500 gap-1.5" onClick={() => setModo(modo === 'conferir' ? 'bloquear' : 'conferir')}>
            {modo === 'conferir' ? <><Ban className="h-4 w-4" />Bloquear</> : 'Voltar'}
          </Button>
          <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>Cancelar</Button>
          {modo === 'conferir' ? (
            <Button className="rounded-xl gap-1.5" disabled={!urlOk || conferir.isPending}
              onClick={() => conferir.mutate({ doc, urlInformada: url, nota }, { onSuccess: () => onOpenChange(false) })}>
              <ShieldCheck className="h-4 w-4" />Marcar como conferido
            </Button>
          ) : (
            <Button variant="destructive" className="rounded-xl" disabled={motivo.trim().length < 5 || bloquear.isPending}
              onClick={() => bloquear.mutate({ doc, motivo }, { onSuccess: () => onOpenChange(false) })}>
              Bloquear
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
