import { useState } from 'react';
import { ExternalLink, ShieldCheck, ShieldAlert, Ban, Pin, Copy, Check, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { type JurisDoc, citacao, docData, docTitulo, fmtData, isPrecedente, sourceLabel, splitSnippet, tipoLabel } from '@/lib/juris';

interface Props {
  doc: JurisDoc;
  compact?: boolean;
  onConferir?: (doc: JurisDoc) => void;
  onAbrir?: (doc: JurisDoc) => void;
  onFixar?: (doc: JurisDoc) => void;
  fixado?: boolean;
}

export function StatusBadges({ doc }: { doc: JurisDoc }) {
  const st = doc.my_status;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {!isPrecedente(doc) && (
        <Badge className="bg-violet-600 text-white text-[9px] font-black uppercase tracking-widest rounded-lg">
          {tipoLabel(doc.document_type)} · não é precedente
        </Badge>
      )}
      {st === 'VERIFIED' ? (
        <Badge className="bg-emerald-600 text-white text-[9px] font-black uppercase tracking-widest rounded-lg gap-1"><ShieldCheck className="h-3 w-3" />Conferido por você</Badge>
      ) : st === 'BLOCKED' ? (
        <Badge className="bg-rose-600 text-white text-[9px] font-black uppercase tracking-widest rounded-lg gap-1"><Ban className="h-3 w-3" />Bloqueado</Badge>
      ) : (
        <Badge variant="outline" className="border-amber-500/60 text-amber-600 text-[9px] font-black uppercase tracking-widest rounded-lg gap-1"><ShieldAlert className="h-3 w-3" />Não conferido</Badge>
      )}
    </div>
  );
}

export function JurisResultCard({ doc, compact, onConferir, onAbrir, onFixar, fixado }: Props) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const partes = splitSnippet(doc.snippet || doc.summary?.slice(0, 240) || '');
  const podeCitar = doc.my_status === 'VERIFIED';

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(citacao(doc));
      setCopied(true); setTimeout(() => setCopied(false), 1500);
    } catch { toast({ title: 'Não foi possível copiar', variant: 'destructive' }); }
  };

  return (
    <div className={cn('rounded-2xl border border-black/5 dark:border-border bg-card p-4 space-y-2.5 transition-shadow hover:shadow-md', compact && 'p-3 space-y-2')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <StatusBadges doc={doc} />
          <p className="text-[11px] font-bold text-muted-foreground truncate">
            {doc.court || sourceLabel(doc.source_id)} · {doc.organ || '—'} · {tipoLabel(doc.document_type)} · {fmtData(docData(doc))}
          </p>
          <button type="button" onClick={() => onAbrir?.(doc)} className="text-left text-sm font-black leading-snug hover:text-primary transition-colors line-clamp-2">
            {docTitulo(doc)}
          </button>
          {doc.rapporteur && <p className="text-[11px] text-muted-foreground">Rel. {doc.rapporteur}</p>}
        </div>
        <span className="text-[10px] font-bold text-muted-foreground/60 shrink-0">{sourceLabel(doc.source_id)}</span>
      </div>

      {partes.length > 0 && (
        <p className={cn('text-[13px] leading-relaxed text-foreground/80', compact ? 'line-clamp-2' : 'line-clamp-4')}>
          {partes.map((p, i) => p.hit ? <mark key={i} className="bg-primary/20 text-foreground rounded px-0.5">{p.t}</mark> : <span key={i}>{p.t}</span>)}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        <Button asChild variant="outline" size="sm" className="h-8 rounded-xl text-[11px] font-bold gap-1.5">
          <a href={doc.official_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" />Fonte oficial</a>
        </Button>
        {onAbrir && (
          <Button variant="ghost" size="sm" className="h-8 rounded-xl text-[11px] font-bold gap-1.5" onClick={() => onAbrir(doc)}>
            <FileText className="h-3.5 w-3.5" />Abrir
          </Button>
        )}
        {onConferir && doc.my_status !== 'VERIFIED' && (
          <Button variant="secondary" size="sm" className="h-8 rounded-xl text-[11px] font-bold gap-1.5" onClick={() => onConferir(doc)}>
            <ShieldCheck className="h-3.5 w-3.5" />Conferir
          </Button>
        )}
        {onFixar && (
          <Button variant={fixado ? 'default' : 'ghost'} size="sm" className="h-8 rounded-xl text-[11px] font-bold gap-1.5" onClick={() => onFixar(doc)} disabled={fixado}>
            <Pin className="h-3.5 w-3.5" />{fixado ? 'Fixado' : 'Fixar'}
          </Button>
        )}
        <Button variant="ghost" size="sm" className="h-8 rounded-xl text-[11px] font-bold gap-1.5 ml-auto" onClick={copiar}
          disabled={!podeCitar} title={podeCitar ? 'Copiar citação' : 'Confira na fonte oficial antes de citar'}>
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}{copied ? 'Copiado' : 'Citação'}
        </Button>
      </div>
    </div>
  );
}
