import { useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { NovoPrazoStandaloneDialog } from "@/components/Processos/NovoPrazoStandaloneDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, differenceInCalendarDays, isToday, isPast, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  Plus, Search, AlertTriangle, Clock, CalendarClock, CheckCircle2,
  ChevronRight, Flame, Calendar, Inbox, MoreHorizontal, Pencil, Trash2,
  CheckCheck, Timer,
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
  data_vencimento: string;
  prioridade: 'alta' | 'media' | 'baixa';
  status: string;
  processo_id?: string | null;
  user_id: string;
  office_id?: string | null;
}

type Urgency = 'vencido' | 'hoje' | 'critico' | 'normal' | 'concluido';

function getUrgency(prazo: Prazo): Urgency {
  if (prazo.status === 'concluido') return 'concluido';
  const days = differenceInCalendarDays(new Date(prazo.data_vencimento), startOfDay(new Date()));
  if (days < 0) return 'vencido';
  if (days === 0) return 'hoje';
  if (days <= 3) return 'critico';
  return 'normal';
}

const URGENCY_CONFIG: Record<Urgency, {
  label: string; color: string; border: string; badge: string; icon: React.ElementType; dot: string;
}> = {
  vencido:  { label: 'Vencido',      color: 'text-red-600',    border: 'border-l-red-500',    badge: 'bg-red-500/10 text-red-600 border-red-500/20',    icon: AlertTriangle,  dot: 'bg-red-500' },
  hoje:     { label: 'Hoje',         color: 'text-amber-600',  border: 'border-l-amber-500',  badge: 'bg-amber-500/10 text-amber-600 border-amber-500/20', icon: Flame,         dot: 'bg-amber-500' },
  critico:  { label: 'Crítico',      color: 'text-orange-600', border: 'border-l-orange-400', badge: 'bg-orange-500/10 text-orange-600 border-orange-500/20', icon: Timer,       dot: 'bg-orange-400' },
  normal:   { label: 'No prazo',     color: 'text-sky-600',    border: 'border-l-sky-400',    badge: 'bg-sky-500/10 text-sky-600 border-sky-500/20',    icon: CalendarClock,  dot: 'bg-sky-400' },
  concluido:{ label: 'Concluído',    color: 'text-emerald-600',border: 'border-l-emerald-400',badge: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20', icon: CheckCircle2, dot: 'bg-emerald-400' },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  alta:  { label: 'Alta',  color: 'bg-red-500/10 text-red-600 border-red-500/20' },
  media: { label: 'Média', color: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  baixa: { label: 'Baixa', color: 'bg-slate-500/10 text-slate-500 border-slate-500/20' },
};

function getDaysLabel(data_vencimento: string, status: string): string {
  if (status === 'concluido') return 'Concluído';
  const days = differenceInCalendarDays(new Date(data_vencimento), startOfDay(new Date()));
  if (days < 0) return `Vencido há ${Math.abs(days)}d`;
  if (days === 0) return 'Vence hoje';
  if (days === 1) return 'Amanhã';
  return `${days} dias`;
}

const SECTION_ORDER: Urgency[] = ['vencido', 'hoje', 'critico', 'normal', 'concluido'];
const SECTION_LABELS: Record<Urgency, string> = {
  vencido:  'Vencidos',
  hoje:     'Vencem hoje',
  critico:  'Próximos 3 dias',
  normal:   'Futuros',
  concluido:'Concluídos',
};

export default function Prazos() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [filterPriority, setFilterPriority] = useState<'all' | 'alta' | 'media' | 'baixa'>('all');
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
        .order('data_vencimento', { ascending: true });
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
  });

  const concludeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('prazos').update({ status: 'concluido' }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prazos'] });
      toast({ title: 'Prazo concluído', description: 'Marcado como concluído com sucesso.' });
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
    return matchSearch && matchPriority;
  }), [prazos, search, filterPriority]);

  const grouped = useMemo(() => {
    const map: Record<Urgency, Prazo[]> = { vencido: [], hoje: [], critico: [], normal: [], concluido: [] };
    filtered.forEach(p => map[getUrgency(p)].push(p));
    return map;
  }, [filtered]);

  const kpis = useMemo(() => ({
    vencidos: grouped.vencido.length,
    hoje: grouped.hoje.length,
    criticos: grouped.critico.length,
    total: prazos.filter(p => p.status !== 'concluido').length,
  }), [grouped, prazos]);

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

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Vencidos',       value: kpis.vencidos,  icon: AlertTriangle,  color: 'text-red-600',    bg: 'bg-red-500/8 border-red-500/15' },
          { label: 'Vencem hoje',    value: kpis.hoje,      icon: Flame,          color: 'text-amber-600',  bg: 'bg-amber-500/8 border-amber-500/15' },
          { label: 'Próximos 3 dias',value: kpis.criticos,  icon: Timer,          color: 'text-orange-600', bg: 'bg-orange-500/8 border-orange-500/15' },
          { label: 'Total pendente', value: kpis.total,     icon: Calendar,       color: 'text-sky-600',    bg: 'bg-sky-500/8 border-sky-500/15' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className={cn('rounded-2xl border p-4 flex items-center gap-3', bg)}>
            <div className={cn('p-2 rounded-xl bg-background/60', color)}>
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <p className={cn('text-2xl font-black', color)}>{value}</p>
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search + Filter */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
          <Input
            placeholder="Buscar prazos..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 h-10 rounded-xl bg-background border-border text-sm"
          />
        </div>
        <div className="flex gap-2">
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
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Empty global */}
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
            {/* Section header */}
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

            {/* Cards */}
            <div className="space-y-2">
              {items.map(prazo => {
                const priCfg = PRIORITY_CONFIG[prazo.prioridade] || PRIORITY_CONFIG.media;
                const daysLabel = getDaysLabel(prazo.data_vencimento, prazo.status);
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
                    {/* Left: urgency dot */}
                    <div className={cn('w-2 h-2 rounded-full shrink-0', cfg.dot)} />

                    {/* Middle: content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className={cn('font-black text-sm', isConcluido && 'line-through text-muted-foreground')}>
                          {prazo.titulo}
                        </span>
                        <Badge variant="outline" className={cn('text-[9px] font-black uppercase tracking-widest border px-2 py-0.5', priCfg.color)}>
                          {priCfg.label}
                        </Badge>
                      </div>
                      {prazo.descricao && (
                        <p className="text-xs text-muted-foreground truncate max-w-md">{prazo.descricao}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(prazo.data_vencimento), "dd 'de' MMMM", { locale: ptBR })}
                        </span>
                      </div>
                    </div>

                    {/* Right: days pill + actions */}
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={cn(
                        'text-[11px] font-black px-3 py-1 rounded-full border whitespace-nowrap',
                        cfg.badge
                      )}>
                        {daysLabel}
                      </span>

                      {/* Quick action: mark done */}
                      {!isConcluido && (
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
                      )}

                      {/* More actions */}
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
                          {!isConcluido && (
                            <DropdownMenuItem
                              onClick={() => concludeMutation.mutate(prazo.id)}
                              className="rounded-lg cursor-pointer gap-2 text-emerald-600 focus:text-emerald-600"
                            >
                              <CheckCircle2 className="h-4 w-4" /> Concluir
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => setEditTarget(prazo)}
                            className="rounded-lg cursor-pointer gap-2"
                          >
                            <Pencil className="h-4 w-4" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setDeleteTarget(prazo)}
                            className="rounded-lg cursor-pointer gap-2 text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <ChevronRight className="h-4 w-4 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* New Prazo Dialog */}
      <NovoPrazoStandaloneDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['prazos'] });
          toast({ title: 'Prazo adicionado', description: 'O prazo foi salvo e está sendo monitorado.' });
        }}
      />

      {/* Edit Dialog */}
      {editTarget && (
        <NovoPrazoStandaloneDialog
          open={!!editTarget}
          onOpenChange={v => { if (!v) setEditTarget(null); }}
          tituloSugerido={editTarget.titulo}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['prazos'] });
            setEditTarget(null);
            toast({ title: 'Prazo atualizado' });
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
