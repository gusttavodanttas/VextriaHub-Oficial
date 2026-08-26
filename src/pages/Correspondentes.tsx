import React, { useState, useMemo } from 'react';
import { useCorrespondentes, type Correspondente, type Diligencia, type DiligenciaStatus, type DiligenciaTipo } from '@/hooks/useCorrespondentes';
import { useProcessosV2 } from '@/hooks/useProcessosV2';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { DeleteConfirmDialog } from '@/components/ui/DeleteConfirmDialog';
import { cn } from '@/lib/utils';
import { formatBRL } from '@/lib/currency';
import {
  Handshake, UserPlus, Plus, MapPin, Phone, Mail, Scale, Star, Pencil, Trash2, Check,
  Briefcase, CircleDollarSign, CalendarClock, ChevronRight, Ban, Search, Users, ClipboardList, RotateCw,
} from 'lucide-react';

// ── Rótulos e estilos ──
const TIPO_LABELS: Record<DiligenciaTipo, string> = {
  audiencia: 'Audiência', protocolo: 'Protocolo', copia: 'Cópia/Carga', carga: 'Carga',
  despacho: 'Despacho', sustentacao: 'Sustentação oral', outro: 'Outro',
};
const STATUS_LABELS: Record<DiligenciaStatus, string> = {
  solicitada: 'Solicitada', aceita: 'Aceita', em_andamento: 'Em andamento', realizada: 'Realizada', cancelada: 'Cancelada',
};
const STATUS_STYLE: Record<DiligenciaStatus, string> = {
  solicitada: 'border-slate-500/30 text-slate-600 dark:text-slate-400 bg-slate-500/10',
  aceita: 'border-blue-500/30 text-blue-600 dark:text-blue-400 bg-blue-500/10',
  em_andamento: 'border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10',
  realizada: 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10',
  cancelada: 'border-rose-500/30 text-rose-600 dark:text-rose-400 bg-rose-500/10',
};
const NEXT_STATUS: Partial<Record<DiligenciaStatus, DiligenciaStatus>> = {
  solicitada: 'aceita', aceita: 'em_andamento', em_andamento: 'realizada',
};
const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

const fmtDate = (d: string | null | undefined) => {
  if (!d) return '—';
  const dt = new Date(String(d).length <= 10 ? `${d}T12:00:00` : String(d));
  return isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('pt-BR');
};
const fmtDateTime = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

// ── Estrelas (exibição + avaliação clicável) ──
const StarRating: React.FC<{ value: number | null; onRate?: (n: number) => void; size?: number }> = ({ value, onRate, size = 14 }) => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((n) => (
      <button
        key={n}
        type="button"
        disabled={!onRate}
        onClick={onRate ? () => onRate(n) : undefined}
        className={cn(onRate && 'hover:scale-110 transition-transform', !onRate && 'cursor-default')}
        title={onRate ? `${n} estrela(s)` : undefined}
      >
        <Star
          style={{ width: size, height: size }}
          className={cn((value ?? 0) >= n ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30')}
        />
      </button>
    ))}
  </div>
);

// ── Dialog: novo/editar correspondente ──
const CorrespondenteDialog: React.FC<{
  open: boolean; onOpenChange: (o: boolean) => void; editing: Correspondente | null;
  onSave: (id: string | undefined, patch: Partial<Correspondente>) => Promise<unknown>; saving: boolean;
}> = ({ open, onOpenChange, editing, onSave, saving }) => {
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const nome = (fd.get('nome') as string || '').trim();
    if (!nome) return;
    const cidadesRaw = (fd.get('cidades') as string || '').trim();
    const patch: Partial<Correspondente> = {
      nome,
      oab: (fd.get('oab') as string || '').trim() || null,
      uf: (fd.get('uf') as string) || null,
      telefone: (fd.get('telefone') as string || '').trim() || null,
      email: (fd.get('email') as string || '').trim() || null,
      cidades: cidadesRaw ? cidadesRaw.split(',').map((s) => s.trim()).filter(Boolean) : [],
      valor_padrao: fd.get('valor_padrao') ? Number(fd.get('valor_padrao')) : null,
      observacoes: (fd.get('observacoes') as string || '').trim() || null,
      ativo: fd.get('ativo') === 'on',
    };
    const ok = await onSave(editing?.id, patch).then(() => true).catch(() => false);
    if (ok) onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="max-w-lg rounded-3xl">
        <DialogTitle className="text-xl font-black flex items-center gap-2">
          <span className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Briefcase className="h-4 w-4" /></span>
          {editing ? 'Editar correspondente' : 'Novo correspondente'}
        </DialogTitle>
        {open && (
          <form onSubmit={handleSubmit} className="space-y-3 pt-1" key={editing?.id || 'novo'}>
            <Input name="nome" defaultValue={editing?.nome || ''} placeholder="Nome do correspondente" required className="h-10 rounded-xl" />
            <div className="grid grid-cols-2 gap-3">
              <Input name="oab" defaultValue={editing?.oab || ''} placeholder="OAB (ex: OAB/SP 123456)" className="h-10 rounded-xl" />
              <select name="uf" defaultValue={editing?.uf || ''} className="h-10 rounded-xl border border-border bg-background px-3 text-sm">
                <option value="">UF…</option>
                {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input name="telefone" defaultValue={editing?.telefone || ''} placeholder="Telefone/WhatsApp" className="h-10 rounded-xl" />
              <Input name="email" type="email" defaultValue={editing?.email || ''} placeholder="E-mail" className="h-10 rounded-xl" />
            </div>
            <Input name="cidades" defaultValue={(editing?.cidades || []).join(', ')} placeholder="Comarcas que atende (separe por vírgula)" className="h-10 rounded-xl" />
            <div className="grid grid-cols-2 gap-3 items-center">
              <Input name="valor_padrao" type="number" step="0.01" defaultValue={editing?.valor_padrao ?? ''} placeholder="Valor padrão (R$)" className="h-10 rounded-xl" />
              <label className="flex items-center gap-2 text-sm font-semibold px-1">
                <input type="checkbox" name="ativo" defaultChecked={editing ? editing.ativo : true} className="h-4 w-4 rounded" />
                Ativo
              </label>
            </div>
            <Textarea name="observacoes" defaultValue={editing?.observacoes || ''} placeholder="Observações (opcional)" className="rounded-xl min-h-[70px]" />
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl">Cancelar</Button>
              <Button type="submit" disabled={saving} className="rounded-xl gap-2">
                {saving ? <RotateCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Salvar
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

// ── Dialog: nova/editar diligência ──
const DiligenciaDialog: React.FC<{
  open: boolean; onOpenChange: (o: boolean) => void; editing: Diligencia | null;
  correspondentes: Correspondente[]; processos: Array<{ id: string; label: string }>;
  presetCorrespondenteId?: string | null;
  onSave: (id: string | undefined, patch: Partial<Diligencia>) => Promise<unknown>; saving: boolean;
}> = ({ open, onOpenChange, editing, correspondentes, processos, presetCorrespondenteId, onSave, saving }) => {
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const dataRaw = fd.get('data_diligencia') as string;
    const horaRaw = (fd.get('hora') as string) || '00:00';
    const patch: Partial<Diligencia> = {
      correspondente_id: (fd.get('correspondente_id') as string) || null,
      processo_id: (fd.get('processo_id') as string) || null,
      tipo: (fd.get('tipo') as DiligenciaTipo) || 'audiencia',
      descricao: (fd.get('descricao') as string || '').trim() || null,
      comarca: (fd.get('comarca') as string || '').trim() || null,
      uf: (fd.get('uf') as string) || null,
      data_diligencia: dataRaw ? new Date(`${dataRaw}T${horaRaw}`).toISOString() : null,
      valor: fd.get('valor') ? Number(fd.get('valor')) : null,
    };
    const ok = await onSave(editing?.id, patch).then(() => true).catch(() => false);
    if (ok) onOpenChange(false);
  };
  const dataDefault = editing?.data_diligencia ? String(editing.data_diligencia).slice(0, 10) : '';
  const horaDefault = editing?.data_diligencia ? new Date(editing.data_diligencia).toISOString().slice(11, 16) : '';
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="max-w-lg rounded-3xl">
        <DialogTitle className="text-xl font-black flex items-center gap-2">
          <span className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><ClipboardList className="h-4 w-4" /></span>
          {editing ? 'Editar diligência' : 'Nova diligência'}
        </DialogTitle>
        {open && (
          <form onSubmit={handleSubmit} className="space-y-3 pt-1" key={editing?.id || 'nova'}>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Correspondente</label>
              <select name="correspondente_id" defaultValue={editing?.correspondente_id || presetCorrespondenteId || ''} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm">
                <option value="">— Sem correspondente (em aberto) —</option>
                {correspondentes.filter((c) => c.ativo || c.id === editing?.correspondente_id).map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}{c.uf ? ` (${c.uf})` : ''}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Tipo</label>
                <select name="tipo" defaultValue={editing?.tipo || 'audiencia'} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm">
                  {(Object.keys(TIPO_LABELS) as DiligenciaTipo[]).map((t) => <option key={t} value={t}>{TIPO_LABELS[t]}</option>)}
                </select>
              </div>
              <Input name="valor" type="number" step="0.01" defaultValue={editing?.valor ?? ''} placeholder="Valor (R$)" className="h-10 rounded-xl self-end" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Input name="comarca" defaultValue={editing?.comarca || ''} placeholder="Comarca" className="h-10 rounded-xl col-span-2" />
              <select name="uf" defaultValue={editing?.uf || ''} className="h-10 rounded-xl border border-border bg-background px-3 text-sm">
                <option value="">UF…</option>
                {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input name="data_diligencia" type="date" defaultValue={dataDefault} className="h-10 rounded-xl" />
              <Input name="hora" type="time" defaultValue={horaDefault} className="h-10 rounded-xl" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Processo (opcional)</label>
              <select name="processo_id" defaultValue={editing?.processo_id || ''} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm">
                <option value="">— Sem vínculo —</option>
                {processos.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
            <Textarea name="descricao" defaultValue={editing?.descricao || ''} placeholder="Descrição / instruções (opcional)" className="rounded-xl min-h-[70px]" />
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl">Cancelar</Button>
              <Button type="submit" disabled={saving} className="rounded-xl gap-2">
                {saving ? <RotateCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Salvar
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

// ── Card de diligência ──
const DiligenciaCard: React.FC<{
  d: Diligencia; correspondenteNome: string | null;
  onAdvance: () => void; onCancel: () => void; onTogglePago: () => void; onRate: (n: number) => void;
  onEdit: () => void; onDelete: () => void;
}> = ({ d, correspondenteNome, onAdvance, onCancel, onTogglePago, onRate, onEdit, onDelete }) => {
  const next = NEXT_STATUS[d.status];
  return (
    <div className="p-5 rounded-2xl border border-border bg-card/60 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={cn('text-[9px] font-black uppercase', STATUS_STYLE[d.status])}>{STATUS_LABELS[d.status]}</Badge>
            <span className="text-[10px] font-black uppercase tracking-widest text-primary/70 bg-primary/5 px-2 py-0.5 rounded-lg">{TIPO_LABELS[d.tipo]}</span>
          </div>
          <p className="font-bold text-sm mt-2 truncate">{correspondenteNome || <span className="text-muted-foreground/60 italic">Em aberto (sem correspondente)</span>}</p>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
            {(d.comarca || d.uf) && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{[d.comarca, d.uf].filter(Boolean).join(' / ')}</span>}
            {d.data_diligencia && <span className="flex items-center gap-1"><CalendarClock className="h-3 w-3" />{fmtDateTime(d.data_diligencia)}</span>}
            {typeof d.valor === 'number' && <span className="flex items-center gap-1 font-semibold text-foreground/70"><CircleDollarSign className="h-3 w-3" />{formatBRL(d.valor)}</span>}
          </div>
          {d.descricao && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{d.descricao}</p>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg text-muted-foreground/50 hover:text-primary" onClick={onEdit} title="Editar"><Pencil className="h-3.5 w-3.5" /></Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg text-muted-foreground/50 hover:text-rose-500" onClick={onDelete} title="Excluir"><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap pt-1 border-t border-border/60">
        <div className="flex items-center gap-2">
          {next && (
            <Button size="sm" variant="outline" className="h-8 rounded-xl text-[11px] font-bold gap-1" onClick={onAdvance}>
              {STATUS_LABELS[next]} <ChevronRight className="h-3 w-3" />
            </Button>
          )}
          {d.status !== 'cancelada' && d.status !== 'realizada' && (
            <Button size="sm" variant="ghost" className="h-8 rounded-xl text-[11px] text-rose-500 hover:text-rose-600 gap-1" onClick={onCancel}>
              <Ban className="h-3 w-3" /> Cancelar
            </Button>
          )}
        </div>

        {d.status === 'realizada' && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">Nota</span>
              <StarRating value={d.avaliacao} onRate={onRate} />
            </div>
            <button
              onClick={onTogglePago}
              className={cn('flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border transition-colors',
                d.pago ? 'border-emerald-500/30 text-emerald-600 bg-emerald-500/10' : 'border-amber-500/30 text-amber-600 bg-amber-500/10 hover:bg-amber-500/20')}
            >
              <CircleDollarSign className="h-3 w-3" /> {d.pago ? 'Pago' : 'A pagar'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Card de correspondente ──
const CorrespondenteCard: React.FC<{
  c: Correspondente; stats: { total: number; realizadas: number; avgRating: number | null; aPagarValor: number };
  onEdit: () => void; onDelete: () => void; onNovaDiligencia: () => void; canDelete: boolean;
}> = ({ c, stats, onEdit, onDelete, onNovaDiligencia, canDelete }) => (
  <div className={cn('p-5 rounded-2xl border bg-card/60 space-y-3', c.ativo ? 'border-border' : 'border-border/50 opacity-70')}>
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-black text-base truncate">{c.nome}</p>
          {!c.ativo && <Badge variant="outline" className="text-[8px] font-bold uppercase border-slate-500/30 text-slate-500">Inativo</Badge>}
        </div>
        {(c.oab || c.uf) && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><Scale className="h-3 w-3" />{[c.oab, c.uf].filter(Boolean).join(' · ')}</p>}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg text-muted-foreground/50 hover:text-primary" onClick={onEdit} title="Editar"><Pencil className="h-3.5 w-3.5" /></Button>
        {canDelete && <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg text-muted-foreground/50 hover:text-rose-500" onClick={onDelete} title="Excluir"><Trash2 className="h-3.5 w-3.5" /></Button>}
      </div>
    </div>

    <div className="flex flex-col gap-1 text-xs text-muted-foreground">
      {c.telefone && <span className="flex items-center gap-1.5"><Phone className="h-3 w-3" />{c.telefone}</span>}
      {c.email && <span className="flex items-center gap-1.5 truncate"><Mail className="h-3 w-3" />{c.email}</span>}
      {c.cidades.length > 0 && <span className="flex items-center gap-1.5"><MapPin className="h-3 w-3" />{c.cidades.join(', ')}</span>}
    </div>

    <div className="flex items-center justify-between pt-2 border-t border-border/60">
      <div className="flex items-center gap-3 text-[11px]">
        <span className="font-bold text-foreground/70">{stats.realizadas}/{stats.total} feitas</span>
        {stats.avgRating != null ? <StarRating value={Math.round(stats.avgRating)} size={12} /> : <span className="text-muted-foreground/40">sem nota</span>}
        {stats.aPagarValor > 0 && <span className="text-amber-600 font-bold">{formatBRL(stats.aPagarValor)} a pagar</span>}
      </div>
      {c.valor_padrao != null && <span className="text-[10px] text-muted-foreground/60">padrão {formatBRL(c.valor_padrao)}</span>}
    </div>

    <Button size="sm" variant="outline" className="w-full rounded-xl h-8 text-[11px] font-bold gap-1.5" onClick={onNovaDiligencia}>
      <Plus className="h-3.5 w-3.5" /> Nova diligência
    </Button>
  </div>
);

// ── Página ──
const Correspondentes: React.FC = () => {
  const { isOfficeAdmin, isSuperAdmin } = useAuth();
  const {
    correspondentes, diligencias, statsByCorrespondente, loading,
    saveCorrespondente, deleteCorrespondente, savingCorrespondente,
    saveDiligencia, patchDiligencia, deleteDiligencia, savingDiligencia,
  } = useCorrespondentes();
  const { data: processos } = useProcessosV2();

  const [tab, setTab] = useState<'diligencias' | 'correspondentes'>('diligencias');
  const [statusFilter, setStatusFilter] = useState<DiligenciaStatus | 'todas' | 'abertas' | 'a_pagar'>('abertas');
  const [busca, setBusca] = useState('');

  const [corrDialog, setCorrDialog] = useState<{ open: boolean; editing: Correspondente | null }>({ open: false, editing: null });
  const [dilDialog, setDilDialog] = useState<{ open: boolean; editing: Diligencia | null; preset: string | null }>({ open: false, editing: null, preset: null });
  const [delCorr, setDelCorr] = useState<Correspondente | null>(null);
  const [delDil, setDelDil] = useState<Diligencia | null>(null);

  const corrById = useMemo(() => new Map(correspondentes.map((c) => [c.id, c])), [correspondentes]);
  const processoOptions = useMemo(
    () => (processos || []).map((p) => ({ id: p.id, label: `${p.numeroProcesso || 's/ número'} — ${p.titulo}`.slice(0, 80) })),
    [processos]
  );

  const filteredDiligencias = useMemo(() => {
    const q = busca.toLowerCase();
    return diligencias.filter((d) => {
      const matchStatus =
        statusFilter === 'todas' ? true :
        statusFilter === 'abertas' ? (d.status !== 'realizada' && d.status !== 'cancelada') :
        statusFilter === 'a_pagar' ? (d.status === 'realizada' && !d.pago) :
        d.status === statusFilter;
      const nome = d.correspondente_id ? (corrById.get(d.correspondente_id)?.nome || '') : '';
      const matchBusca = !q || nome.toLowerCase().includes(q) || (d.comarca || '').toLowerCase().includes(q) || (d.descricao || '').toLowerCase().includes(q);
      return matchStatus && matchBusca;
    });
  }, [diligencias, statusFilter, busca, corrById]);

  const kpis = useMemo(() => {
    const abertas = diligencias.filter((d) => d.status !== 'realizada' && d.status !== 'cancelada').length;
    const realizadas = diligencias.filter((d) => d.status === 'realizada').length;
    const aPagar = diligencias.filter((d) => d.status === 'realizada' && !d.pago);
    return { abertas, realizadas, aPagarCount: aPagar.length, aPagarValor: aPagar.reduce((s, d) => s + Number(d.valor || 0), 0) };
  }, [diligencias]);

  const filteredCorrespondentes = useMemo(() => {
    const q = busca.toLowerCase();
    return correspondentes.filter((c) => !q || c.nome.toLowerCase().includes(q) || (c.cidades || []).some((ci) => ci.toLowerCase().includes(q)) || (c.oab || '').toLowerCase().includes(q));
  }, [correspondentes, busca]);

  const canDeleteCorr = isOfficeAdmin || isSuperAdmin;

  const STATUS_CHIPS: Array<{ key: typeof statusFilter; label: string }> = [
    { key: 'abertas', label: 'Abertas' },
    { key: 'a_pagar', label: 'A pagar' },
    { key: 'realizada', label: 'Realizadas' },
    { key: 'cancelada', label: 'Canceladas' },
    { key: 'todas', label: 'Todas' },
  ];

  return (
    <div className="space-y-5 p-4 md:p-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20"><Handshake className="h-5 w-5" /></div>
            Correspondentes
          </h1>
          <p className="text-muted-foreground mt-1 text-sm ml-1">Gerencie correspondentes e as diligências que eles realizam.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCorrDialog({ open: true, editing: null })} className="rounded-xl h-9 gap-1.5 text-xs font-semibold">
            <UserPlus className="h-3.5 w-3.5 text-primary" /> Novo correspondente
          </Button>
          <Button size="sm" onClick={() => setDilDialog({ open: true, editing: null, preset: null })} className="rounded-xl h-9 gap-1.5 text-xs font-bold shadow-md shadow-primary/20">
            <Plus className="h-3.5 w-3.5" /> Nova diligência
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/40 p-1 rounded-2xl w-fit">
        {([['diligencias', 'Diligências', ClipboardList], ['correspondentes', 'Correspondentes', Users]] as const).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)}
            className={cn('flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all',
              tab === key ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground')}>
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
        <Input placeholder={tab === 'diligencias' ? 'Buscar por correspondente, comarca…' : 'Buscar correspondente por nome, OAB ou comarca…'}
          value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-10 h-10 rounded-xl" />
      </div>

      {loading ? (
        <div className="py-20 flex justify-center"><RotateCw className="h-6 w-6 animate-spin text-primary" /></div>
      ) : tab === 'diligencias' ? (
        <div className="space-y-5">
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Abertas', value: String(kpis.abertas), tone: 'text-blue-600 dark:text-blue-400' },
              { label: 'Realizadas', value: String(kpis.realizadas), tone: 'text-emerald-600 dark:text-emerald-400' },
              { label: 'A pagar', value: String(kpis.aPagarCount), tone: 'text-amber-600 dark:text-amber-400' },
              { label: 'Valor a pagar', value: formatBRL(kpis.aPagarValor), tone: 'text-amber-600 dark:text-amber-400' },
            ].map((k) => (
              <div key={k.label} className="p-4 rounded-2xl border border-border bg-card/60">
                <div className={cn('text-2xl font-black leading-none', k.tone)}>{k.value}</div>
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mt-1">{k.label}</div>
              </div>
            ))}
          </div>

          {/* Filtros de status */}
          <div className="flex gap-1.5 flex-wrap">
            {STATUS_CHIPS.map((c) => (
              <button key={c.key} onClick={() => setStatusFilter(c.key)}
                className={cn('h-8 px-3 rounded-xl border text-[11px] font-black uppercase tracking-wide transition-all',
                  statusFilter === c.key ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted/40')}>
                {c.label}
              </button>
            ))}
          </div>

          {filteredDiligencias.length === 0 ? (
            <EmptyState icon={ClipboardList} title="Nenhuma diligência" description="Crie uma diligência e designe a um correspondente." actionLabel="Nova diligência" onAction={() => setDilDialog({ open: true, editing: null, preset: null })} />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredDiligencias.map((d) => (
                <DiligenciaCard
                  key={d.id}
                  d={d}
                  correspondenteNome={d.correspondente_id ? (corrById.get(d.correspondente_id)?.nome || null) : null}
                  onAdvance={() => { const n = NEXT_STATUS[d.status]; if (n) patchDiligencia(d.id, { status: n }); }}
                  onCancel={() => patchDiligencia(d.id, { status: 'cancelada' })}
                  onTogglePago={() => patchDiligencia(d.id, { pago: !d.pago, data_pagamento: !d.pago ? new Date().toISOString().slice(0, 10) : null })}
                  onRate={(n) => patchDiligencia(d.id, { avaliacao: n })}
                  onEdit={() => setDilDialog({ open: true, editing: d, preset: null })}
                  onDelete={() => setDelDil(d)}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {filteredCorrespondentes.length === 0 ? (
            <EmptyState icon={Users} title="Nenhum correspondente" description="Cadastre o primeiro correspondente do escritório." actionLabel="Novo correspondente" onAction={() => setCorrDialog({ open: true, editing: null })} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredCorrespondentes.map((c) => (
                <CorrespondenteCard
                  key={c.id}
                  c={c}
                  stats={statsByCorrespondente.get(c.id) || { total: 0, realizadas: 0, avgRating: null, aPagarValor: 0 }}
                  canDelete={canDeleteCorr}
                  onEdit={() => setCorrDialog({ open: true, editing: c })}
                  onDelete={() => setDelCorr(c)}
                  onNovaDiligencia={() => { setTab('diligencias'); setDilDialog({ open: true, editing: null, preset: c.id }); }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Dialogs */}
      <CorrespondenteDialog open={corrDialog.open} editing={corrDialog.editing} saving={savingCorrespondente}
        onOpenChange={(o) => setCorrDialog((s) => ({ ...s, open: o }))} onSave={saveCorrespondente} />
      <DiligenciaDialog open={dilDialog.open} editing={dilDialog.editing} presetCorrespondenteId={dilDialog.preset}
        correspondentes={correspondentes} processos={processoOptions} saving={savingDiligencia}
        onOpenChange={(o) => setDilDialog((s) => ({ ...s, open: o }))} onSave={saveDiligencia} />

      <DeleteConfirmDialog open={!!delCorr} onOpenChange={(o) => { if (!o) setDelCorr(null); }}
        title="Remover correspondente" description={`Remover "${delCorr?.nome}"? As diligências ficam no histórico, sem vínculo.`}
        onConfirm={async () => { if (delCorr) await deleteCorrespondente(delCorr.id); setDelCorr(null); }} />
      <DeleteConfirmDialog open={!!delDil} onOpenChange={(o) => { if (!o) setDelDil(null); }}
        title="Excluir diligência" description="Excluir esta diligência? Esta ação não pode ser desfeita."
        onConfirm={async () => { if (delDil) await deleteDiligencia(delDil.id); setDelDil(null); }} />
    </div>
  );
};

export default Correspondentes;
