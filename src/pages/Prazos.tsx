import { useState, useMemo, useDeferredValue } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMultiSelect } from "@/hooks/useMultiSelect";
import { useToast } from "@/hooks/use-toast";
import { NovoPrazoStandaloneDialog, PrazoFormData } from "@/components/Processos/NovoPrazoStandaloneDialog";
import { useOpenItemFromSearch } from "@/hooks/useOpenItemFromSearch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOfficeUsers } from "@/hooks/useOfficeUsers";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, differenceInCalendarDays, startOfDay, startOfMonth, startOfWeek, addDays, addMonths, isSameDay, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { deepCleanHTML } from '@/lib/cleanHtml';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, AlertTriangle, Clock, CalendarClock, CheckCircle2,
  ChevronRight, Flame, Calendar, Inbox, MoreHorizontal, Pencil, Trash2,
  CheckCheck, Timer, Newspaper, Shield, AlertOctagon, Eye, EyeOff, RotateCcw,
  User, X, List, ChevronLeft, CalendarDays,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Prazo {
  id: string;
  titulo: string;
  descricao?: string | null;
  data_vencimento?: string | null;
  data_publicacao?: string | null;
  data_prazo_interno?: string | null;
  data_fim_prazo?: string | null;
  prioridade: 'alta' | 'media' | 'baixa';
  status: string;
  processo_id?: string | null;
  user_id: string;
  office_id?: string | null;
  responsavel_id?: string | null;
  titular?: string | null;
  concluido_em?: string | null;
  concluido_por?: string | null;
  // Campos gravados pelo robô (OAB/DJEN)
  publicacao_id?: string | null;
  data_disponibilizacao?: string | null;
  data_intimacao?: string | null;
  base_legal?: string | null;
  tipo_prazo?: string | null;
  eh_juizado?: boolean | null;
}

// Teor/título vindos da publicação vinculada (prazos do robô nascem sem eles)
type PubInfo = { titulo: string | null; conteudo: string | null };

// Título de exibição (prazos do robô podem vir sem título)
function tituloPrazo(p: Prazo, pubs?: Record<string, PubInfo>): string {
  const pub = p.publicacao_id ? pubs?.[p.publicacao_id] : undefined;
  return (p.titulo && p.titulo.trim()) || (pub?.titulo || '').trim() || p.tipo_prazo || 'Prazo processual';
}

// Teor do prazo: descrição própria ou o conteúdo da publicação que o originou
function teorPrazo(p: Prazo, pubs?: Record<string, PubInfo>): string {
  if (p.descricao && p.descricao.trim()) return p.descricao.trim();
  const pub = p.publicacao_id ? pubs?.[p.publicacao_id] : undefined;
  return pub?.conteudo ? deepCleanHTML(pub.conteudo) : '';
}

// Prazo fatal: data_fim_prazo (novo padrão) ou data_vencimento (legado)
function getDataPrazo(prazo: Prazo): string | null {
  return prazo.data_fim_prazo || prazo.data_vencimento || null;
}

// Datas só-data (YYYY-MM-DD) devem ser interpretadas no fuso local (meio-dia),
// senão viram o dia anterior em UTC-3. Timestamps completos passam direto.
function toLocalDate(s: string): Date {
  return new Date(s.length <= 10 ? `${s}T12:00:00` : s);
}

type Urgency = 'vencido' | 'hoje' | 'critico' | 'normal' | 'concluido';

const PRIORIDADE_RANK: Record<string, number> = { alta: 0, media: 1, baixa: 2 };

function getUrgency(prazo: Prazo): Urgency {
  if (prazo.status === 'concluido') return 'concluido';
  const data = getDataPrazo(prazo);
  if (!data) return 'normal';
  const days = differenceInCalendarDays(toLocalDate(data), startOfDay(new Date()));
  if (days < 0) return 'vencido';
  if (days === 0) return 'hoje';
  if (days <= 3) return 'critico';
  return 'normal';
}

const URGENCY_CONFIG: Record<Urgency, {
  label: string; color: string; border: string; badge: string; icon: React.ElementType; dot: string;
}> = {
  vencido:  { label: 'Vencido',    color: 'text-red-600',     border: 'border-l-red-500',     badge: 'bg-red-500/10 text-red-600 border-red-500/20',       icon: AlertTriangle, dot: 'bg-red-500' },
  hoje:     { label: 'Hoje',       color: 'text-amber-600',   border: 'border-l-amber-500',   badge: 'bg-amber-500/10 text-amber-600 border-amber-500/20',  icon: Flame,         dot: 'bg-amber-500' },
  critico:  { label: 'Crítico',    color: 'text-orange-600',  border: 'border-l-orange-400',  badge: 'bg-orange-500/10 text-orange-600 border-orange-500/20', icon: Timer,       dot: 'bg-orange-400' },
  normal:   { label: 'No prazo',   color: 'text-sky-600',     border: 'border-l-sky-400',     badge: 'bg-sky-500/10 text-sky-600 border-sky-500/20',        icon: CalendarClock, dot: 'bg-sky-400' },
  concluido:{ label: 'Concluído',  color: 'text-emerald-600', border: 'border-l-emerald-400', badge: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20', icon: CheckCircle2, dot: 'bg-emerald-400' },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  alta:  { label: 'Alta',  color: 'bg-red-500/10 text-red-600 border-red-500/20' },
  media: { label: 'Média', color: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  baixa: { label: 'Baixa', color: 'bg-slate-500/10 text-slate-500 border-slate-500/20' },
};

function getDaysLabel(prazo: Prazo): string {
  if (prazo.status === 'concluido') return 'Concluído';
  const data = getDataPrazo(prazo);
  if (!data) return '—';
  const days = differenceInCalendarDays(toLocalDate(data), startOfDay(new Date()));
  if (days < 0) return `Vencido há ${Math.abs(days)}d`;
  if (days === 0) return 'Vence hoje';
  if (days === 1) return 'Amanhã';
  return `${days} dias`;
}

function sortPrazos(items: Prazo[], dateFirst = false): Prazo[] {
  const dateCmp = (a: Prazo, b: Prazo) => {
    const dateA = getDataPrazo(a);
    const dateB = getDataPrazo(b);
    if (!dateA && !dateB) return 0;
    if (!dateA) return 1;
    if (!dateB) return -1;
    return dateA.localeCompare(dateB);
  };
  return [...items].sort((a, b) => {
    // Vencidos: mais atrasado (data mais antiga) primeiro
    if (dateFirst) { const d = dateCmp(a, b); if (d !== 0) return d; }
    const prioA = PRIORIDADE_RANK[a.prioridade] ?? 1;
    const prioB = PRIORIDADE_RANK[b.prioridade] ?? 1;
    if (prioA !== prioB) return prioA - prioB;
    return dateCmp(a, b);
  });
}

const SECTION_ORDER: Urgency[] = ['vencido', 'hoje', 'critico', 'normal', 'concluido'];
const SECTION_LABELS: Record<Urgency, string> = {
  vencido:   'Vencidos',
  hoje:      'Vencem hoje',
  critico:   'Próximos 3 dias',
  normal:    'Futuros',
  concluido: 'Concluídos',
};

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function MonthView({ items, refDate, onPrev, onNext, onHoje, onSelect }: {
  items: Prazo[]; refDate: Date;
  onPrev: () => void; onNext: () => void; onHoje: () => void;
  onSelect: (p: Prazo) => void;
}) {
  const inicio = startOfWeek(startOfMonth(refDate), { weekStartsOn: 0 });
  const dias = Array.from({ length: 42 }, (_, i) => addDays(inicio, i));
  const hoje = new Date();
  const porDia = (d: Date) => items.filter(p => { const dt = getDataPrazo(p); return dt && isSameDay(toLocalDate(dt), d); });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Button size="icon" variant="outline" className="h-9 w-9 rounded-xl" onClick={onPrev} title="Mês anterior"><ChevronLeft className="h-4 w-4" /></Button>
          <Button size="icon" variant="outline" className="h-9 w-9 rounded-xl" onClick={onNext} title="Próximo mês"><ChevronRight className="h-4 w-4" /></Button>
          <Button variant="outline" className="h-9 rounded-xl px-3 text-[10px] font-black uppercase tracking-widest" onClick={onHoje}>Hoje</Button>
        </div>
        <p className="text-sm font-black tracking-tight capitalize">{format(refDate, 'MMMM yyyy', { locale: ptBR })}</p>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map(w => (
          <div key={w} className="text-center text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 py-1">{w}</div>
        ))}
        {dias.map(d => {
          const list = porDia(d);
          const isHoje = isSameDay(d, hoje);
          const isMes = isSameMonth(d, refDate);
          return (
            <div key={d.toISOString()}
              className={cn('rounded-lg border p-1 min-h-[64px] sm:min-h-[92px] flex flex-col gap-0.5 overflow-hidden',
                isHoje ? 'border-primary/40 bg-primary/5' : 'border-border/50', !isMes && 'opacity-40')}>
              <span className={cn('text-[10px] font-bold px-0.5', isHoje && 'text-primary')}>{format(d, 'd')}</span>
              <div className="flex flex-col gap-0.5 overflow-hidden">
                {list.slice(0, 3).map(p => {
                  const c = URGENCY_CONFIG[getUrgency(p)];
                  return (
                    <button key={p.id} onClick={() => onSelect(p)} title={tituloPrazo(p)}
                      className={cn('text-left rounded px-1 py-0.5 text-[9px] font-bold truncate border', c.badge)}>
                      {tituloPrazo(p)}
                    </button>
                  );
                })}
                {list.length > 3 && <span className="text-[9px] text-muted-foreground/50 px-1">+{list.length - 3}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Prazos() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { users: officeUsers } = useOfficeUsers();
  const membroMap = useMemo(() => Object.fromEntries((officeUsers || []).map((u: any) => [u.user_id, u.profile?.full_name || u.profile?.email || "—"])), [officeUsers]);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const dSearch = useDeferredValue(search);
  const [filterPriority, setFilterPriority] = useState<'all' | 'alta' | 'media' | 'baixa'>('all');
  const [filterUrgency, setFilterUrgency] = useState<Urgency | 'all'>('all');
  const [filterResp, setFilterResp] = useState('all');
  const [filterCliente, setFilterCliente] = useState('all');
  const [filterTitular, setFilterTitular] = useState('all');
  const [showConcluidos, setShowConcluidos] = useState(false);
  const [view, setView] = useState<'lista' | 'calendario'>('lista');
  const [mesRef, setMesRef] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Prazo | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Prazo | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const { data: prazos = [], isLoading } = useQuery<Prazo[]>({
    queryKey: ['prazos', user?.office_id, user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const query = supabase
        .from('prazos')
        .select('*')
        .order('data_fim_prazo', { ascending: true, nullsFirst: false });
      if (user.office_id) {
        query.eq('office_id', user.office_id);
      } else {
        query.eq('responsavel_id', user.id);
      }
      const { data, error } = await query;
      if (error) throw error;
      // Filtra soft-deletados em JS (resiliente caso a coluna ainda não exista)
      return (data || []).filter((p: any) => !p.deletado) as Prazo[];
    },
    enabled: !!user?.id,
    refetchInterval: 60_000,
  });

  // Teor dos prazos capturados pelo robô: vem da publicação que os originou
  const pubIds = useMemo(
    () => Array.from(new Set(prazos.map(p => p.publicacao_id).filter(Boolean))) as string[],
    [prazos]
  );
  const { data: pubInfo = {} } = useQuery<Record<string, PubInfo>>({
    queryKey: ['prazos-publicacoes', pubIds],
    enabled: pubIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from('publicacoes')
        .select('id, titulo, conteudo')
        .in('id', pubIds);
      const map: Record<string, PubInfo> = {};
      (data || []).forEach((p: any) => { map[p.id] = { titulo: p.titulo ?? null, conteudo: p.conteudo ?? null }; });
      return map;
    },
  });

  // Teor já limpo por prazo (evita reprocessar HTML a cada tecla da busca)
  const teorMap = useMemo(() => {
    const m: Record<string, string> = {};
    prazos.forEach(p => { m[p.id] = teorPrazo(p, pubInfo); });
    return m;
  }, [prazos, pubInfo]);
  const [teorAberto, setTeorAberto] = useState<string | null>(null);

  // Mapa processo → cliente (para filtrar/exibir por cliente)
  const { data: processoInfo = {} } = useQuery<Record<string, { clienteId: string | null; clienteNome: string | null }>>({
    queryKey: ['prazos-processos', user?.office_id],
    enabled: !!user?.office_id,
    queryFn: async () => {
      const { data } = await supabase.from('processos')
        .select('id, cliente_id, clientes(nome)')
        .eq('office_id', user!.office_id).eq('deletado', false);
      const m: Record<string, { clienteId: string | null; clienteNome: string | null }> = {};
      (data || []).forEach((p: any) => { m[p.id] = { clienteId: p.cliente_id ?? null, clienteNome: p.clientes?.nome ?? null }; });
      return m;
    },
  });

  const clienteDoPrazo = (p: Prazo) => p.processo_id ? (processoInfo[p.processo_id]?.clienteId ?? null) : null;
  const clienteNomeDoPrazo = (p: Prazo) => p.processo_id ? (processoInfo[p.processo_id]?.clienteNome ?? null) : null;

  // Busca global: rola até o prazo e abre o detalhe/edição
  useOpenItemFromSearch('/prazos', !isLoading && prazos.length > 0, (openId) => {
    const prazo = prazos.find(p => String(p.id) === openId);
    if (prazo) { setEditTarget(prazo); return true; }
    return false;
  });

  const concludeMutation = useMutation({
    mutationFn: async (id: string) => {
      // tenta gravar auditoria (data/autor); se as colunas não existirem, grava só o status
      let { error } = await supabase.from('prazos')
        .update({ status: 'concluido', concluido_em: new Date().toISOString(), concluido_por: user?.id } as any)
        .eq('id', id);
      if (error) ({ error } = await supabase.from('prazos').update({ status: 'concluido' }).eq('id', id));
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prazos'] });
      toast({ title: 'Prazo concluído', description: 'Marcado como concluído.' });
    },
  });

  const reopenMutation = useMutation({
    mutationFn: async (id: string) => {
      let { error } = await supabase.from('prazos')
        .update({ status: 'pendente', concluido_em: null, concluido_por: null } as any)
        .eq('id', id);
      if (error) ({ error } = await supabase.from('prazos').update({ status: 'pendente' }).eq('id', id));
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prazos'] });
      toast({ title: 'Prazo reaberto', description: 'Voltou para pendente.' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Soft delete → vai para a Lixeira (recuperável)
      const { error } = await supabase.from('prazos').update({ deletado: true }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prazos'] });
      toast({ title: 'Prazo excluído', description: 'Movido para a lixeira.' });
      setDeleteTarget(null);
    },
    onError: (e: any) => toast({ title: 'Erro ao excluir', description: e.message, variant: 'destructive' }),
  });

  const filtered = useMemo(() => prazos.filter(p => {
    const q = dSearch.toLowerCase();
    const matchSearch = !dSearch
      || tituloPrazo(p, pubInfo).toLowerCase().includes(q)
      || (teorMap[p.id] || '').toLowerCase().includes(q);
    const matchPriority = filterPriority === 'all' || p.prioridade === filterPriority;
    const matchConcluido = showConcluidos || p.status !== 'concluido';
    const matchUrgency = filterUrgency === 'all' || getUrgency(p) === filterUrgency;
    const matchResp = filterResp === 'all'
      || (filterResp === '__none__' ? !p.responsavel_id : p.responsavel_id === filterResp);
    const matchCliente = filterCliente === 'all' || clienteDoPrazo(p) === filterCliente;
    const matchTitular = filterTitular === 'all' || (p.titular || 'nosso') === filterTitular;
    return matchSearch && matchPriority && matchConcluido && matchUrgency && matchResp && matchCliente && matchTitular;
  }), [prazos, dSearch, filterPriority, filterUrgency, showConcluidos, filterResp, filterCliente, filterTitular, processoInfo, pubInfo, teorMap]);

  // Clientes que possuem prazos (para o filtro)
  const clienteOptions = useMemo(() => {
    const seen = new Map<string, string>();
    prazos.forEach(p => { const cid = clienteDoPrazo(p); if (cid) seen.set(cid, clienteNomeDoPrazo(p) || 'Cliente'); });
    return [...seen.entries()].map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [prazos, processoInfo]);

  const multiSelect = useMultiSelect(filtered);

  const bulkConcludeMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      let { error } = await supabase.from('prazos')
        .update({ status: 'concluido', concluido_em: new Date().toISOString(), concluido_por: user?.id } as any)
        .in('id', ids);
      if (error) ({ error } = await supabase.from('prazos').update({ status: 'concluido' }).in('id', ids));
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['prazos'] }); multiSelect.clearSelection(); toast({ title: 'Prazos concluídos' }); },
    onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('prazos').update({ deletado: true }).in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['prazos'] }); multiSelect.clearSelection(); setBulkDeleteOpen(false); toast({ title: 'Prazos excluídos', description: 'Movidos para a lixeira.' }); },
    onError: (e: any) => toast({ title: 'Erro ao excluir', description: e.message, variant: 'destructive' }),
  });

  const bulkAssignMutation = useMutation({
    mutationFn: async ({ ids, responsavel_id }: { ids: string[]; responsavel_id: string }) => {
      const { error } = await supabase.from('prazos').update({ responsavel_id }).in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['prazos'] }); multiSelect.clearSelection(); toast({ title: 'Responsável atribuído' }); },
    onError: (e: any) => toast({ title: 'Erro ao atribuir', description: e.message, variant: 'destructive' }),
  });

  const grouped = useMemo(() => {
    const map: Record<Urgency, Prazo[]> = { vencido: [], hoje: [], critico: [], normal: [], concluido: [] };
    filtered.forEach(p => map[getUrgency(p)].push(p));
    // Vencidos: mais atrasado primeiro; demais: prioridade e depois data
    (Object.keys(map) as Urgency[]).forEach(k => { map[k] = sortPrazos(map[k], k === 'vencido'); });
    return map;
  }, [filtered]);

  const kpis = useMemo(() => ({
    vencidos: grouped.vencido.length,
    hoje: grouped.hoje.length,
    criticos: grouped.critico.length,
    total: prazos.filter(p => p.status !== 'concluido').length,
  }), [grouped, prazos]);

  const prazoToFormData = (p: Prazo): PrazoFormData => ({
    id: p.id,
    titulo: p.titulo,
    descricao: p.descricao,
    data_publicacao: p.data_publicacao,
    data_prazo_interno: p.data_prazo_interno,
    data_fim_prazo: p.data_fim_prazo || p.data_vencimento,
    prioridade: p.prioridade,
    processo_id: p.processo_id,
    office_id: p.office_id,
    user_id: p.user_id,
    avisos_dias: (p as any).avisos_dias ?? null,
    titular: p.titular ?? 'nosso',
  });

  return (
    <div className="space-y-6 p-4 md:p-6 overflow-x-hidden animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <CalendarClock className="h-5 w-5" />
            </div>
            Prazos
          </h1>
          <p className="text-muted-foreground mt-1 text-sm ml-1">Monitore e gerencie seus prazos judiciais</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="flex items-center rounded-xl border border-black/8 dark:border-border bg-card/60 p-0.5 shrink-0">
            <Button size="icon" variant={view === 'lista' ? 'secondary' : 'ghost'}
              onClick={() => setView('lista')} className="h-9 w-9 rounded-lg" title="Lista"><List className="h-4 w-4" /></Button>
            <Button size="icon" variant={view === 'calendario' ? 'secondary' : 'ghost'}
              onClick={() => setView('calendario')} className="h-9 w-9 rounded-lg" title="Calendário"><CalendarDays className="h-4 w-4" /></Button>
          </div>
          <Button
            onClick={() => setDialogOpen(true)}
            className="flex-1 sm:flex-none rounded-2xl h-11 gap-2 px-4 sm:px-6 font-black text-[11px] uppercase tracking-widest shadow-lg shadow-primary/20"
          >
            <Plus className="h-4 w-4" /> Novo Prazo
          </Button>
        </div>
      </div>

      {/* KPI Strip — clicáveis como filtro rápido */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Vencidos',        value: kpis.vencidos,  icon: AlertTriangle, color: 'text-red-600',    bg: 'bg-red-500/8 border-red-500/15',       activeBg: 'ring-2 ring-red-500/40',    urgency: 'vencido'  as Urgency },
          { label: 'Vencem hoje',     value: kpis.hoje,      icon: Flame,         color: 'text-amber-600',  bg: 'bg-amber-500/8 border-amber-500/15',   activeBg: 'ring-2 ring-amber-500/40',  urgency: 'hoje'     as Urgency },
          { label: 'Próximos 3 dias', value: kpis.criticos,  icon: Timer,         color: 'text-orange-600', bg: 'bg-orange-500/8 border-orange-500/15', activeBg: 'ring-2 ring-orange-500/40', urgency: 'critico'  as Urgency },
          { label: 'Total pendente',  value: kpis.total,     icon: Calendar,      color: 'text-sky-600',    bg: 'bg-sky-500/8 border-sky-500/15',       activeBg: 'ring-2 ring-sky-500/40',    urgency: null },
        ].map(({ label, value, icon: Icon, color, bg, activeBg, urgency }) => {
          const isActive = urgency ? filterUrgency === urgency : false;
          return (
            <button
              key={label}
              onClick={() => {
                if (!urgency) return;
                setFilterUrgency(prev => prev === urgency ? 'all' : urgency);
              }}
              className={cn(
                'rounded-2xl border p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3 text-left transition-all',
                bg,
                urgency ? 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]' : 'cursor-default',
                isActive && activeBg,
              )}
            >
              <div className={cn('p-2 rounded-xl bg-background/60 shrink-0', color)}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className={cn('text-xl sm:text-2xl font-black', color)}>{value}</p>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest truncate">
                  {label}{isActive && ' ✕'}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
          <Input
            placeholder="Buscar prazos..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 h-10 rounded-xl bg-background border-border text-sm"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['all', 'alta', 'media', 'baixa'] as const).map(p => (
            <button
              key={p}
              onClick={() => setFilterPriority(p)}
              className={cn(
                'h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border',
                filterPriority === p
                  ? 'bg-foreground text-background border-foreground'
                  : 'bg-background text-muted-foreground border-border hover:border-foreground/30'
              )}
            >
              {p === 'all' ? 'Todos' : PRIORITY_CONFIG[p].label}
            </button>
          ))}
          {/* Toggle concluídos */}
          <button
            onClick={() => setShowConcluidos(v => !v)}
            className={cn(
              'h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border flex items-center gap-1.5',
              showConcluidos
                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                : 'bg-background text-muted-foreground border-border hover:border-foreground/30'
            )}
          >
            {showConcluidos ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            Concluídos
          </button>
        </div>
        {officeUsers.length > 0 && (
          <Select value={filterResp} onValueChange={setFilterResp}>
            <SelectTrigger className="h-10 rounded-xl w-full sm:w-44 bg-background border-border text-sm font-bold"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos responsáveis</SelectItem>
              <SelectItem value="__none__">Sem responsável</SelectItem>
              {officeUsers.map((u: any) => <SelectItem key={u.user_id} value={u.user_id}>{membroMap[u.user_id]}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {clienteOptions.length > 0 && (
          <Select value={filterCliente} onValueChange={setFilterCliente}>
            <SelectTrigger className="h-10 rounded-xl w-full sm:w-44 bg-background border-border text-sm font-bold"><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="all">Todos clientes</SelectItem>
              {clienteOptions.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Select value={filterTitular} onValueChange={setFilterTitular}>
          <SelectTrigger className="h-10 rounded-xl w-full sm:w-40 bg-background border-border text-sm font-bold"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os prazos</SelectItem>
            <SelectItem value="nosso">Nossos</SelectItem>
            <SelectItem value="contraria">Parte contrária</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Barra de ações em lote */}
      {multiSelect.selectedCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-primary/20 bg-primary/[0.04] px-3 py-2">
          <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground px-1">
            {multiSelect.selectedCount} selecionado{multiSelect.selectedCount !== 1 ? 's' : ''}
          </span>
          <Button size="sm" variant="outline" disabled={bulkConcludeMutation.isPending}
            onClick={() => bulkConcludeMutation.mutate(multiSelect.getSelectedItems().map(i => i.id))}
            className="h-8 rounded-lg gap-1.5 font-bold text-emerald-600">
            <CheckCheck className="h-3.5 w-3.5" /> Concluir
          </Button>
          {officeUsers.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" disabled={bulkAssignMutation.isPending}
                  className="h-8 rounded-lg gap-1.5 font-bold">
                  <User className="h-3.5 w-3.5" /> Atribuir
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="rounded-xl w-48 max-h-64 overflow-y-auto">
                {officeUsers.map((u: any) => (
                  <DropdownMenuItem key={u.user_id} className="rounded-lg cursor-pointer"
                    onClick={() => bulkAssignMutation.mutate({ ids: multiSelect.getSelectedItems().map(i => i.id), responsavel_id: u.user_id })}>
                    {membroMap[u.user_id]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button size="sm" variant="outline" disabled={bulkDeleteMutation.isPending}
            onClick={() => setBulkDeleteOpen(true)}
            className="h-8 rounded-lg gap-1.5 font-bold text-red-600">
            <Trash2 className="h-3.5 w-3.5" /> Excluir
          </Button>
          <Button size="sm" variant="ghost" onClick={() => multiSelect.clearSelection()} className="h-8 w-8 p-0 rounded-lg ml-auto" title="Limpar seleção">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Calendário mensal */}
      {!isLoading && view === 'calendario' && (
        <MonthView
          items={filtered}
          refDate={mesRef}
          onPrev={() => setMesRef(d => addMonths(d, -1))}
          onNext={() => setMesRef(d => addMonths(d, 1))}
          onHoje={() => setMesRef(new Date())}
          onSelect={setEditTarget}
        />
      )}

      {/* Empty */}
      {!isLoading && view === 'lista' && filtered.length === 0 && (
        <div className="py-20 flex flex-col items-center justify-center text-center space-y-3 opacity-30">
          <Inbox className="h-14 w-14" />
          <p className="font-black uppercase tracking-widest text-sm">Nenhum prazo encontrado</p>
          <p className="text-xs max-w-xs">Crie um novo prazo ou ajuste os filtros.</p>
        </div>
      )}

      {/* Sections */}
      {!isLoading && view === 'lista' && SECTION_ORDER.map(urgency => {
        const items = grouped[urgency];
        if (items.length === 0) return null;
        const cfg = URGENCY_CONFIG[urgency];
        const Icon = cfg.icon;

        return (
          <div key={urgency} className="space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <Icon className={cn('h-3.5 w-3.5', cfg.color)} />
              <span className={cn('text-[10px] font-black uppercase tracking-widest', cfg.color)}>
                {SECTION_LABELS[urgency]}
              </span>
              <Badge variant="outline" className={cn('text-[9px] font-black px-2 py-0.5 border', cfg.badge)}>
                {items.length}
              </Badge>
              <div className="flex-1 h-px bg-border/50 ml-1" />
            </div>

            <div className="space-y-2">
              {items.map(prazo => {
                const priCfg = PRIORITY_CONFIG[prazo.prioridade] || PRIORITY_CONFIG.media;
                const isConcluido = prazo.status === 'concluido';

                return (
                  <div
                    key={prazo.id}
                    id={`item-${prazo.id}`}
                    className={cn(
                      'group relative flex items-center gap-3 sm:gap-4 bg-background border border-border/60 rounded-2xl px-4 sm:px-5 py-4 border-l-4 transition-all hover:border-border hover:shadow-sm',
                      cfg.border,
                      multiSelect.isSelected(prazo.id) && 'ring-2 ring-primary/20 border-primary/40',
                      isConcluido && 'opacity-60'
                    )}
                  >
                    <Checkbox checked={multiSelect.isSelected(prazo.id)} onCheckedChange={() => multiSelect.toggleItem(prazo.id)} className="rounded-md shrink-0" />
                    <div className={cn('w-2 h-2 rounded-full shrink-0 hidden sm:block', cfg.dot)} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={cn('font-black text-sm', isConcluido && 'line-through text-muted-foreground')}>
                          {tituloPrazo(prazo, pubInfo)}
                        </span>
                        <Badge variant="outline" className={cn('text-[9px] font-black uppercase tracking-widest border px-2 py-0.5', priCfg.color)}>
                          {priCfg.label}
                        </Badge>
                        {!prazo.responsavel_id && (
                          <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border px-2 py-0.5 bg-fuchsia-500/10 text-fuchsia-600 border-fuchsia-500/20">
                            Sem responsável
                          </Badge>
                        )}
                        {prazo.titular === 'contraria' && (
                          <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border px-2 py-0.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20">
                            Parte contrária
                          </Badge>
                        )}
                      </div>
                      {/* Teor do prazo (descrição própria ou conteúdo da publicação de origem) */}
                      {teorMap[prazo.id] && (() => {
                        const teor = teorMap[prazo.id];
                        const aberto = teorAberto === prazo.id;
                        const longo = teor.length > 180;
                        return (
                          <div className="mb-1.5">
                            <p className={cn(
                              'text-xs text-muted-foreground whitespace-pre-wrap',
                              aberto ? 'max-h-64 overflow-y-auto pr-1' : 'line-clamp-2'
                            )}>
                              {teor}
                            </p>
                            {longo && (
                              <button
                                type="button"
                                onClick={() => setTeorAberto(aberto ? null : prazo.id)}
                                className="mt-0.5 text-[11px] font-bold text-primary hover:underline"
                              >
                                {aberto ? 'Recolher teor' : 'Ver teor completo'}
                              </button>
                            )}
                          </div>
                        );
                      })()}
                      {/* 3 datas */}
                      <div className="flex flex-wrap items-center gap-3 text-[11px]">
                        {clienteNomeDoPrazo(prazo) && (
                          <span className="flex items-center gap-1 text-muted-foreground font-semibold">
                            <User className="h-3 w-3" />{clienteNomeDoPrazo(prazo)}
                          </span>
                        )}
                        {prazo.data_publicacao && (
                          <span className="flex items-center gap-1 text-sky-600">
                            <Newspaper className="h-3 w-3" />
                            <span className="text-muted-foreground">Publicação:</span>
                            {format(toLocalDate(prazo.data_publicacao), 'dd/MM/yy', { locale: ptBR })}
                          </span>
                        )}
                        {prazo.data_disponibilizacao && (
                          <span className="flex items-center gap-1 text-cyan-600">
                            <Newspaper className="h-3 w-3" />
                            <span className="text-muted-foreground">Disponibilização:</span>
                            {format(toLocalDate(prazo.data_disponibilizacao), 'dd/MM/yy', { locale: ptBR })}
                          </span>
                        )}
                        {prazo.data_intimacao && (
                          <span className="flex items-center gap-1 text-violet-600">
                            <Clock className="h-3 w-3" />
                            <span className="text-muted-foreground">Intimação:</span>
                            {format(toLocalDate(prazo.data_intimacao), 'dd/MM/yy', { locale: ptBR })}
                          </span>
                        )}
                        {prazo.data_prazo_interno && (
                          <span className="flex items-center gap-1 text-amber-600">
                            <Shield className="h-3 w-3" />
                            <span className="text-muted-foreground">Interno:</span>
                            {format(toLocalDate(prazo.data_prazo_interno), 'dd/MM/yy', { locale: ptBR })}
                          </span>
                        )}
                        {getDataPrazo(prazo) && (
                          <span className="flex items-center gap-1 text-red-600 font-bold">
                            <AlertOctagon className="h-3 w-3" />
                            <span className="text-muted-foreground font-normal">Fatal:</span>
                            {format(toLocalDate(getDataPrazo(prazo)!), 'dd/MM/yy', { locale: ptBR })}
                          </span>
                        )}
                        {prazo.eh_juizado && (
                          <span className="px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-600 text-[9px] font-black uppercase tracking-widest">Juizado</span>
                        )}
                        {prazo.base_legal && (
                          <span className="text-muted-foreground/50 text-[10px]">{prazo.base_legal}</span>
                        )}
                        {/* Link para processo */}
                        {prazo.processo_id && (
                          <button
                            onClick={() => navigate(`/processos/${prazo.processo_id}`)}
                            className="flex items-center gap-1 text-primary hover:text-primary/80 transition-colors ml-1"
                          >
                            <Clock className="h-3 w-3" />
                            <span className="underline underline-offset-2 text-[11px]">Ver processo</span>
                          </button>
                        )}
                        {isConcluido && prazo.concluido_em && (
                          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" /> Concluído por {membroMap[prazo.concluido_por || ""] || "—"} · {format(new Date(prazo.concluido_em), "dd/MM/yy", { locale: ptBR })}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: days pill + actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={cn(
                        'text-[11px] font-black px-3 py-1 rounded-full border whitespace-nowrap',
                        cfg.badge
                      )}>
                        {getDaysLabel(prazo)}
                      </span>

                      {!isConcluido ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => concludeMutation.mutate(prazo.id)}
                          disabled={concludeMutation.isPending}
                          className="h-8 w-8 p-0 rounded-xl max-sm:opacity-100 opacity-0 group-hover:opacity-100 transition-opacity text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700"
                          title="Marcar como concluído"
                        >
                          <CheckCheck className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => reopenMutation.mutate(prazo.id)}
                          disabled={reopenMutation.isPending}
                          className="h-8 w-8 p-0 rounded-xl max-sm:opacity-100 opacity-0 group-hover:opacity-100 transition-opacity text-sky-600 hover:bg-sky-500/10 hover:text-sky-700"
                          title="Reabrir prazo"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )}

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 rounded-xl max-sm:opacity-100 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl w-44">
                          {!isConcluido ? (
                            <DropdownMenuItem
                              onClick={() => concludeMutation.mutate(prazo.id)}
                              className="rounded-lg cursor-pointer gap-2 text-emerald-600 focus:text-emerald-600"
                            >
                              <CheckCircle2 className="h-4 w-4" /> Concluir
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => reopenMutation.mutate(prazo.id)}
                              className="rounded-lg cursor-pointer gap-2 text-sky-600 focus:text-sky-600"
                            >
                              <RotateCcw className="h-4 w-4" /> Reabrir
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => setEditTarget(prazo)}
                            className="rounded-lg cursor-pointer gap-2"
                          >
                            <Pencil className="h-4 w-4" /> Editar
                          </DropdownMenuItem>
                          {prazo.processo_id && (
                            <DropdownMenuItem
                              onClick={() => navigate(`/processos/${prazo.processo_id}`)}
                              className="rounded-lg cursor-pointer gap-2"
                            >
                              <ChevronRight className="h-4 w-4" /> Ver processo
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setDeleteTarget(prazo)}
                            className="rounded-lg cursor-pointer gap-2 text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* New */}
      <NovoPrazoStandaloneDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['prazos'] })}
      />

      {/* Edit — passa dados completos para UPDATE real */}
      {editTarget && (
        <NovoPrazoStandaloneDialog
          open={!!editTarget}
          onOpenChange={v => { if (!v) setEditTarget(null); }}
          prazoParaEditar={prazoToFormData(editTarget)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['prazos'] });
            setEditTarget(null);
          }}
        />
      )}

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" /> Excluir prazo?
            </AlertDialogTitle>
            <AlertDialogDescription>
              O prazo <strong>"{deleteTarget?.titulo}"</strong> será excluído permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
              className="rounded-xl bg-red-600 hover:bg-red-700 text-white"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirm */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" /> Excluir {multiSelect.selectedCount} prazo{multiSelect.selectedCount !== 1 ? 's' : ''}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Os prazos selecionados serão movidos para a lixeira (recuperáveis).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => bulkDeleteMutation.mutate(multiSelect.getSelectedItems().map(i => i.id))}
              disabled={bulkDeleteMutation.isPending}
              className="rounded-xl bg-red-600 hover:bg-red-700 text-white"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
