import { useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { NovoPrazoStandaloneDialog, PrazoFormData } from "@/components/Processos/NovoPrazoStandaloneDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, differenceInCalendarDays, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, AlertTriangle, Clock, CalendarClock, CheckCircle2,
  ChevronRight, Flame, Calendar, Inbox, MoreHorizontal, Pencil, Trash2,
  CheckCheck, Timer, Newspaper, Shield, AlertOctagon, Eye, EyeOff, RotateCcw,
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
}

// Prazo fatal: data_fim_prazo (novo padrão) ou data_vencimento (legado)
function getDataPrazo(prazo: Prazo): string | null {
  return prazo.data_fim_prazo || prazo.data_vencimento || null;
}

type Urgency = 'vencido' | 'hoje' | 'critico' | 'normal' | 'concluido';

const PRIORIDADE_RANK: Record<string, number> = { alta: 0, media: 1, baixa: 2 };

function getUrgency(prazo: Prazo): Urgency {
  if (prazo.status === 'concluido') return 'concluido';
  const data = getDataPrazo(prazo);
  if (!data) return 'normal';
  const days = differenceInCalendarDays(new Date(data), startOfDay(new Date()));
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
  const days = differenceInCalendarDays(new Date(data), startOfDay(new Date()));
  if (days < 0) return `Vencido há ${Math.abs(days)}d`;
  if (days === 0) return 'Vence hoje';
  if (days === 1) return 'Amanhã';
  return `${days} dias`;
}

function sortPrazos(items: Prazo[]): Prazo[] {
  return [...items].sort((a, b) => {
    const prioA = PRIORIDADE_RANK[a.prioridade] ?? 1;
    const prioB = PRIORIDADE_RANK[b.prioridade] ?? 1;
    if (prioA !== prioB) return prioA - prioB;
    const dateA = getDataPrazo(a);
    const dateB = getDataPrazo(b);
    if (!dateA && !dateB) return 0;
    if (!dateA) return 1;
    if (!dateB) return -1;
    return dateA.localeCompare(dateB);
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

export default function Prazos() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [filterPriority, setFilterPriority] = useState<'all' | 'alta' | 'media' | 'baixa'>('all');
  const [filterUrgency, setFilterUrgency] = useState<Urgency | 'all'>('all');
  const [showConcluidos, setShowConcluidos] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Prazo | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Prazo | null>(null);

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
        query.eq('user_id', user.id);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Prazo[];
    },
    enabled: !!user?.id,
    refetchInterval: 60_000,
  });

  const concludeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('prazos').update({ status: 'concluido' }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prazos'] });
      toast({ title: 'Prazo concluído', description: 'Marcado como concluído.' });
    },
  });

  const reopenMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('prazos').update({ status: 'pendente' }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prazos'] });
      toast({ title: 'Prazo reaberto', description: 'Voltou para pendente.' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('prazos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prazos'] });
      toast({ title: 'Prazo excluído' });
      setDeleteTarget(null);
    },
  });

  const filtered = useMemo(() => prazos.filter(p => {
    const matchSearch = !search || p.titulo.toLowerCase().includes(search.toLowerCase()) || (p.descricao || '').toLowerCase().includes(search.toLowerCase());
    const matchPriority = filterPriority === 'all' || p.prioridade === filterPriority;
    const matchConcluido = showConcluidos || p.status !== 'concluido';
    const matchUrgency = filterUrgency === 'all' || getUrgency(p) === filterUrgency;
    return matchSearch && matchPriority && matchConcluido && matchUrgency;
  }), [prazos, search, filterPriority, filterUrgency, showConcluidos]);

  const grouped = useMemo(() => {
    const map: Record<Urgency, Prazo[]> = { vencido: [], hoje: [], critico: [], normal: [], concluido: [] };
    filtered.forEach(p => map[getUrgency(p)].push(p));
    // Sort each section: prioridade then data
    (Object.keys(map) as Urgency[]).forEach(k => { map[k] = sortPrazos(map[k]); });
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
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <CalendarClock className="h-5 w-5" />
            </div>
            Prazos
          </h1>
          <p className="text-muted-foreground mt-1 text-sm ml-1">Monitore e gerencie seus prazos judiciais</p>
        </div>
        <Button
          onClick={() => setDialogOpen(true)}
          className="rounded-2xl h-11 gap-2 px-6 font-black text-[11px] uppercase tracking-widest shadow-lg shadow-primary/20"
        >
          <Plus className="h-4 w-4" /> Novo Prazo
        </Button>
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
                'rounded-2xl border p-4 flex items-center gap-3 text-left transition-all',
                bg,
                urgency ? 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]' : 'cursor-default',
                isActive && activeBg,
              )}
            >
              <div className={cn('p-2 rounded-xl bg-background/60', color)}>
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className={cn('text-2xl font-black', color)}>{value}</p>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">
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
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Empty */}
      {!isLoading && filtered.length === 0 && (
        <div className="py-20 flex flex-col items-center justify-center text-center space-y-3 opacity-30">
          <Inbox className="h-14 w-14" />
          <p className="font-black uppercase tracking-widest text-sm">Nenhum prazo encontrado</p>
          <p className="text-xs max-w-xs">Crie um novo prazo ou ajuste os filtros.</p>
        </div>
      )}

      {/* Sections */}
      {!isLoading && SECTION_ORDER.map(urgency => {
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
                    className={cn(
                      'group relative flex items-center gap-4 bg-background border border-border/60 rounded-2xl px-5 py-4 border-l-4 transition-all hover:border-border hover:shadow-sm',
                      cfg.border,
                      isConcluido && 'opacity-60'
                    )}
                  >
                    <div className={cn('w-2 h-2 rounded-full shrink-0', cfg.dot)} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={cn('font-black text-sm', isConcluido && 'line-through text-muted-foreground')}>
                          {prazo.titulo}
                        </span>
                        <Badge variant="outline" className={cn('text-[9px] font-black uppercase tracking-widest border px-2 py-0.5', priCfg.color)}>
                          {priCfg.label}
                        </Badge>
                      </div>
                      {prazo.descricao && (
                        <p className="text-xs text-muted-foreground truncate max-w-md mb-1.5">{prazo.descricao}</p>
                      )}
                      {/* 3 datas */}
                      <div className="flex flex-wrap items-center gap-3 text-[11px]">
                        {prazo.data_publicacao && (
                          <span className="flex items-center gap-1 text-sky-600">
                            <Newspaper className="h-3 w-3" />
                            <span className="text-muted-foreground">Publicação:</span>
                            {format(new Date(prazo.data_publicacao), 'dd/MM/yy', { locale: ptBR })}
                          </span>
                        )}
                        {prazo.data_prazo_interno && (
                          <span className="flex items-center gap-1 text-amber-600">
                            <Shield className="h-3 w-3" />
                            <span className="text-muted-foreground">Interno:</span>
                            {format(new Date(prazo.data_prazo_interno), 'dd/MM/yy', { locale: ptBR })}
                          </span>
                        )}
                        {getDataPrazo(prazo) && (
                          <span className="flex items-center gap-1 text-red-600 font-bold">
                            <AlertOctagon className="h-3 w-3" />
                            <span className="text-muted-foreground font-normal">Fatal:</span>
                            {format(new Date(getDataPrazo(prazo)!), 'dd/MM/yy', { locale: ptBR })}
                          </span>
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
                          className="h-8 w-8 p-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700"
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
                          className="h-8 w-8 p-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity text-sky-600 hover:bg-sky-500/10 hover:text-sky-700"
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
                            className="h-8 w-8 p-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
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
    </div>
  );
}
