import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, Zap } from 'lucide-react';
import {
  type Acao, type Automacao, type CampoFase, type CampoTipo, type Fase, type Gatilho,
  ACAO_LABEL, CAMPO_TIPO_LABEL, GATILHO_LABEL, useTodasFases,
} from '@/hooks/useEsteiras';

const CORES = ['#3b82f6', '#0ea5e9', '#10b981', '#84cc16', '#f59e0b', '#f97316', '#c2410c', '#ef4444', '#ec4899', '#8b5cf6', '#64748b', '#0f172a'];

const novoId = (label: string) =>
  `${label.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30) || 'campo'}_${Math.random().toString(36).slice(2, 6)}`;

function FaseEditor({ fase, onSalvar, onFechar }: { fase: Partial<Fase>; onSalvar: (f: Partial<Fase>) => void; onFechar: () => void }) {
  const [f, setF] = useState<Partial<Fase>>({ campos: [], checklist: [], cor: '#64748b', finalizacao: false, ...fase });
  const [checkTxt, setCheckTxt] = useState((fase.checklist || []).join('\n'));
  const campos = f.campos || [];
  const setCampo = (i: number, patch: Partial<CampoFase>) => setF(x => ({ ...x, campos: (x.campos || []).map((c, j) => (j === i ? { ...c, ...patch } : c)) }));

  return (
    <Dialog open onOpenChange={o => { if (!o) onFechar(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{fase.id ? 'Editar fase' : 'Nova fase'}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome da fase</Label>
            <Input value={f.nome || ''} onChange={e => setF({ ...f, nome: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição / instrução</Label>
            <Textarea rows={2} value={f.descricao || ''} onChange={e => setF({ ...f, descricao: e.target.value })} placeholder="Ex.: responsável, o que precisa sair desta fase" />
          </div>
          <div className="space-y-1.5">
            <Label>Cor</Label>
            <div className="flex flex-wrap gap-2">
              {CORES.map(c => (
                <button key={c} type="button" aria-label={`Cor ${c}`} onClick={() => setF({ ...f, cor: c })}
                  className="h-7 w-7 rounded-full border-2" style={{ background: c, borderColor: f.cor === c ? 'hsl(var(--foreground))' : 'transparent' }} />
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Prazo interno da fase (dias úteis)</Label>
              <Input type="number" min={1} value={f.sla_dias ?? ''} onChange={e => setF({ ...f, sla_dias: e.target.value ? Number(e.target.value) : null })} placeholder="Sem prazo" />
              <p className="text-xs text-muted-foreground">O card fica marcado em vermelho quando passar disso.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Fase de finalização</Label>
              <div className="flex items-center gap-2 pt-2">
                <Switch checked={!!f.finalizacao} onCheckedChange={v => setF({ ...f, finalizacao: v })} />
                <span className="text-sm text-muted-foreground">Ganho, perdido, concluído…</span>
              </div>
            </div>
          </div>
          <label className="flex items-start gap-3 rounded-md border p-3">
            <Switch checked={!!f.baixa_prazo} onCheckedChange={v => setF({ ...f, baixa_prazo: v })} className="mt-0.5" />
            <span className="text-sm">
              <span className="font-medium">Dar baixa no prazo ao entrar nesta fase</span>
              <span className="block text-muted-foreground">Conclui no VextriaHub e na Controladoria o prazo que originou o card (ex.: fase “Protocolado”).</span>
            </span>
          </label>
          <div className="space-y-1.5">
            <Label>Checklist (um item por linha)</Label>
            <Textarea rows={4} value={checkTxt} onChange={e => setCheckTxt(e.target.value)} placeholder={'Conferir documentos\nEnviar proposta'} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Campos que esta fase pede</Label>
              <Button type="button" variant="outline" size="sm" onClick={() => setF({ ...f, campos: [...campos, { id: '', label: '', tipo: 'texto' }] })}>
                <Plus className="h-4 w-4 mr-1" />Campo
              </Button>
            </div>
            {campos.length === 0 && <p className="text-sm text-muted-foreground">Nenhum campo. O card mostra só o checklist nesta fase.</p>}
            {campos.map((c, i) => (
              <div key={i} className="rounded-md border p-3 space-y-2">
                <div className="grid grid-cols-[1fr_170px_auto] gap-2">
                  <Input value={c.label} onChange={e => setCampo(i, { label: e.target.value })} placeholder="Nome do campo" />
                  <Select value={c.tipo} onValueChange={v => setCampo(i, { tipo: v as CampoTipo })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{(Object.keys(CAMPO_TIPO_LABEL) as CampoTipo[]).map(t => <SelectItem key={t} value={t}>{CAMPO_TIPO_LABEL[t]}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button type="button" variant="ghost" size="icon" aria-label="Remover campo"
                    onClick={() => setF({ ...f, campos: campos.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></Button>
                </div>
                {c.tipo === 'lista' && (
                  <Input value={(c.opcoes || []).join(', ')} onChange={e => setCampo(i, { opcoes: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                    placeholder="Opções separadas por vírgula" />
                )}
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={!!c.obrigatorio} onCheckedChange={v => setCampo(i, { obrigatorio: v })} />
                  Obrigatório para avançar
                </label>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onFechar}>Cancelar</Button>
          <Button
            disabled={!f.nome?.trim()}
            onClick={() => onSalvar({
              ...f,
              nome: f.nome!.trim(),
              checklist: checkTxt.split('\n').map(s => s.trim()).filter(Boolean),
              campos: campos.filter(c => c.label.trim()).map(c => ({ ...c, label: c.label.trim(), id: c.id || novoId(c.label) })),
            })}
          >Salvar fase</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AutomacaoEditor({ a, fases, responsaveis, onSalvar, onFechar }: {
  a: Partial<Automacao>; fases: Fase[]; responsaveis: { user_id: string; nome: string }[];
  onSalvar: (a: Partial<Automacao>) => void; onFechar: () => void;
}) {
  const [x, setX] = useState<Partial<Automacao>>({ ativo: true, gatilho: 'entrou_fase', acao: 'criar_tarefa', config: {}, ...a });
  const todas = useTodasFases();
  const cfg = (x.config || {}) as Record<string, string | number>;
  const setCfg = (k: string, v: string | number | null) => setX({ ...x, config: { ...cfg, [k]: v } });
  const valido = !!x.nome?.trim() && (x.gatilho !== 'entrou_fase' || !!x.fase_id)
    && (x.acao !== 'mover_card' || !!cfg.fase_id) && (x.acao !== 'criar_card' || !!cfg.fase_id)
    && (x.acao !== 'definir_responsavel' || !!cfg.user_id) && (x.acao !== 'definir_prazo' || !!cfg.dias_uteis);

  return (
    <Dialog open onOpenChange={o => { if (!o) onFechar(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>{a.id ? 'Editar automação' : 'Nova automação'}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={x.nome || ''} onChange={e => setX({ ...x, nome: e.target.value })} placeholder="Ex.: Contrato fechado → Ativação" />
          </div>
          <div className="rounded-md border p-3 space-y-3">
            <div className="text-sm font-semibold">Sempre que…</div>
            <Select value={x.gatilho} onValueChange={v => setX({ ...x, gatilho: v as Gatilho })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{(Object.keys(GATILHO_LABEL) as Gatilho[]).map(g => <SelectItem key={g} value={g}>{GATILHO_LABEL[g]}</SelectItem>)}</SelectContent>
            </Select>
            {x.gatilho === 'entrou_fase' && (
              <Select value={x.fase_id ?? undefined} onValueChange={v => setX({ ...x, fase_id: v })}>
                <SelectTrigger><SelectValue placeholder="Qual fase" /></SelectTrigger>
                <SelectContent>{fases.map(f => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </div>
          <div className="rounded-md border p-3 space-y-3">
            <div className="text-sm font-semibold">Faça isso…</div>
            <Select value={x.acao} onValueChange={v => setX({ ...x, acao: v as Acao, config: {} })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{(Object.keys(ACAO_LABEL) as Acao[]).map(g => <SelectItem key={g} value={g}>{ACAO_LABEL[g]}</SelectItem>)}</SelectContent>
            </Select>
            {x.acao === 'criar_tarefa' && (
              <>
                <Input value={String(cfg.titulo ?? '')} onChange={e => setCfg('titulo', e.target.value)} placeholder="Título da tarefa — use {{titulo}} para o nome do card" />
                <div className="grid grid-cols-2 gap-2">
                  <Input type="number" min={0} value={String(cfg.dias_uteis ?? '')} onChange={e => setCfg('dias_uteis', e.target.value === '' ? null : Number(e.target.value))} placeholder="Vence em X dias úteis" />
                  <Select value={String(cfg.prioridade ?? 'media')} onValueChange={v => setCfg('prioridade', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="baixa">Baixa</SelectItem><SelectItem value="media">Média</SelectItem><SelectItem value="alta">Alta</SelectItem></SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">A tarefa fica com o responsável do card e ligada ao cliente/processo dele.</p>
              </>
            )}
            {x.acao === 'mover_card' && (
              <Select value={cfg.fase_id ? String(cfg.fase_id) : undefined} onValueChange={v => setCfg('fase_id', v)}>
                <SelectTrigger><SelectValue placeholder="Para qual fase" /></SelectTrigger>
                <SelectContent>{fases.map(f => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}</SelectContent>
              </Select>
            )}
            {x.acao === 'criar_card' && (
              <Select value={cfg.fase_id ? String(cfg.fase_id) : undefined} onValueChange={v => setCfg('fase_id', v)}>
                <SelectTrigger><SelectValue placeholder="Esteira e fase de destino" /></SelectTrigger>
                <SelectContent>
                  {(todas.data || []).map(f => <SelectItem key={f.id} value={f.id}>{f.esteiras?.nome} › {f.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {x.acao === 'definir_responsavel' && (
              <Select value={cfg.user_id ? String(cfg.user_id) : undefined} onValueChange={v => setCfg('user_id', v)}>
                <SelectTrigger><SelectValue placeholder="Quem" /></SelectTrigger>
                <SelectContent>{responsaveis.map(r => <SelectItem key={r.user_id} value={r.user_id}>{r.nome}</SelectItem>)}</SelectContent>
              </Select>
            )}
            {x.acao === 'definir_prazo' && (
              <Input type="number" min={1} value={String(cfg.dias_uteis ?? '')} onChange={e => setCfg('dias_uteis', e.target.value === '' ? null : Number(e.target.value))} placeholder="Prazo em X dias úteis a partir de hoje" />
            )}
          </div>
          <label className="flex items-center gap-2 text-sm"><Switch checked={!!x.ativo} onCheckedChange={v => setX({ ...x, ativo: v })} />Ativa</label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onFechar}>Cancelar</Button>
          <Button disabled={!valido} onClick={() => onSalvar({ ...x, nome: x.nome!.trim(), fase_id: x.gatilho === 'entrou_fase' ? x.fase_id : null })}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EsteiraConfig({
  fases, automacoes, responsaveis, contagemPorFase,
  onSalvarFase, onReordenar, onExcluirFase, onSalvarAutomacao, onExcluirAutomacao,
}: {
  fases: Fase[];
  automacoes: Automacao[];
  responsaveis: { user_id: string; nome: string }[];
  contagemPorFase: Record<string, number>;
  onSalvarFase: (f: Partial<Fase>) => void;
  onReordenar: (ids: string[]) => void;
  onExcluirFase: (id: string) => void;
  onSalvarAutomacao: (a: Partial<Automacao>) => void;
  onExcluirAutomacao: (id: string) => void;
}) {
  const [faseEdit, setFaseEdit] = useState<Partial<Fase> | null>(null);
  const [autEdit, setAutEdit] = useState<Partial<Automacao> | null>(null);
  const todas = useTodasFases();
  const nomeFase = (id: unknown) => {
    const f = (todas.data || []).find(x => x.id === id);
    return f ? `${f.esteiras?.nome} › ${f.nome}` : '—';
  };

  const mover = (i: number, d: -1 | 1) => {
    const ids = fases.map(f => f.id);
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    onReordenar(ids);
  };

  const resumoAcao = (a: Automacao) => {
    const c = a.config as Record<string, unknown>;
    switch (a.acao) {
      case 'criar_tarefa': return `Criar tarefa “${String(c.titulo || 'Tarefa: {{titulo}}')}”${c.dias_uteis ? ` em ${c.dias_uteis} dia(s) útil(eis)` : ''}`;
      case 'mover_card': return `Mover para ${fases.find(f => f.id === c.fase_id)?.nome ?? '—'}`;
      case 'criar_card': return `Criar card em ${nomeFase(c.fase_id)}`;
      case 'definir_responsavel': return `Responsável: ${responsaveis.find(r => r.user_id === c.user_id)?.nome ?? '—'}`;
      case 'definir_prazo': return `Prazo do card em ${c.dias_uteis} dia(s) útil(eis)`;
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <section className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Fases</h3>
            <p className="text-sm text-muted-foreground">Cada fase pode ter checklist, campos e prazo interno.</p>
          </div>
          <Button size="sm" onClick={() => setFaseEdit({})}><Plus className="h-4 w-4 mr-1" />Fase</Button>
        </div>
        {fases.map((f, i) => (
          <div key={f.id} className="flex items-center gap-3 rounded-md border px-3 py-2">
            <span className="h-3 w-3 rounded-full shrink-0" style={{ background: f.cor }} />
            <div className="min-w-0 flex-1">
              <div className="font-medium text-sm break-words">{f.nome}</div>
              <div className="text-xs text-muted-foreground">
                {contagemPorFase[f.id] ?? 0} card(s) · {f.checklist.length} item(ns) · {f.campos.length} campo(s)
                {f.sla_dias ? ` · prazo ${f.sla_dias}d úteis` : ''}{f.finalizacao ? ' · finalização' : ''}{f.baixa_prazo ? ' · dá baixa no prazo' : ''}
              </div>
            </div>
            <Button variant="ghost" size="icon" aria-label="Subir fase" onClick={() => mover(i, -1)} disabled={i === 0}><ArrowUp className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" aria-label="Descer fase" onClick={() => mover(i, 1)} disabled={i === fases.length - 1}><ArrowDown className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" aria-label="Editar fase" onClick={() => setFaseEdit(f)}><Pencil className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" aria-label="Excluir fase" disabled={(contagemPorFase[f.id] ?? 0) > 0}
              title={(contagemPorFase[f.id] ?? 0) > 0 ? 'Mova os cards antes de excluir' : 'Excluir fase'}
              onClick={() => { if (window.confirm(`Excluir a fase “${f.nome}”?`)) onExcluirFase(f.id); }}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </section>

      <section className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Automações</h3>
            <p className="text-sm text-muted-foreground">Rodam no servidor: valem para qualquer tela e integração.</p>
          </div>
          <Button size="sm" onClick={() => setAutEdit({})}><Plus className="h-4 w-4 mr-1" />Automação</Button>
        </div>
        {automacoes.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma automação nesta esteira.</p>}
        {automacoes.map(a => (
          <div key={a.id} className="rounded-md border px-3 py-2 flex items-start gap-3">
            <Zap className={a.ativo ? 'h-4 w-4 mt-0.5 text-amber-500' : 'h-4 w-4 mt-0.5 text-muted-foreground'} />
            <div className="min-w-0 flex-1">
              <div className="font-medium text-sm flex items-center gap-2">{a.nome}{!a.ativo && <Badge variant="outline">pausada</Badge>}</div>
              <div className="text-xs text-muted-foreground">
                Quando {a.gatilho === 'card_criado' ? 'um card for criado' : `entrar em “${fases.find(f => f.id === a.fase_id)?.nome ?? '—'}”`} → {resumoAcao(a)}
              </div>
            </div>
            <Switch checked={a.ativo} onCheckedChange={v => onSalvarAutomacao({ id: a.id, ativo: v })} aria-label="Ativar ou pausar" />
            <Button variant="ghost" size="icon" aria-label="Editar automação" onClick={() => setAutEdit(a)}><Pencil className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" aria-label="Excluir automação" onClick={() => { if (window.confirm(`Excluir a automação “${a.nome}”?`)) onExcluirAutomacao(a.id); }}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </section>

      {faseEdit && <FaseEditor fase={faseEdit} onFechar={() => setFaseEdit(null)} onSalvar={f => { onSalvarFase(f); setFaseEdit(null); }} />}
      {autEdit && (
        <AutomacaoEditor a={autEdit} fases={fases} responsaveis={responsaveis}
          onFechar={() => setAutEdit(null)} onSalvar={a => { onSalvarAutomacao(a); setAutEdit(null); }} />
      )}
    </div>
  );
}
