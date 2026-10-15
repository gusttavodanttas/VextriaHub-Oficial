import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, CalendarClock, CheckCircle2, Circle, Gavel, ListTodo, MapPin, Timer, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AddForm, EmptySub, SectionHeader } from './shared';
import { fmtDate, fmtDateTime, fmtDuration, getPrioridadeStyle, type SubData } from './helpers';

// Abas de itens vinculados ao processo (prazos, audiências, atendimentos, tarefas,
// timesheet). Cada uma recebe o estado do formulário de adição do drawer e o
// handler que fecha o formulário quando o hook useProcessoSubData confirma o insert.

interface TabBase {
  sub: SubData;
  showAdd: boolean;
  setShowAdd: (v: boolean) => void;
  onAdd: (e: React.FormEvent<HTMLFormElement>) => void;
  /** Abre o item na sua aba principal (modo edição), fechando o drawer. */
  openInTab: (route: string, id: string) => void;
}

const cardClass = "p-4 rounded-2xl border border-border bg-muted/10 flex items-center gap-4 cursor-pointer hover:border-primary/40 hover:shadow-sm transition-all";

export function PrazosTab({ sub, showAdd, setShowAdd, onAdd, openInTab, canWrite }: TabBase & { canWrite: boolean }) {
  const { prazos, loadingSub, addLoading } = sub;
  const hoje = new Date().toLocaleDateString('en-CA');
  return (
    <div className="space-y-4">
      <SectionHeader label="prazo(s)" count={prazos.length} loading={loadingSub} onAdd={canWrite ? () => setShowAdd(true) : undefined} />
      {showAdd && (
        <AddForm loading={addLoading} onSubmit={onAdd} onCancel={() => setShowAdd(false)}>
          <Input name="titulo" placeholder="Título do prazo" required className="h-9 rounded-xl text-sm" />
          <Input name="descricao" placeholder="Descrição (opcional)" className="h-9 rounded-xl text-sm" />
          <div className="grid grid-cols-2 gap-3">
            <Input name="data_vencimento" type="date" required className="h-9 rounded-xl text-sm" />
            <select name="prioridade" className="h-9 rounded-xl text-sm border border-border bg-background px-3">
              <option value="baixa">Baixa</option>
              <option value="media" selected>Média</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente</option>
            </select>
          </div>
        </AddForm>
      )}
      {prazos.length > 0 ? prazos.map(p => {
        const dataFatal = p.data_fim_prazo || p.data_vencimento || null;
        const vencido = p.status !== 'concluido' && dataFatal && String(dataFatal).slice(0, 10) < hoje;
        return (
          <div key={p.id} onClick={() => openInTab('/prazos', p.id)} title="Abrir para editar" className={cn("p-4 rounded-2xl border flex items-center gap-4 cursor-pointer hover:border-primary/40 hover:shadow-sm transition-all", vencido ? 'border-rose-500/20 bg-rose-500/5' : 'border-border bg-muted/10')}>
            {vencido ? <AlertTriangle className="h-5 w-5 text-rose-500 shrink-0" /> : p.status === 'concluido' ? <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" /> : <CalendarClock className="h-5 w-5 text-amber-500 shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className={cn("font-bold text-sm", p.status === 'concluido' && 'line-through opacity-50')}>{p.titulo}</p>
              {p.descricao && <p className="text-xs text-muted-foreground mt-0.5">{p.descricao}</p>}
            </div>
            <div className="text-right shrink-0 space-y-1">
              <p className={cn("text-xs font-bold", vencido ? 'text-rose-600' : 'text-muted-foreground')}>{fmtDate(dataFatal)}</p>
              {p.prioridade && <Badge variant="outline" className={cn("text-[9px] font-bold uppercase", getPrioridadeStyle(p.prioridade))}>{p.prioridade}</Badge>}
            </div>
          </div>
        );
      }) : !showAdd && <EmptySub icon={CalendarClock} label="prazo" loading={loadingSub} />}
    </div>
  );
}

export function AudienciasTab({ sub, showAdd, setShowAdd, onAdd, openInTab, canWrite }: TabBase & { canWrite: boolean }) {
  const { audiencias, loadingSub, addLoading } = sub;
  return (
    <div className="space-y-4">
      <SectionHeader label="audiência(s)" count={audiencias.length} loading={loadingSub} onAdd={canWrite ? () => setShowAdd(true) : undefined} />
      {showAdd && (
        <AddForm loading={addLoading} onSubmit={onAdd} onCancel={() => setShowAdd(false)}>
          <Input name="titulo" placeholder="Título da audiência" required className="h-9 rounded-xl text-sm" />
          <div className="grid grid-cols-2 gap-3">
            <Input name="data" type="date" required className="h-9 rounded-xl text-sm" />
            <Input name="horario" type="time" required className="h-9 rounded-xl text-sm" />
          </div>
          <Input name="local" placeholder="Local (opcional)" className="h-9 rounded-xl text-sm" />
          <Input name="tipo" placeholder="Tipo (conciliação, instrução...)" className="h-9 rounded-xl text-sm" />
          <Input name="observacoes" placeholder="Observações (opcional)" className="h-9 rounded-xl text-sm" />
        </AddForm>
      )}
      {audiencias.length > 0 ? audiencias.map(a => (
        <div key={a.id} onClick={() => openInTab('/audiencias', a.id)} title="Abrir para editar" className={cardClass}>
          <div className="p-2.5 rounded-xl bg-violet-500/10"><Gavel className="h-5 w-5 text-violet-500" /></div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm">{a.titulo}</p>
            {a.local && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><MapPin className="h-3 w-3" />{a.local}</p>}
            {a.tipo && <Badge variant="outline" className="text-[9px] font-bold uppercase mt-1">{a.tipo}</Badge>}
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs font-bold text-primary">{fmtDateTime(a.data_audiencia)}</p>
            <Badge variant="outline" className="text-[9px] font-bold uppercase mt-1">{a.status}</Badge>
          </div>
        </div>
      )) : !showAdd && <EmptySub icon={Gavel} label="audiência" loading={loadingSub} />}
    </div>
  );
}

export function AtendimentosTab({ sub, showAdd, setShowAdd, onAdd, openInTab, isMine }: TabBase & { isMine: boolean }) {
  const { atendimentos, loadingSub, addLoading } = sub;
  return (
    <div className="space-y-4">
      <SectionHeader label="atendimento(s)" count={atendimentos.length} loading={loadingSub} onAdd={isMine ? () => setShowAdd(true) : undefined} />
      {showAdd && (
        <AddForm loading={addLoading} onSubmit={onAdd} onCancel={() => setShowAdd(false)}>
          <Input name="tipo" placeholder="Tipo (reunião, ligação, email...)" required className="h-9 rounded-xl text-sm" />
          <div className="grid grid-cols-2 gap-3">
            <Input name="data" type="date" required className="h-9 rounded-xl text-sm" />
            <Input name="horario" type="time" required className="h-9 rounded-xl text-sm" />
          </div>
          <Textarea name="observacoes" placeholder="Observações (opcional)" className="rounded-xl text-sm min-h-[80px]" />
        </AddForm>
      )}
      {atendimentos.length > 0 ? atendimentos.map(a => (
        <div key={a.id} onClick={() => openInTab('/atendimentos', a.id)} title="Abrir para editar" className={cardClass}>
          <div className="p-2.5 rounded-xl bg-sky-500/10"><Users className="h-5 w-5 text-sky-500" /></div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm capitalize">{a.tipo_atendimento}</p>
            {a.observacoes && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{a.observacoes}</p>}
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs font-bold text-primary">{fmtDateTime(a.data_atendimento)}</p>
            {a.duracao && <p className="text-[10px] text-muted-foreground">{a.duracao} min</p>}
          </div>
        </div>
      )) : !showAdd && <EmptySub icon={Users} label="atendimento" loading={loadingSub} />}
    </div>
  );
}

export function TarefasTab({ sub, showAdd, setShowAdd, onAdd, openInTab, canWrite }: TabBase & { canWrite: boolean }) {
  const { tarefas, loadingSub, addLoading, toggleTarefa } = sub;
  return (
    <div className="space-y-4">
      <SectionHeader label="tarefa(s)" count={tarefas.length} loading={loadingSub} onAdd={canWrite ? () => setShowAdd(true) : undefined} />
      {showAdd && (
        <AddForm loading={addLoading} onSubmit={onAdd} onCancel={() => setShowAdd(false)}>
          <Input name="titulo" placeholder="Título da tarefa" required className="h-9 rounded-xl text-sm" />
          <Input name="descricao" placeholder="Descrição (opcional)" className="h-9 rounded-xl text-sm" />
          <div className="grid grid-cols-2 gap-3">
            <Input name="data_vencimento" type="date" className="h-9 rounded-xl text-sm" />
            <select name="prioridade" className="h-9 rounded-xl text-sm border border-border bg-background px-3">
              <option value="baixa">Baixa</option>
              <option value="media" selected>Média</option>
              <option value="alta">Alta</option>
            </select>
          </div>
        </AddForm>
      )}
      {tarefas.length > 0 ? tarefas.map(t => (
        <div key={t.id} onClick={() => openInTab('/tarefas', t.id)} title="Abrir para editar" className={cardClass}>
          <button onClick={(e) => { e.stopPropagation(); if (canWrite) toggleTarefa(t); }} disabled={!canWrite} className={cn("shrink-0", !canWrite && "cursor-default")}>
            {t.concluida ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <Circle className="h-5 w-5 text-muted-foreground/40 hover:text-primary transition-colors" />}
          </button>
          <div className="flex-1 min-w-0">
            <p className={cn("font-bold text-sm", t.concluida && 'line-through opacity-50')}>{t.titulo}</p>
            {t.descricao && <p className="text-xs text-muted-foreground mt-0.5">{t.descricao}</p>}
          </div>
          <div className="text-right shrink-0 space-y-1">
            {t.data_vencimento && <p className="text-xs text-muted-foreground">{fmtDate(t.data_vencimento)}</p>}
            {t.prioridade && <Badge variant="outline" className={cn("text-[9px] font-bold uppercase", getPrioridadeStyle(t.prioridade))}>{t.prioridade}</Badge>}
          </div>
        </div>
      )) : !showAdd && <EmptySub icon={ListTodo} label="tarefa" loading={loadingSub} />}
    </div>
  );
}

export function TimesheetTab({ sub, showAdd, setShowAdd, onAdd, isMine }: Omit<TabBase, 'openInTab'> & { isMine: boolean }) {
  const { timesheets, loadingSub, addLoading } = sub;
  return (
    <div className="space-y-4">
      <SectionHeader label="registro(s)" count={timesheets.length} loading={loadingSub} onAdd={isMine ? () => setShowAdd(true) : undefined} />
      {showAdd && (
        <AddForm loading={addLoading} onSubmit={onAdd} onCancel={() => setShowAdd(false)}>
          <Input name="descricao" placeholder="Descrição da atividade" required className="h-9 rounded-xl text-sm" />
          <div className="grid grid-cols-2 gap-3">
            <Input name="duracao" type="number" placeholder="Duração (min)" required className="h-9 rounded-xl text-sm" />
            <select name="categoria" className="h-9 rounded-xl text-sm border border-border bg-background px-3">
              <option value="geral">Geral</option>
              <option value="audiencia">Audiência</option>
              <option value="peticao">Petição</option>
              <option value="reuniao">Reunião</option>
              <option value="pesquisa">Pesquisa</option>
              <option value="administrativo">Administrativo</option>
            </select>
          </div>
        </AddForm>
      )}
      {timesheets.length > 0 ? (
        <>
          <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-primary">Total</span>
            <span className="font-black text-lg text-primary">{fmtDuration(timesheets.reduce((s, t) => s + (t.duracao_minutos || 0), 0))}</span>
          </div>
          {timesheets.map(t => (
            <div key={t.id} className="p-4 rounded-2xl border border-border bg-muted/10 flex items-center gap-4">
              <div className="p-2.5 rounded-xl bg-orange-500/10"><Timer className="h-5 w-5 text-orange-500" /></div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm">{t.tarefa_descricao}</p>
                <p className="text-[10px] text-muted-foreground uppercase mt-0.5">{t.categoria}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-black text-sm text-orange-600 dark:text-orange-400">{fmtDuration(t.duracao_minutos)}</p>
                <p className="text-[10px] text-muted-foreground">{fmtDate(t.data_inicio)}</p>
              </div>
            </div>
          ))}
        </>
      ) : !showAdd && <EmptySub icon={Timer} label="registro" loading={loadingSub} />}
    </div>
  );
}
