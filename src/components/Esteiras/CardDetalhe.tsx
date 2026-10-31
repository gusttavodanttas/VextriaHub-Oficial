import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getErrorMessage } from '@/lib/errors';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  Archive, ArrowRight, Check, CircleAlert, Clock, ExternalLink, History, Link2, ListChecks, MessageSquare, Phone, Trash2, User,
} from 'lucide-react';
import { VinculoPicker } from './VinculoPicker';
import {
  type Card, type CampoFase, type Fase, type Prioridade,
  PRIORIDADE_LABEL, camposPendentes, cardAtrasadoNaFase, comentarCard, diasNaFase, useEsteiraEventos,
} from '@/hooks/useEsteiras';

interface Responsavel { user_id: string; nome: string }

const fmtData = (iso: string) => format(new Date(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

function CampoInput({ campo, valor, onChange }: { campo: CampoFase; valor: unknown; onChange: (v: unknown) => void }) {
  const v = valor === undefined || valor === null ? '' : String(valor);
  switch (campo.tipo) {
    case 'texto_longo':
      return <Textarea value={v} onChange={e => onChange(e.target.value)} rows={3} />;
    case 'numero':
    case 'moeda':
      return <Input type="number" step={campo.tipo === 'moeda' ? '0.01' : '1'} value={v} onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))} placeholder={campo.tipo === 'moeda' ? 'R$' : ''} />;
    case 'data':
      return <Input type="date" value={v} onChange={e => onChange(e.target.value || null)} />;
    case 'url':
      return (
        <div className="flex gap-2">
          <Input type="url" value={v} onChange={e => onChange(e.target.value)} placeholder="https://" />
          {v && <Button type="button" variant="outline" size="icon" asChild><a href={v} target="_blank" rel="noreferrer" aria-label="Abrir link"><ExternalLink className="h-4 w-4" /></a></Button>}
        </div>
      );
    case 'sim_nao':
      return (
        <Select value={v || undefined} onValueChange={x => onChange(x)}>
          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
          <SelectContent><SelectItem value="sim">Sim</SelectItem><SelectItem value="nao">Não</SelectItem></SelectContent>
        </Select>
      );
    case 'lista':
      return (
        <Select value={v || undefined} onValueChange={x => onChange(x)}>
          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
          <SelectContent>{(campo.opcoes || []).map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
        </Select>
      );
    default:
      return <Input value={v} onChange={e => onChange(e.target.value)} />;
  }
}

export function CardDetalhe({
  card, fases, responsaveis, aberto, onFechar, onSalvar, onExcluir,
}: {
  card: Card | null;
  fases: Fase[];
  responsaveis: Responsavel[];
  aberto: boolean;
  onFechar: () => void;
  onSalvar: (patch: Partial<Card> & { id: string }) => Promise<void>;
  onExcluir: (id: string) => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [rascunho, setRascunho] = useState<Card | null>(card);
  const [clienteLabel, setClienteLabel] = useState<string | null>(null);
  const [processoLabel, setProcessoLabel] = useState<string | null>(null);
  const [comentario, setComentario] = useState('');
  const [salvando, setSalvando] = useState(false);
  const eventos = useEsteiraEventos(card?.id ?? null);

  useEffect(() => {
    setRascunho(card);
    setClienteLabel(card?.clientes?.nome ?? null);
    setProcessoLabel(card?.processos ? `${card.processos.titulo}${card.processos.numero_processo ? ` · ${card.processos.numero_processo}` : ''}` : null);
  }, [card]);

  // tarefas abertas do mesmo cliente/processo
  const tarefas = useQuery({
    queryKey: ['tarefas', 'card', card?.cliente_id, card?.processo_id],
    enabled: !!user?.office_id && !!(card?.cliente_id || card?.processo_id),
    queryFn: async () => {
      let q = supabase.from('tarefas').select('id, titulo, data_vencimento, prioridade, concluida')
        .eq('office_id', user!.office_id!).eq('deletado', false).eq('concluida', false)
        .order('data_vencimento', { ascending: true }).limit(20);
      q = card?.processo_id ? q.eq('processo_id', card.processo_id) : q.eq('cliente_id', card!.cliente_id!);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const faseAtual = useMemo(() => fases.find(f => f.id === rascunho?.fase_id), [fases, rascunho?.fase_id]);
  const idxAtual = fases.findIndex(f => f.id === rascunho?.fase_id);
  // fase de finalização (ganho, perdido, concluído) não sugere avanço; nas demais, a próxima na ordem
  const proxima = idxAtual >= 0 && !fases[idxAtual].finalizacao ? fases[idxAtual + 1] : undefined;

  if (!rascunho || !card) return null;

  const set = <K extends keyof Card>(k: K, v: Card[K]) => setRascunho(r => (r ? { ...r, [k]: v } : r));
  const setDado = (campoId: string, v: unknown) => setRascunho(r => (r ? { ...r, dados: { ...r.dados, [campoId]: v } } : r));
  const feitos = (rascunho.checklist_feito?.[rascunho.fase_id] || []) as number[];
  const toggleItem = (i: number) => {
    const novo = feitos.includes(i) ? feitos.filter(x => x !== i) : [...feitos, i];
    setRascunho(r => (r ? { ...r, checklist_feito: { ...r.checklist_feito, [r.fase_id]: novo } } : r));
  };
  const pendentes = camposPendentes(rascunho, faseAtual);
  const checklistTotal = faseAtual?.checklist.length ?? 0;
  const atrasado = cardAtrasadoNaFase(rascunho, faseAtual);
  const respNome = responsaveis.find(r => r.user_id === rascunho.responsavel_id)?.nome;

  const salvar = async (extra?: Partial<Card>) => {
    setSalvando(true);
    try {
      await onSalvar({
        id: rascunho.id,
        titulo: rascunho.titulo,
        descricao: rascunho.descricao,
        cliente_id: rascunho.cliente_id,
        processo_id: rascunho.processo_id,
        responsavel_id: rascunho.responsavel_id,
        prioridade: rascunho.prioridade,
        prazo: rascunho.prazo,
        valor: rascunho.valor,
        origem: rascunho.origem,
        dados: rascunho.dados,
        checklist_feito: rascunho.checklist_feito,
        ...extra,
      });
      return true;
    } catch {
      return false; // o hook já mostrou o toast
    } finally {
      setSalvando(false);
    }
  };

  const moverPara = async (fase: Fase) => {
    if (fase.id === rascunho.fase_id) return;
    const avancando = fase.ordem > (faseAtual?.ordem ?? -1);
    if (avancando && pendentes.length > 0) {
      toast({
        title: 'Faltam campos obrigatórios nesta fase',
        description: pendentes.map(p => p.label).join(', '),
        variant: 'destructive',
      });
      return;
    }
    if (await salvar({ fase_id: fase.id })) set('fase_id', fase.id);
  };

  const enviarComentario = async () => {
    const texto = comentario.trim();
    if (!texto || !user?.office_id) return;
    try {
      await comentarCard(user.office_id, card.id, texto);
      setComentario('');
      qc.invalidateQueries({ queryKey: ['esteira_eventos', card.id] });
    } catch (e) {
      toast({ title: 'Não foi possível comentar', description: getErrorMessage(e, ''), variant: 'destructive' });
    }
  };

  const tel = rascunho.clientes?.telefone?.replace(/\D/g, '');

  return (
    <Dialog open={aberto} onOpenChange={o => { if (!o) onFechar(); }}>
      <DialogContent className="max-w-[1200px] w-[96vw] h-[90vh] p-0 gap-0 flex flex-col overflow-hidden">
        {/* Cabeçalho */}
        <div className="border-b pl-5 pr-14 py-3 flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-xs text-muted-foreground truncate">{faseAtual?.nome ?? 'Fase'} · há {diasNaFase(rascunho)} dia(s) nesta fase</div>
            <DialogTitle asChild>
              <Input
                value={rascunho.titulo}
                onChange={e => set('titulo', e.target.value)}
                className="h-9 text-lg font-semibold border-transparent px-1 -ml-1 hover:border-input focus-visible:border-input"
                aria-label="Título do card"
              />
            </DialogTitle>
          </div>
          {atrasado && <Badge variant="destructive" className="gap-1"><Clock className="h-3 w-3" />Acima do prazo da fase</Badge>}
          {(rascunho.controladoria_prazo_id || rascunho.prazo_id) && (
            <Badge variant="outline" className="gap-1" title="Ao chegar numa fase que dá baixa (ex.: Protocolado), o prazo de origem é concluído sozinho">
              <Link2 className="h-3 w-3" />Ligado ao prazo {rascunho.controladoria_prazo_id ? 'da triagem' : 'do VextriaHub'}
            </Badge>
          )}
          {tel && (
            <Button variant="outline" size="sm" asChild>
              <a href={`https://wa.me/55${tel}`} target="_blank" rel="noreferrer"><Phone className="h-4 w-4 mr-1" />WhatsApp</a>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => salvar({ arquivado: true }).then(ok => ok && onFechar())}>
            <Archive className="h-4 w-4 mr-1" />Arquivar
          </Button>
          <Button variant="outline" size="sm" className="text-destructive" onClick={() => onExcluir(card.id)}>
            <Trash2 className="h-4 w-4 mr-1" />Excluir
          </Button>
          <Button size="sm" disabled={salvando} onClick={() => salvar().then(ok => ok && toast({ title: 'Card salvo' }))}>
            <Check className="h-4 w-4 mr-1" />{salvando ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_240px]">
          {/* Coluna 1 — dados, histórico, tarefas */}
          <div className="border-r min-h-0 overflow-y-auto p-5">
            <Tabs defaultValue="dados">
              <TabsList className="mb-4">
                <TabsTrigger value="dados">Dados</TabsTrigger>
                <TabsTrigger value="historico"><History className="h-3.5 w-3.5 mr-1" />Histórico</TabsTrigger>
                <TabsTrigger value="tarefas"><ListChecks className="h-3.5 w-3.5 mr-1" />Tarefas</TabsTrigger>
              </TabsList>

              <TabsContent value="dados" className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Cliente</Label>
                  <VinculoPicker tipo="cliente" valorId={rascunho.cliente_id} valorLabel={clienteLabel}
                    onChange={(id, label) => { set('cliente_id', id); setClienteLabel(label); }} />
                  {rascunho.clientes && rascunho.cliente_id === rascunho.clientes.id && (
                    <p className="text-xs text-muted-foreground">
                      {[rascunho.clientes.cpf_cnpj, rascunho.clientes.telefone, rascunho.clientes.email].filter(Boolean).join(' · ') || 'Sem contato cadastrado'}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Processo</Label>
                  <VinculoPicker tipo="processo" valorId={rascunho.processo_id} valorLabel={processoLabel}
                    onChange={(id, label) => { set('processo_id', id); setProcessoLabel(label); }} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Responsável</Label>
                    <Select value={rascunho.responsavel_id ?? undefined} onValueChange={v => set('responsavel_id', v)}>
                      <SelectTrigger><SelectValue placeholder="Ninguém" /></SelectTrigger>
                      <SelectContent>{responsaveis.map(r => <SelectItem key={r.user_id} value={r.user_id}>{r.nome}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Prioridade</Label>
                    <Select value={rascunho.prioridade} onValueChange={v => set('prioridade', v as Prioridade)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{(Object.keys(PRIORIDADE_LABEL) as Prioridade[]).map(p => <SelectItem key={p} value={p}>{PRIORIDADE_LABEL[p]}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Prazo</Label>
                    <Input type="date" value={rascunho.prazo ?? ''} onChange={e => set('prazo', e.target.value || null)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Valor (R$)</Label>
                    <Input type="number" step="0.01" value={rascunho.valor ?? ''} onChange={e => set('valor', e.target.value === '' ? null : Number(e.target.value))} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Origem</Label>
                  <Select value={rascunho.origem ?? undefined} onValueChange={v => set('origem', v)}>
                    <SelectTrigger><SelectValue placeholder="De onde veio" /></SelectTrigger>
                    <SelectContent>
                      {['Site', 'Indicação', 'Instagram', 'Google', 'WhatsApp', 'Telefone', 'Evento', 'Cliente antigo', 'Outro'].map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Descrição</Label>
                  <Textarea rows={4} value={rascunho.descricao ?? ''} onChange={e => set('descricao', e.target.value)} placeholder="Resumo do caso, combinados com o cliente…" />
                </div>
                {/* campos preenchidos em fases anteriores */}
                {fases.filter(f => f.id !== rascunho.fase_id && f.campos.some(c => rascunho.dados?.[c.id] !== undefined && rascunho.dados?.[c.id] !== '')).map(f => (
                  <div key={f.id} className="rounded-md border p-3 space-y-1">
                    <div className="text-xs font-semibold text-muted-foreground">{f.nome}</div>
                    {f.campos.filter(c => rascunho.dados?.[c.id] !== undefined && rascunho.dados?.[c.id] !== '').map(c => (
                      <div key={c.id} className="text-sm"><span className="text-muted-foreground">{c.label}:</span> {String(rascunho.dados[c.id])}</div>
                    ))}
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="historico" className="space-y-3">
                <div className="flex gap-2">
                  <Input value={comentario} onChange={e => setComentario(e.target.value)} placeholder="Escrever uma nota…"
                    onKeyDown={e => { if (e.key === 'Enter') enviarComentario(); }} />
                  <Button size="icon" variant="outline" onClick={enviarComentario} aria-label="Enviar nota"><MessageSquare className="h-4 w-4" /></Button>
                </div>
                {eventos.isError && <p className="text-sm text-destructive">Não foi possível carregar o histórico.</p>}
                <ol className="space-y-2">
                  {(eventos.data || []).map(ev => (
                    <li key={ev.id} className="rounded-md border px-3 py-2">
                      <div className="text-sm">{ev.descricao}</div>
                      <div className="text-xs text-muted-foreground">{fmtData(ev.created_at)}{ev.tipo === 'automacao' ? ' · automação' : ''}</div>
                    </li>
                  ))}
                </ol>
              </TabsContent>

              <TabsContent value="tarefas" className="space-y-2">
                {!(card.cliente_id || card.processo_id) && <p className="text-sm text-muted-foreground">Vincule um cliente ou processo e salve para ver as tarefas ligadas a ele.</p>}
                {(tarefas.data || []).map(t => (
                  <a key={t.id} href={`/tarefas?openId=${t.id}`} className="block rounded-md border px-3 py-2 hover:bg-muted">
                    <div className="text-sm font-medium">{t.titulo}</div>
                    <div className="text-xs text-muted-foreground">
                      {t.data_vencimento ? `Vence ${format(new Date(`${t.data_vencimento}T12:00:00`), 'dd/MM/yyyy')}` : 'Sem vencimento'}
                      {t.prioridade ? ` · ${t.prioridade}` : ''}
                    </div>
                  </a>
                ))}
                {(card.cliente_id || card.processo_id) && !tarefas.isLoading && (tarefas.data || []).length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhuma tarefa aberta para este cliente/processo.</p>
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* Coluna 2 — o que a fase atual pede */}
          <div className="border-r min-h-0 overflow-y-auto p-5 space-y-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: faseAtual?.cor }} />
                <h3 className="font-semibold">{faseAtual?.nome}</h3>
              </div>
              {faseAtual?.descricao && <p className="text-sm text-muted-foreground mt-1">{faseAtual.descricao}</p>}
              {faseAtual?.sla_dias && <p className="text-xs text-muted-foreground mt-1">Prazo interno da fase: {faseAtual.sla_dias} dia(s) útil(eis)</p>}
              {proxima?.baixa_prazo && (rascunho.controladoria_prazo_id || rascunho.prazo_id) && (
                <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">Ao avançar para “{proxima.nome}”, o prazo de origem recebe baixa automática.</p>
              )}
            </div>

            {checklistTotal > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Checklist</Label>
                  <span className="text-xs text-muted-foreground">{feitos.length}/{checklistTotal}</span>
                </div>
                {faseAtual!.checklist.map((item, i) => (
                  <label key={i} className="flex items-start gap-2 rounded-md border px-3 py-2 cursor-pointer hover:bg-muted/50">
                    <Checkbox checked={feitos.includes(i)} onCheckedChange={() => toggleItem(i)} className="mt-0.5" />
                    <span className={cn('text-sm', feitos.includes(i) && 'line-through text-muted-foreground')}>{item}</span>
                  </label>
                ))}
              </div>
            )}

            {(faseAtual?.campos.length ?? 0) > 0 && (
              <div className="space-y-3">
                <Label className="text-sm">Campos desta fase</Label>
                {faseAtual!.campos.map(c => (
                  <div key={c.id} className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">{c.label}{c.obrigatorio && <span className="text-destructive"> *</span>}</Label>
                    <CampoInput campo={c} valor={rascunho.dados?.[c.id]} onChange={v => setDado(c.id, v)} />
                  </div>
                ))}
              </div>
            )}

            {checklistTotal === 0 && (faseAtual?.campos.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground">Esta fase não tem checklist nem campos próprios. Configure em “Configurar”.</p>
            )}

            {pendentes.length > 0 && (
              <div className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                <CircleAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <span>Para avançar, preencha: {pendentes.map(p => p.label).join(', ')}.</span>
              </div>
            )}
          </div>

          {/* Coluna 3 — controle de fases */}
          <div className="min-h-0 overflow-y-auto p-4 space-y-2 bg-muted/20">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Controle de fases</div>
            {fases.map(f => {
              const atual = f.id === rascunho.fase_id;
              const passada = f.ordem < (faseAtual?.ordem ?? -1);
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => moverPara(f)}
                  className={cn(
                    'w-full text-left rounded-md px-3 py-2 text-sm border transition-colors flex items-center gap-2',
                    atual ? 'bg-foreground text-background border-foreground' : 'hover:bg-muted bg-background',
                    passada && !atual && 'text-muted-foreground',
                  )}
                  title={atual ? 'Fase atual' : `Mover para ${f.nome}`}
                >
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ background: f.cor }} />
                  <span className="flex-1 break-words">{f.nome}</span>
                  {atual && <span className="text-[10px] font-semibold uppercase">Atual</span>}
                  {passada && !atual && <Check className="h-3.5 w-3.5" />}
                </button>
              );
            })}
            {proxima && proxima.id !== rascunho.fase_id && (
              <Button className="w-full mt-2 h-auto min-h-10 py-2 whitespace-normal text-left justify-between" onClick={() => moverPara(proxima)}>
                <span>Avançar para {proxima.nome}</span><ArrowRight className="h-4 w-4 ml-1 shrink-0" />
              </Button>
            )}
            <div className="pt-3 text-xs text-muted-foreground space-y-1">
              <div className="flex items-center gap-1"><User className="h-3 w-3" />{respNome ?? 'Sem responsável'}</div>
              <div>Criado em {fmtData(card.created_at)}</div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
