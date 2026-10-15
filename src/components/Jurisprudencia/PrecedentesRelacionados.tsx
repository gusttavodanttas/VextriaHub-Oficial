import { useEffect, useState } from 'react';
import { Search, Scale, Pin, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useJurisPins, useJurisSearch, type AlvoTipo } from '@/hooks/useJurisprudencia';
import { type JurisDoc, docTitulo, fmtData, docData, sourceLabel } from '@/lib/juris';
import { JurisResultCard, StatusBadges } from './JurisResultCard';
import { ConferirDialog } from './ConferirDialog';
import { JurisDocDialog } from './JurisDocDialog';

interface Props {
  alvoTipo: AlvoTipo;
  alvoId: string;
  sugestao?: string;          // termos sugeridos a partir do texto da publicação/consultivo
  titulo?: string;
  apenasNormas?: boolean;
}

/**
 * "Precedentes relacionados": pesquisa no acervo a partir do contexto (publicação, consultivo,
 * processo) e deixa o advogado FIXAR os que interessam ao alvo. Fixações e conferências são
 * privadas do usuário. Nada aqui é citável sem a conferência na fonte oficial.
 */
export function PrecedentesRelacionados({ alvoTipo, alvoId, sugestao = '', titulo = 'Precedentes relacionados', apenasNormas }: Props) {
  const [q, setQ] = useState(sugestao);
  const [buscar, setBuscar] = useState(sugestao);
  const [conferindo, setConferindo] = useState<JurisDoc | null>(null);
  const [abrindo, setAbrindo] = useState<string | null>(null);
  const { pins, fixar, remover } = useJurisPins(alvoTipo, alvoId);
  const { data: resultados, isFetching } = useJurisSearch(buscar, { tipo: apenasNormas ? 'norma' : 'precedente', limit: 6 }, buscar.trim().length > 0);
  useEffect(() => { setQ(sugestao); setBuscar(sugestao); }, [sugestao, alvoId]);
  const fixados = new Set(pins.map((p) => p.doc_id));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-[10px] uppercase font-black tracking-[0.2em] text-muted-foreground/50 flex items-center gap-1.5"><Scale className="h-3.5 w-3.5" />{titulo}</label>
        <span className="text-[10px] text-muted-foreground">só você vê o que fixa e confere</span>
      </div>

      {pins.length > 0 && (
        <div className="space-y-1.5">
          {pins.map((p) => p.juris_documents && (
            <div key={p.id} className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2">
              <Pin className="h-3.5 w-3.5 mt-1 text-primary shrink-0" />
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setAbrindo(p.doc_id)}>
                <StatusBadges doc={p.juris_documents} />
                <p className="text-[13px] font-bold leading-snug mt-1 line-clamp-1">{docTitulo(p.juris_documents)}</p>
                <p className="text-[11px] text-muted-foreground truncate">{p.juris_documents.court || sourceLabel(p.juris_documents.source_id)} · {p.juris_documents.organ || '—'} · {fmtData(docData(p.juris_documents))}</p>
              </button>
              <button type="button" className="text-muted-foreground hover:text-rose-500" onClick={() => remover.mutate(p.id)} title="Desafixar"><X className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      )}

      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setBuscar(q); }}>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder='Termos ou "frase exata" para buscar no acervo' className="rounded-xl h-9 text-[13px]" />
        <Button type="submit" size="sm" variant="secondary" className="rounded-xl h-9 gap-1.5">{isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}Buscar</Button>
      </form>

      {buscar && !isFetching && (resultados?.length ?? 0) === 0 && (
        <p className="text-[12px] text-muted-foreground">Nada no acervo com esses termos. Tente outras expressões ou menos palavras.</p>
      )}
      <div className="space-y-2">
        {(resultados || []).filter((d) => !fixados.has(d.doc_id)).map((d) => (
          <JurisResultCard key={d.doc_id} doc={d} compact onConferir={setConferindo} onAbrir={(x) => setAbrindo(x.doc_id)} onFixar={(x) => fixar.mutate({ docId: x.doc_id })} />
        ))}
      </div>

      <ConferirDialog doc={conferindo} open={!!conferindo} onOpenChange={(o) => !o && setConferindo(null)} />
      <JurisDocDialog docId={abrindo} open={!!abrindo} onOpenChange={(o) => !o && setAbrindo(null)} onConferir={(d) => { setAbrindo(null); setConferindo(d); }} />
    </div>
  );
}
