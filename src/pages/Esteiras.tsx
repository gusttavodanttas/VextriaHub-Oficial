import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { DeleteConfirmDialog } from '@/components/ui/DeleteConfirmDialog';
import { cn } from '@/lib/utils';
import { formatBRL } from '@/lib/currency';
import { useAuth } from '@/contexts/AuthContext';
import { useOfficeUsers } from '@/hooks/useOfficeUsers';
import {
  AlertTriangle, BarChart3, Clock, Columns3, Download, LayoutList, ListChecks, Pencil, Plus, RotateCw, Search, Settings2, Sparkles, Workflow,
} from 'lucide-react';
import {
  type Card, type Fase, type Prioridade,
  PRIORIDADE_LABEL, cardAtrasadoNaFase, diasNaFase, useEsteiraDetalhe, useEsteiras, useFeriados,
} from '@/hooks/useEsteiras';
import { CardDetalhe } from '@/components/Esteiras/CardDetalhe';
import { EsteiraConfig } from '@/components/Esteiras/EsteiraConfig';
import { VinculoPicker } from '@/components/Esteiras/VinculoPicker';

type Visao = 'kanban' | 'lista' | 'relatorio' | 'config';

const PRIORIDADE_COR: Record<Prioridade, string> = {
  baixa: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  media: 'bg-sky-500/10 text-sky-700 dark:text-sky-400',
  alta: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  urgente: 'bg-rose-500/10 text-rose-700 dark:text-rose-400',
};

const fmtData = (d: string | null) => (d ? format(new Date(`${d}T12:00:00`), 'dd/MM/yyyy') : '—');

function prazoClasse(prazo: string | null): string {
  if (!prazo) return 'text-muted-foreground';
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const p = new Date(`${prazo}T00:00:00`);
  if (p < hoje) return 'text-rose-600 font-semibold';
  if (p.getTime() - hoje.getTime() <= 2 * 86_400_000) return 'text-amber-600 font-semibold';
  return 'text-muted-foreground';
}

function NovoCardDialog({ fases, faseInicial, onCriar, onFechar }: {
  fases: Fase[]; faseInicial?: string; onCriar: (c: Partial<Card> & { titulo: string; fase_id: string }) => void; onFechar: () => void;
}) {
  const [titulo, setTitulo] = useState('');
  const [faseId, setFaseId] = useState(faseInicial ?? fases[0]?.id);
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [clienteLabel, setClienteLabel] = useState<string | null>(null);
  const [processoId, setProcessoId] = useState<string | null>(null);
  const [processoLabel, setProcessoLabel] = useState<string | null>(null);
  const [prioridade, setPrioridade] = useState<Prioridade>('media');
  const [prazo, setPrazo] = useState('');
  const [descricao, setDescricao] = useState('');

  return (
    <Dialog open onOpenChange={o => { if (!o) onFechar(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Novo card</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Cliente</Label>
            <VinculoPicker tipo="cliente" valorId={clienteId} valorLabel={clienteLabel}
              onChange={(id, label) => { setClienteId(id); setClienteLabel(label); if (label && !titulo) setTitulo(label); }} />
          </div>
          <div className="space-y-1.5">
            <Label>Título</Label>
            <Input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex.: Maria Silva — BPC idoso" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>Processo (opcional)</Label>
            <VinculoPicker tipo="processo" valorId={processoId} valorLabel={processoLabel}
              onChange={(id, label) => { setProcessoId(id); setProcessoLabel(label); }} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5">
              <Label>Fase</Label>
              <Select value={faseId} onValueChange={setFaseId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{fases.map(f => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <Select value={prioridade} onValueChange={v => setPrioridade(v as Prioridade)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{(Object.keys(PRIORIDADE_LABEL) as Prioridade[]).map(p => <SelectItem key={p} value={p}>{PRIORIDADE_LABEL[p]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Prazo</Label>
              <Input type="date" value={prazo} onChange={e => setPrazo(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea rows={3} value={descricao} onChange={e => setDescricao(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onFechar}>Cancelar</Button>
          <Button disabled={!titulo.trim() || !faseId} onClick={() => onCriar({
            titulo: titulo.trim(), fase_id: faseId!, cliente_id: clienteId, processo_id: processoId,
            prioridade, prazo: prazo || null, descricao: descricao.trim() || null,
          })}>Criar card</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CardMini({ card, fase, respNome, onAbrir, onDragStart }: {
  card: Card; fase?: Fase; respNome?: string; onAbrir: () => void; onDragStart: (e: React.DragEvent) => void;
}) {
  const atrasado = cardAtrasadoNaFase(card, fase);
  const feitos = (card.checklist_feito?.[card.fase_id] || []).length;
  const total = fase?.checklist.length ?? 0;
  return (
    <button
      type="button"
      draggable
      onDragStart={onDragStart}
      onClick={onAbrir}
      className={cn(
        'w-full text-left rounded-lg border bg-card p-3 shadow-sm hover:shadow-md hover:border-foreground/20 transition cursor-grab active:cursor-grabbing space-y-2',
        atrasado && 'border-rose-500/50',
        fase?.finalizacao && 'opacity-75',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold leading-snug break-words">{card.titulo}</span>
        <span className={cn('text-[10px] font-semibold rounded px-1.5 py-0.5 shrink-0', PRIORIDADE_COR[card.prioridade])}>{PRIORIDADE_LABEL[card.prioridade]}</span>
      </div>
      {(card.clientes || card.processos) && (
        <div className="text-xs text-muted-foreground space-y-0.5">
          {card.clientes && <div className="truncate">{card.clientes.nome}</div>}
          {card.processos?.numero_processo && <div className="font-mono text-[11px] break-all">{card.processos.numero_processo}</div>}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
        <span className={cn('flex items-center gap-1', atrasado ? 'text-rose-600 font-semibold' : 'text-muted-foreground')}>
          <Clock className="h-3 w-3" />{diasNaFase(card)}d na fase
        </span>
        {card.prazo && <span className={prazoClasse(card.prazo)}>Prazo {fmtData(card.prazo)}</span>}
        {total > 0 && <span className="flex items-center gap-1 text-muted-foreground"><ListChecks className="h-3 w-3" />{feitos}/{total}</span>}
        {card.valor != null && <span className="text-muted-foreground">{formatBRL(card.valor)}</span>}
      </div>
      {respNome && <div className="text-[11px] text-muted-foreground truncate">{respNome}</div>}
    </button>
  );
}

export default function Esteiras() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const { esteiras, isLoading, error, refetch, instalarModelos, criar, atualizar, excluir } = useEsteiras();
  const esteiraId = params.get('esteira') || esteiras[0]?.id || null;
  const cardParam = params.get('card');
  const visao = (params.get('visao') as Visao) || 'kanban';
  const det = useEsteiraDetalhe(esteiraId);
  // feriados entram no cálculo de "acima do prazo da fase"; re-render quando chegam
  useFeriados();
  const { users } = useOfficeUsers();
  const responsaveis = useMemo(
    () => users.filter(u => u.active).map(u => ({ user_id: u.user_id, nome: u.profile?.full_name || u.profile?.email || 'Usuário' })),
    [users],
  );
  const respNome = (id: string | null) => responsaveis.find(r => r.user_id === id)?.nome;

  const [busca, setBusca] = useState('');
  const [filtroResp, setFiltroResp] = useState<string>('todos');
  const [soAtrasados, setSoAtrasados] = useState(false);
  const [mostrarFinalizados, setMostrarFinalizados] = useState(false);
  const [novoCard, setNovoCard] = useState<{ fase?: string } | null>(null);
  const [novaEsteira, setNovaEsteira] = useState<{ id?: string; nome: string; descricao: string } | null>(null);
  const [excluirCardId, setExcluirCardId] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [sobreFase, setSobreFase] = useState<string | null>(null);

  const setParam = (k: string, v: string | null) => {
    const p = new URLSearchParams(params);
    if (v) p.set(k, v); else p.delete(k);
    setParams(p, { replace: true });
  };

  const esteira = esteiras.find(e => e.id === esteiraId);
  const faseMap = useMemo(() => Object.fromEntries(det.fases.map(f => [f.id, f])), [det.fases]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const qd = q.replace(/\D/g, '');
    return det.cards.filter(c => {
      if (filtroResp !== 'todos' && (filtroResp === 'nenhum' ? c.responsavel_id : c.responsavel_id !== filtroResp)) return false;
      if (soAtrasados && !cardAtrasadoNaFase(c, faseMap[c.fase_id]) && !(c.prazo && new Date(`${c.prazo}T23:59:59`) < new Date())) return false;
      if (!q) return true;
      const alvo = [c.titulo, c.descricao, c.clientes?.nome, c.clientes?.cpf_cnpj, c.processos?.titulo, c.processos?.numero_processo].filter(Boolean).join(' ').toLowerCase();
      if (alvo.includes(q)) return true;
      return qd.length >= 4 && alvo.replace(/\D/g, '').includes(qd);
    });
  }, [det.cards, busca, filtroResp, soAtrasados, faseMap]);

  const contagem = useMemo(() => {
    const m: Record<string, number> = {};
    det.cards.forEach(c => { m[c.fase_id] = (m[c.fase_id] ?? 0) + 1; });
    return m;
  }, [det.cards]);

  const cardAberto = det.cards.find(c => c.id === cardParam) ?? null;

  // card vindo da busca global pode não estar no cache ainda
  useEffect(() => { if (cardParam && !cardAberto && !det.isLoading) det.refetch(); }, [cardParam]); // eslint-disable-line react-hooks/exhaustive-deps

  const soltar = (faseId: string) => {
    const id = arrastando;
    setArrastando(null); setSobreFase(null);
    if (!id) return;
    const card = det.cards.find(c => c.id === id);
    if (!card || card.fase_id === faseId) return;
    det.atualizarCard.mutate({ id, fase_id: faseId });
  };

  const exportarCsv = () => {
    const linhas = [['Fase', 'Título', 'Cliente', 'Processo', 'Responsável', 'Prioridade', 'Prazo', 'Dias na fase', 'Valor']];
    filtrados.forEach(c => linhas.push([
      faseMap[c.fase_id]?.nome ?? '', c.titulo, c.clientes?.nome ?? '', c.processos?.numero_processo ?? '',
      respNome(c.responsavel_id) ?? '', PRIORIDADE_LABEL[c.prioridade], c.prazo ?? '', String(diasNaFase(c)), c.valor != null ? String(c.valor) : '',
    ]));
    const csv = linhas.map(l => l.map(v => `"${v.replace(/"/g, '""')}"`).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob([String.fromCharCode(0xfeff) + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = `${esteira?.nome ?? 'esteira'}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 flex items-center justify-between gap-4">
          <span>Não foi possível carregar as esteiras.</span>
          <Button variant="outline" size="sm" onClick={() => refetch()}><RotateCw className="h-4 w-4 mr-1" />Tentar de novo</Button>
        </div>
      </div>
    );
  }

  if (!isLoading && esteiras.length === 0) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <EmptyState
          icon={Workflow}
          title="Organize o escritório em esteiras"
          description="Cada esteira é um fluxo em kanban — do lead ao contrato, da ativação ao protocolo — com checklist por fase, prazo interno e automações."
        />
        <div className="flex flex-wrap justify-center gap-3 mt-4">
          <Button onClick={() => instalarModelos.mutate()} disabled={instalarModelos.isPending}>
            <Sparkles className="h-4 w-4 mr-1" />{instalarModelos.isPending ? 'Criando…' : 'Criar as 5 esteiras-modelo'}
          </Button>
          <Button variant="outline" onClick={() => setNovaEsteira({ nome: '', descricao: '' })}><Plus className="h-4 w-4 mr-1" />Esteira em branco</Button>
        </div>
        <p className="text-xs text-muted-foreground text-center mt-3">
          Modelos: Comercial → Ativação do cliente → Produção inicial → Peticionamento → Protocolo, já ligados por automações.
        </p>
        {novaEsteira && (
          <EsteiraDialog valor={novaEsteira} onFechar={() => setNovaEsteira(null)}
            onSalvar={v => criar.mutate(v, { onSuccess: id => { setNovaEsteira(null); setParam('esteira', id); } })} />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] min-h-0">
      {/* Abas das esteiras */}
      <div className="border-b px-4 pt-3 flex items-center gap-1 overflow-x-auto">
        {esteiras.map(e => (
          <button key={e.id} type="button" onClick={() => setParam('esteira', e.id)}
            className={cn('px-3 py-2 text-sm rounded-t-md border-b-2 whitespace-nowrap flex items-center gap-2',
              e.id === esteiraId ? 'border-primary font-semibold' : 'border-transparent text-muted-foreground hover:text-foreground')}>
            <span className="h-2 w-2 rounded-full" style={{ background: e.cor }} />{e.nome}
          </button>
        ))}
        <Button variant="ghost" size="sm" className="ml-1" onClick={() => setNovaEsteira({ nome: '', descricao: '' })}><Plus className="h-4 w-4 mr-1" />Esteira</Button>
      </div>

      {/* Barra de ações */}
      <div className="px-4 py-3 flex flex-wrap items-center gap-2 border-b">
        <div className="flex items-center gap-2 mr-auto min-w-0">
          <h1 className="text-lg font-semibold truncate">{esteira?.nome}</h1>
          {esteira && (
            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Editar esteira"
              onClick={() => setNovaEsteira({ id: esteira.id, nome: esteira.nome, descricao: esteira.descricao ?? '' })}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          <span className="text-sm text-muted-foreground">{det.cards.length} card(s)</span>
        </div>
        <div className="flex rounded-md border p-0.5">
          {([['kanban', 'Kanban', Columns3], ['lista', 'Lista', LayoutList], ['relatorio', 'Relatório', BarChart3], ['config', 'Configurar', Settings2]] as const).map(([v, label, Icon]) => (
            <button key={v} type="button" onClick={() => setParam('visao', v)}
              className={cn('px-3 py-1.5 text-sm rounded flex items-center gap-1.5', visao === v ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')}>
              <Icon className="h-4 w-4" />{label}
            </button>
          ))}
        </div>
        {visao !== 'config' && (
          <>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Nome, CPF, CNJ…" className="pl-8 w-48" />
            </div>
            <Select value={filtroResp} onValueChange={setFiltroResp}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os responsáveis</SelectItem>
                {user?.id && <SelectItem value={user.id}>Meus cards</SelectItem>}
                <SelectItem value="nenhum">Sem responsável</SelectItem>
                {responsaveis.filter(r => r.user_id !== user?.id).map(r => <SelectItem key={r.user_id} value={r.user_id}>{r.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant={soAtrasados ? 'default' : 'outline'} size="sm" onClick={() => setSoAtrasados(v => !v)}>
              <AlertTriangle className="h-4 w-4 mr-1" />Atrasados
            </Button>
            <Button size="sm" onClick={() => setNovoCard({})} disabled={det.fases.length === 0}><Plus className="h-4 w-4 mr-1" />Card</Button>
          </>
        )}
      </div>

      {det.error && (
        <div className="m-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 flex items-center justify-between">
          <span className="text-sm">Não foi possível carregar os dados desta esteira.</span>
          <Button variant="outline" size="sm" onClick={() => det.refetch()}><RotateCw className="h-4 w-4 mr-1" />Tentar de novo</Button>
        </div>
      )}

      {/* Kanban */}
      {visao === 'kanban' && (
        <div className="flex-1 min-h-0 overflow-x-auto">
          <div className="flex gap-3 p-4 h-full items-start">
            {det.fases.map(f => {
              const cs = filtrados.filter(c => c.fase_id === f.id);
              const oculto = f.finalizacao && !mostrarFinalizados;
              return (
                <div key={f.id}
                  onDragOver={e => { e.preventDefault(); setSobreFase(f.id); }}
                  onDragLeave={() => setSobreFase(s => (s === f.id ? null : s))}
                  onDrop={() => soltar(f.id)}
                  className={cn('w-72 shrink-0 rounded-xl bg-muted/40 flex flex-col max-h-full', sobreFase === f.id && 'ring-2 ring-primary/50')}>
                  <div className="px-3 pt-3 pb-2 border-t-4 rounded-t-xl" style={{ borderColor: f.cor }}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold break-words">{f.nome}</span>
                      <Badge variant="secondary">{cs.length}</Badge>
                    </div>
                    {f.sla_dias && <div className="text-[11px] text-muted-foreground">Prazo da fase: {f.sla_dias}d úteis</div>}
                  </div>
                  <div className="px-2 pb-2 space-y-2 overflow-y-auto">
                    {oculto ? (
                      cs.length > 0 && (
                        <button type="button" className="w-full text-xs text-muted-foreground py-2 hover:text-foreground" onClick={() => setMostrarFinalizados(true)}>
                          Ver {cs.length} card(s) finalizado(s)
                        </button>
                      )
                    ) : cs.map(c => (
                      <CardMini key={c.id} card={c} fase={f} respNome={respNome(c.responsavel_id)}
                        onAbrir={() => setParam('card', c.id)}
                        onDragStart={e => { setArrastando(c.id); e.dataTransfer.effectAllowed = 'move'; }} />
                    ))}
                    {!f.finalizacao && (
                      <button type="button" onClick={() => setNovoCard({ fase: f.id })}
                        className="w-full rounded-lg border border-dashed py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-background">
                        <Plus className="h-4 w-4 inline mr-1" />Novo card
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Lista */}
      {visao === 'lista' && (
        <div className="flex-1 min-h-0 overflow-auto p-4">
          <div className="flex justify-end mb-2">
            <Button variant="outline" size="sm" onClick={exportarCsv}><Download className="h-4 w-4 mr-1" />Exportar CSV</Button>
          </div>
          <div className="rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  {['Fase', 'Título', 'Cliente', 'Processo', 'Responsável', 'Prioridade', 'Prazo', 'Na fase', 'No fluxo'].map(h => (
                    <th key={h} className="px-3 py-2 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrados.map(c => {
                  const f = faseMap[c.fase_id];
                  const atrasado = cardAtrasadoNaFase(c, f);
                  const noFluxo = Math.floor((Date.now() - new Date(c.created_at).getTime()) / 86_400_000);
                  return (
                    <tr key={c.id} className="border-t hover:bg-muted/30 cursor-pointer" onClick={() => setParam('card', c.id)}>
                      <td className="px-3 py-2 whitespace-nowrap"><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: f?.cor }} />{f?.nome}</span></td>
                      <td className="px-3 py-2 font-medium">{c.titulo}</td>
                      <td className="px-3 py-2">{c.clientes?.nome ?? '—'}</td>
                      <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{c.processos?.numero_processo ?? '—'}</td>
                      <td className="px-3 py-2">{respNome(c.responsavel_id) ?? '—'}</td>
                      <td className="px-3 py-2"><span className={cn('text-xs rounded px-1.5 py-0.5', PRIORIDADE_COR[c.prioridade])}>{PRIORIDADE_LABEL[c.prioridade]}</span></td>
                      <td className={cn('px-3 py-2 whitespace-nowrap', prazoClasse(c.prazo))}>{fmtData(c.prazo)}</td>
                      <td className={cn('px-3 py-2 whitespace-nowrap', atrasado && 'text-rose-600 font-semibold')}>{diasNaFase(c)} dia(s)</td>
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{noFluxo} dia(s)</td>
                    </tr>
                  );
                })}
                {filtrados.length === 0 && <tr><td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">Nenhum card encontrado.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Relatório */}
      {visao === 'relatorio' && (
        <div className="flex-1 min-h-0 overflow-auto p-4 space-y-4">
          {(() => {
            const porFase = det.fases.map(f => {
              const cs = det.cards.filter(c => c.fase_id === f.id);
              const media = cs.length ? cs.reduce((s, c) => s + diasNaFase(c), 0) / cs.length : 0;
              const atrasados = cs.filter(c => cardAtrasadoNaFase(c, f)).length;
              const valor = cs.reduce((s, c) => s + (c.valor ?? 0), 0);
              return { f, n: cs.length, media, atrasados, valor };
            });
            const maxN = Math.max(1, ...porFase.map(p => p.n));
            const gargalo = [...porFase].filter(p => !p.f.finalizacao && p.n > 0).sort((a, b) => b.media - a.media)[0];
            const totalAtrasados = porFase.reduce((s, p) => s + p.atrasados, 0);
            const abertos = porFase.filter(p => !p.f.finalizacao).reduce((s, p) => s + p.n, 0);
            return (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border bg-card p-4"><div className="text-xs text-muted-foreground">Cards em andamento</div><div className="text-2xl font-semibold">{abertos}</div></div>
                  <div className="rounded-xl border bg-card p-4"><div className="text-xs text-muted-foreground">Acima do prazo da fase</div><div className={cn('text-2xl font-semibold', totalAtrasados > 0 && 'text-rose-600')}>{totalAtrasados}</div></div>
                  <div className="rounded-xl border bg-card p-4"><div className="text-xs text-muted-foreground">Maior tempo parado</div><div className="text-lg font-semibold">{gargalo ? `${gargalo.f.nome} · ${gargalo.media.toFixed(1)} dia(s)` : '—'}</div></div>
                </div>
                <div className="rounded-xl border bg-card p-4">
                  <h3 className="font-semibold mb-3">Por fase</h3>
                  <div className="space-y-2">
                    {porFase.map(p => (
                      <div key={p.f.id} className="grid grid-cols-[180px_1fr_auto] items-center gap-3 text-sm">
                        <span className="break-words">{p.f.nome}</span>
                        <div className="h-5 rounded bg-muted overflow-hidden">
                          <div className="h-full rounded" style={{ width: `${(p.n / maxN) * 100}%`, background: p.f.cor }} />
                        </div>
                        <span className="text-muted-foreground whitespace-nowrap text-xs">
                          {p.n} card(s) · média {p.media.toFixed(1)}d{p.atrasados ? ` · ${p.atrasados} atrasado(s)` : ''}{p.valor ? ` · ${formatBRL(p.valor)}` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* Configurar */}
      {visao === 'config' && (
        <div className="flex-1 min-h-0 overflow-auto p-4 space-y-4">
          <EsteiraConfig
            fases={det.fases}
            automacoes={det.automacoes}
            responsaveis={responsaveis}
            contagemPorFase={contagem}
            onSalvarFase={f => det.salvarFase.mutate(f)}
            onReordenar={ids => det.reordenarFases.mutate(ids)}
            onExcluirFase={id => det.excluirFase.mutate(id)}
            onSalvarAutomacao={a => det.salvarAutomacao.mutate(a)}
            onExcluirAutomacao={id => det.excluirAutomacao.mutate(id)}
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => instalarModelos.mutate()} disabled={instalarModelos.isPending}>
              <Sparkles className="h-4 w-4 mr-1" />Adicionar as 5 esteiras-modelo
            </Button>
            {esteira && (
              <Button variant="outline" className="text-destructive" onClick={() => {
                if (window.confirm(`Excluir a esteira “${esteira.nome}”? Ela vai para a Lixeira junto com seus cards.`)) {
                  excluir.mutate(esteira.id, { onSuccess: () => setParam('esteira', null) });
                }
              }}>Excluir esteira</Button>
            )}
          </div>
        </div>
      )}

      {novoCard && (
        <NovoCardDialog fases={det.fases} faseInicial={novoCard.fase} onFechar={() => setNovoCard(null)}
          onCriar={c => det.criarCard.mutate(c, { onSuccess: id => { setNovoCard(null); setParam('card', id); } })} />
      )}

      <CardDetalhe
        card={cardAberto}
        fases={det.fases}
        responsaveis={responsaveis}
        aberto={!!cardAberto}
        onFechar={() => setParam('card', null)}
        onSalvar={patch => det.atualizarCard.mutateAsync(patch)}
        onExcluir={id => setExcluirCardId(id)}
      />

      <DeleteConfirmDialog
        open={!!excluirCardId}
        onOpenChange={o => { if (!o) setExcluirCardId(null); }}
        onConfirm={() => {
          if (excluirCardId) det.excluirCard.mutate(excluirCardId, { onSuccess: () => setParam('card', null) });
          setExcluirCardId(null);
        }}
        title="Excluir card"
        description="O card vai para a Lixeira e pode ser restaurado."
      />

      {novaEsteira && (
        <EsteiraDialog valor={novaEsteira} onFechar={() => setNovaEsteira(null)}
          onSalvar={v => {
            if (novaEsteira.id) atualizar.mutate({ id: novaEsteira.id, ...v }, { onSuccess: () => setNovaEsteira(null) });
            else criar.mutate(v, { onSuccess: id => { setNovaEsteira(null); setParam('esteira', id); } });
          }} />
      )}
    </div>
  );
}

function EsteiraDialog({ valor, onSalvar, onFechar }: {
  valor: { id?: string; nome: string; descricao: string };
  onSalvar: (v: { nome: string; descricao: string }) => void;
  onFechar: () => void;
}) {
  const [nome, setNome] = useState(valor.nome);
  const [descricao, setDescricao] = useState(valor.descricao);
  return (
    <Dialog open onOpenChange={o => { if (!o) onFechar(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{valor.id ? 'Editar esteira' : 'Nova esteira'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Nome</Label><Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: BPC/LOAS" autoFocus /></div>
          <div className="space-y-1.5"><Label>Descrição</Label><Textarea rows={2} value={descricao} onChange={e => setDescricao(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onFechar}>Cancelar</Button>
          <Button disabled={!nome.trim()} onClick={() => onSalvar({ nome: nome.trim(), descricao: descricao.trim() })}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
