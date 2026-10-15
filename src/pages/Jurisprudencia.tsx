import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Scale, Search, Loader2, History, Star, Trash2, ShieldCheck, Sparkles, Bell } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useJurisSearch, useJurisSearches, type JurisFilters } from '@/hooks/useJurisprudencia';
import { useAiAdvisor, AdvisorError } from '@/hooks/useAiAdvisor';
import { SOURCE_LABEL, type JurisDoc } from '@/lib/juris';
import { JurisResultCard } from '@/components/Jurisprudencia/JurisResultCard';
import { ConferirDialog } from '@/components/Jurisprudencia/ConferirDialog';
import { JurisDocDialog } from '@/components/Jurisprudencia/JurisDocDialog';

const PAGE = 20;

/**
 * Jurisprudência e normas — buscador individual do advogado.
 * O acervo é global (jurisprudência é pública); pesquisas, conferências e fixações são PRIVADAS
 * de cada usuário. Resultado NÃO CONFERIDO serve para descoberta, não para citação.
 */
export default function Jurisprudencia() {
  const [params, setParams] = useSearchParams();
  const { toast } = useToast();
  const [q, setQ] = useState(params.get('q') || '');
  const [f, setF] = useState<JurisFilters>({ tipo: (params.get('tipo') as JurisFilters['tipo']) || 'precedente' });
  const [exec, setExec] = useState<{ q: string; f: JurisFilters } | null>(q ? { q, f } : null);
  const [page, setPage] = useState(0);
  const [conferindo, setConferindo] = useState<JurisDoc | null>(null);
  const [abrindo, setAbrindo] = useState<string | null>(params.get('doc'));
  const [iaOpen, setIaOpen] = useState(false);

  const filtros = useMemo(() => ({ ...(exec?.f || f), limit: PAGE, offset: page * PAGE }), [exec, f, page]);
  const { data: resultados, isFetching, error } = useJurisSearch(exec?.q ?? '', filtros, !!exec);
  const { itens: historico, registrar, salvar, remover } = useJurisSearches();

  useEffect(() => { if (error) toast({ title: 'Erro na busca', description: String((error as Error).message), variant: 'destructive' }); }, [error, toast]);

  const buscar = (nq = q, nf = f) => {
    setPage(0); setExec({ q: nq, f: nf });
    registrar.mutate({ query: nq, filtros: nf });
    const next = new URLSearchParams(params); if (nq) next.set('q', nq); else next.delete('q'); next.delete('doc'); setParams(next, { replace: true });
  };

  const salvas = historico.filter((h) => h.salva);
  const recentes = historico.filter((h) => !h.salva).slice(0, 8);

  return (
    <div className="flex-1 p-4 md:p-8 space-y-6 overflow-x-hidden entry-animate">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-2xl bg-primary/10 border border-primary/20 shadow-premium"><Scale className="h-6 w-6 md:h-7 md:w-7 text-primary" /></div>
        <div>
          <h1 className="text-2xl md:text-4xl font-black tracking-tight">Jurisprudência</h1>
          <p className="text-xs md:text-sm text-muted-foreground font-medium">Base auditável: STJ, TJDFT e normas (ANS, CFO, Diário Oficial). Só pode ser citado o que você conferiu na fonte oficial.</p>
        </div>
        <Button variant="outline" className="ml-auto rounded-xl gap-2 hidden md:inline-flex" onClick={() => setIaOpen(true)}><Sparkles className="h-4 w-4" />Fundamentar com conferidos</Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4 min-w-0">
          <Card className="glass-card rounded-[2rem] border-black/5 dark:border-border shadow-premium">
            <CardContent className="p-5 space-y-3">
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); buscar(); }}>
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder='Ex.: "negativa de cobertura" dano moral · aspas = frase exata · OR · -excluir' className="rounded-xl h-11" />
                <Button type="submit" className="rounded-xl h-11 gap-2" disabled={isFetching}>{isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}Pesquisar</Button>
              </form>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Tipo</Label>
                  <Select value={f.tipo || 'todos'} onValueChange={(v) => setF({ ...f, tipo: v === 'todos' ? undefined : v })}>
                    <SelectTrigger className="rounded-xl h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="precedente">Precedentes (acórdãos)</SelectItem>
                      <SelectItem value="norma">Normas (ANS, CFO, DOU)</SelectItem>
                      <SelectItem value="todos">Tudo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Fonte</Label>
                  <Select value={f.source || 'todas'} onValueChange={(v) => setF({ ...f, source: v === 'todas' ? undefined : v })}>
                    <SelectTrigger className="rounded-xl h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas</SelectItem>
                      {Object.entries(SOURCE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Órgão contém</Label>
                  <Input value={f.organ || ''} onChange={(e) => setF({ ...f, organ: e.target.value || undefined })} placeholder="3ª Turma" className="rounded-xl h-9 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">De</Label>
                  <Input type="date" value={f.from || ''} onChange={(e) => setF({ ...f, from: e.target.value || undefined })} className="rounded-xl h-9 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Até</Label>
                  <Input type="date" value={f.to || ''} onChange={(e) => setF({ ...f, to: e.target.value || undefined })} className="rounded-xl h-9 text-xs" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="onlyv" checked={!!f.onlyVerified} onCheckedChange={(v) => { const nf = { ...f, onlyVerified: v }; setF(nf); if (exec) buscar(exec.q, nf); }} />
                <Label htmlFor="onlyv" className="text-xs font-bold flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />Só o que eu já conferi</Label>
              </div>
            </CardContent>
          </Card>

          {exec && (
            <div className="space-y-3">
              <p className="text-xs font-bold text-muted-foreground">
                {isFetching ? 'Buscando…' : `${resultados?.length ?? 0} resultado(s)${(resultados?.length ?? 0) === PAGE ? ' nesta página' : ''}`}
                {' · '}<span className="text-amber-600">resultado não conferido serve para descoberta, não para citação</span>
              </p>
              {(resultados || []).map((d) => (
                <JurisResultCard key={d.doc_id} doc={d} onConferir={setConferindo} onAbrir={(x) => setAbrindo(x.doc_id)} />
              ))}
              {!isFetching && (resultados?.length ?? 0) === 0 && (
                <Card className="rounded-2xl"><CardContent className="p-6 text-sm text-muted-foreground">Nada encontrado. Dicas: menos palavras, aspas para frase exata, ou troque o tipo para "Tudo".</CardContent></Card>
              )}
              {(page > 0 || (resultados?.length ?? 0) === PAGE) && (
                <div className="flex justify-between">
                  <Button variant="outline" className="rounded-xl" disabled={page === 0 || isFetching} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
                  <Button variant="outline" className="rounded-xl" disabled={(resultados?.length ?? 0) < PAGE || isFetching} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
                </div>
              )}
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <Card className="rounded-[2rem] border-black/5 dark:border-border">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-black flex items-center gap-2"><Star className="h-4 w-4 text-amber-500" />Minhas pesquisas salvas</CardTitle></CardHeader>
            <CardContent className="space-y-1.5">
              {salvas.length === 0 && <p className="text-xs text-muted-foreground">Salve uma pesquisa pelo histórico abaixo.</p>}
              {salvas.map((h) => (
                <div key={h.id} className="flex items-center gap-1.5">
                  <button type="button" className="flex-1 text-left text-xs font-bold truncate hover:text-primary" onClick={() => { setQ(h.query); setF(h.filtros); buscar(h.query, h.filtros); }}>{h.nome || h.query}</button>
                  <button type="button" className="text-muted-foreground hover:text-rose-500" onClick={() => remover.mutate(h.id)}><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="rounded-[2rem] border-black/5 dark:border-border">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-black flex items-center gap-2"><History className="h-4 w-4" />Recentes (só você vê)</CardTitle></CardHeader>
            <CardContent className="space-y-1.5">
              {recentes.length === 0 && <p className="text-xs text-muted-foreground">Suas pesquisas aparecem aqui.</p>}
              {recentes.map((h) => (
                <div key={h.id} className="flex items-center gap-1.5">
                  <button type="button" className="flex-1 text-left text-xs truncate hover:text-primary" onClick={() => { setQ(h.query); setF(h.filtros); buscar(h.query, h.filtros); }}>{h.query}</button>
                  <button type="button" className="text-muted-foreground hover:text-amber-500" title="Salvar" onClick={() => { const nome = window.prompt('Nome da pesquisa salva', h.query); if (nome !== null) salvar.mutate({ id: h.id, nome, salva: true }); }}><Star className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="rounded-[2rem] border-black/5 dark:border-border">
            <CardContent className="p-4 text-xs text-muted-foreground space-y-2">
              <p className="flex items-center gap-1.5 font-bold text-foreground"><Bell className="h-3.5 w-3.5" />Alertas de normas</p>
              <p>Receba notificação quando sair RN da ANS, resolução do CFO ou ato de CRO. Configure em Configurações → Alertas de normas.</p>
            </CardContent>
          </Card>
          <Button variant="outline" className="w-full rounded-xl gap-2 md:hidden" onClick={() => setIaOpen(true)}><Sparkles className="h-4 w-4" />Fundamentar com conferidos</Button>
        </aside>
      </div>

      <ConferirDialog doc={conferindo} open={!!conferindo} onOpenChange={(o) => !o && setConferindo(null)} />
      <JurisDocDialog docId={abrindo} open={!!abrindo} onOpenChange={(o) => { if (!o) { setAbrindo(null); const next = new URLSearchParams(params); next.delete('doc'); setParams(next, { replace: true }); } }} onConferir={(d) => { setAbrindo(null); setConferindo(d); }} />
      <FundamentacaoDialog open={iaOpen} onOpenChange={setIaOpen} temaInicial={exec?.q || q} />
    </div>
  );
}

/** Conselheiro IA em modo "só conferidos": o servidor só recebe precedentes que ESTE usuário conferiu. */
function FundamentacaoDialog({ open, onOpenChange, temaInicial }: { open: boolean; onOpenChange: (o: boolean) => void; temaInicial: string }) {
  const { fundamentacao } = useAiAdvisor();
  const { toast } = useToast();
  const [tema, setTema] = useState(temaInicial);
  const [contexto, setContexto] = useState('');
  const [saida, setSaida] = useState<{ fundamentacao?: string; precedentes_usados?: Array<{ doc_id?: string; citacao?: string }>; vazio?: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => { if (open) { setTema(temaInicial); setSaida(null); } }, [open, temaInicial]);

  const gerar = async () => {
    setLoading(true); setSaida(null);
    try { const r = await fundamentacao(tema, contexto); setSaida(r.data || { vazio: true }); }
    catch (e) { toast({ title: 'Conselheiro IA', description: e instanceof AdvisorError ? e.message : 'Falha ao gerar.', variant: 'destructive' }); }
    finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-black flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />Fundamentação só com precedentes conferidos</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">A IA recebe apenas os registros que <b>você</b> marcou como CONFERIDO e é proibida de citar qualquer outro. Se não houver conferidos sobre o tema, ela diz isso.</p>
        <div className="space-y-1.5"><Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Tema</Label><Input value={tema} onChange={(e) => setTema(e.target.value)} className="rounded-xl" placeholder="Ex.: negativa de cobertura de internação em carência" /></div>
        <div className="space-y-1.5"><Label className="text-xs font-black uppercase tracking-wider text-muted-foreground">Contexto do caso (opcional)</Label><Textarea value={contexto} onChange={(e) => setContexto(e.target.value)} rows={3} className="rounded-xl resize-none" placeholder="Fatos essenciais, pedido, tese que quer sustentar" /></div>
        <Button className="rounded-xl gap-2" disabled={loading || tema.trim().length < 3} onClick={gerar}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}Gerar minuta</Button>
        {saida?.vazio && <p className="text-sm text-amber-600 font-bold">Você ainda não conferiu nenhum precedente sobre esse tema. Pesquise, abra a fonte oficial e marque como conferido; depois volte aqui.</p>}
        {saida?.fundamentacao && (
          <div className="space-y-3">
            <div className={cn('rounded-2xl border border-border bg-muted/20 p-4 text-[14px] leading-relaxed whitespace-pre-wrap')}>{saida.fundamentacao}</div>
            {(saida.precedentes_usados?.length ?? 0) > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-black tracking-[0.2em] text-muted-foreground/50">Precedentes usados (todos conferidos por você)</p>
                <ul className="list-disc pl-5 text-[12px] space-y-1">{saida.precedentes_usados!.map((p, i) => <li key={i}>{p.citacao || p.doc_id}</li>)}</ul>
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">MINUTA - sujeita a revisão de advogado inscrito na OAB.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
