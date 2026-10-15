import { useState } from 'react';
import { ExternalLink, ShieldCheck, Copy, Check, Link2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useJurisDoc, useJurisReviews } from '@/hooks/useJurisprudencia';
import { type JurisDoc, citacao, docData, docTitulo, fmtData, sourceLabel, tipoLabel } from '@/lib/juris';
import { StatusBadges } from './JurisResultCard';
import { useToast } from '@/hooks/use-toast';

interface Props {
  docId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onConferir?: (doc: JurisDoc) => void;
}

/** Registro completo: ementa, inteiro teor (se houver), outros registros do mesmo processo, citação. */
export function JurisDocDialog({ docId, open, onOpenChange, onConferir }: Props) {
  const { data, isLoading } = useJurisDoc(open ? docId : null);
  const { desfazer } = useJurisReviews();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const doc = data?.doc ? { ...data.doc, my_status: data.myStatus } : null;
  const meta = (doc?.metadata || {}) as Record<string, string | undefined>;

  const copiar = async () => {
    if (!doc) return;
    try { await navigator.clipboard.writeText(citacao(doc)); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { toast({ title: 'Não foi possível copiar', variant: 'destructive' }); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[90vh] rounded-2xl p-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border shrink-0">
          <DialogTitle className="font-black text-lg leading-snug">{doc ? docTitulo(doc) : 'Registro'}</DialogTitle>
          <DialogDescription className="text-xs">
            {doc ? `${doc.court || sourceLabel(doc.source_id)} · ${doc.organ || '—'} · ${tipoLabel(doc.document_type)} · julg. ${fmtData(doc.judgment_date)} · publ. ${fmtData(doc.publication_date)}${doc.rapporteur ? ` · Rel. ${doc.rapporteur}` : ''}` : ''}
          </DialogDescription>
          {doc && <StatusBadges doc={doc} />}
        </DialogHeader>

        <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
          {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {doc && (
            <>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm" className="rounded-xl gap-1.5"><a href={doc.official_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" />Fonte oficial</a></Button>
                {doc.my_status !== 'VERIFIED' && onConferir && (
                  <Button size="sm" className="rounded-xl gap-1.5" onClick={() => onConferir(doc)}><ShieldCheck className="h-4 w-4" />Conferir</Button>
                )}
                {doc.my_status && (
                  <Button variant="ghost" size="sm" className="rounded-xl" onClick={() => desfazer.mutate(doc.doc_id)}>Desfazer conferência</Button>
                )}
                <Button variant="ghost" size="sm" className="rounded-xl gap-1.5 ml-auto" onClick={copiar} disabled={doc.my_status !== 'VERIFIED'} title={doc.my_status === 'VERIFIED' ? 'Copiar citação' : 'Confira antes de citar'}>
                  {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}Citação
                </Button>
              </div>
              {meta.scon_busca && (
                <p className="text-[12px] text-muted-foreground">
                  Ementa no SCON: abra <a className="underline" href="https://scon.stj.jus.br/SCON/" target="_blank" rel="noopener noreferrer">scon.stj.jus.br</a> e cole o nº de registro <b>{meta.numeroRegistro}</b>{meta.registro_formatado ? ` (${meta.registro_formatado})` : ''}. O SCON ignora o link aberto de fora do site.
                </p>
              )}
              {doc.summary && (
                <section className="space-y-1.5">
                  <h3 className="text-[10px] uppercase font-black tracking-[0.2em] text-muted-foreground/50">Ementa</h3>
                  <p className="text-[14px] leading-relaxed whitespace-pre-wrap">{doc.summary}</p>
                </section>
              )}
              {doc.full_text && (
                <details className="rounded-xl border border-border p-3">
                  <summary className="cursor-pointer text-[12px] font-black uppercase tracking-wider text-muted-foreground">Inteiro teor / texto extraído</summary>
                  <p className="mt-2 text-[13px] leading-relaxed whitespace-pre-wrap">{doc.full_text}</p>
                </details>
              )}
              {(data?.mesmoProcesso?.length ?? 0) > 0 && (
                <>
                  <Separator />
                  <section className="space-y-1.5">
                    <h3 className="text-[10px] uppercase font-black tracking-[0.2em] text-muted-foreground/50 flex items-center gap-1.5"><Link2 className="h-3.5 w-3.5" />Mesmo processo em outros registros</h3>
                    <ul className="space-y-1">
                      {data!.mesmoProcesso.map((o) => (
                        <li key={o.doc_id} className="text-[13px]"><span className="font-bold">{docTitulo(o)}</span> · {sourceLabel(o.source_id)} · {tipoLabel(o.document_type)} · {fmtData(docData(o))}</li>
                      ))}
                    </ul>
                  </section>
                </>
              )}
              <p className="text-[11px] text-muted-foreground/70">Registro {doc.doc_id} · fonte {sourceLabel(doc.source_id)} · captura {fmtData(doc.captured_at)} · hash {String(doc.content_sha256 || '').slice(0, 12)}</p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
