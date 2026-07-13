import React, { useState, useEffect, useCallback, useMemo, useDeferredValue } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useProcessosV2 } from '@/hooks/useProcessosV2';
import { FileText, Loader2, RotateCw, Search, Plus, Database, Scale, CheckCircle2, PauseCircle, FolderOpen, Users, Inbox } from 'lucide-react';
import { useMyTeams } from '@/hooks/useMyTeams';
import { useProcessosEncontrados } from '@/hooks/useProcessosEncontrados';
import { ProcessosEncontradosInbox } from '@/components/Processos/ProcessosEncontradosInbox';
import { PermissionGuard } from '@/components/Auth/PermissionGuard';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { DeleteConfirmDialog } from '@/components/ui/DeleteConfirmDialog';

import { ProcessoCard } from '@/components/Processos/ProcessoCard';
import { NovoProcessoDialog } from '@/components/Processos/NovoProcessoDialog';
import { ProcessoFilters } from '@/components/Processos/ProcessoFilters';
import { ProcessoTable } from '@/components/Processos/ProcessoTable';
import { ProcessoDetailsDrawer } from '@/components/Processos/ProcessoDetailsDrawer';
import { ProcessoViewSwitcher } from '@/components/Processos/ProcessoViewSwitcher';
import { JudicialSyncDialog } from '@/components/Processos/JudicialSyncDialog';
import { EmptyState } from '@/components/ui/empty-state';
import { ProcessoIntegracaoPanel } from '@/components/Processos/ProcessoIntegracaoPanel';

import { Processo, ProcessoFilters as IProcessoFilters } from '@/types/processo';

const STATUS_TABS = [
  {
    key: 'ativos',
    label: 'Em Andamento',
    icon: Scale,
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-500/10',
    border: 'border-blue-200 dark:border-blue-500/30',
    bar: 'bg-blue-500',
    match: (p: Processo) => p.status === 'Em andamento',
  },
  {
    key: 'concluidos',
    label: 'Concluídos',
    icon: CheckCircle2,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    border: 'border-emerald-200 dark:border-emerald-500/30',
    bar: 'bg-emerald-500',
    match: (p: Processo) => p.status === 'Concluído',
  },
  {
    key: 'suspensos',
    label: 'Suspensos',
    icon: PauseCircle,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-500/10',
    border: 'border-amber-200 dark:border-amber-500/30',
    bar: 'bg-amber-500',
    match: (p: Processo) => p.status === 'Suspenso',
  },
  {
    key: 'todos',
    label: 'Todos',
    icon: FolderOpen,
    color: 'text-slate-600 dark:text-slate-400',
    bg: 'bg-slate-50 dark:bg-slate-500/10',
    border: 'border-slate-200 dark:border-slate-500/30',
    bar: 'bg-slate-400',
    match: () => true,
  },
];

const Processos = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { teams: myTeams, isAnyCoordinator, coordinatedMemberIds } = useMyTeams();
  const { count: encontradosCount, refetch: refetchEncontrados } = useProcessosEncontrados();

  const {
    data: processos,
    loading,
    refresh,
    requestDelete,
  } = useProcessosV2();

  // equipe selecionada para filtro (null = todos)
  const [teamFilter, setTeamFilter] = useState<string | null>(null);

  const [view, setView] = useState<'grid' | 'table'>('grid');
  const [isNovoDialogOpen, setIsNovoDialogOpen] = useState(false);
  const [isSyncDialogOpen, setIsSyncDialogOpen] = useState(false);
  const [isIntegracaoOpen, setIsIntegracaoOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedProcesso, setSelectedProcesso] = useState<Processo | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [processoToDelete, setProcessoToDelete] = useState<Processo | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState('ativos');

  // Abre o modal quando sidebar "Importar / Novo" navega para ?tab=novo
  useEffect(() => {
    if (searchParams.get('tab') === 'novo') {
      setIsNovoDialogOpen(true);
      // Limpa o parâmetro para funcionar nas próximas vezes
      navigate('/processos', { replace: true });
    }
  }, [location.search]);

  // Abre o detalhe do processo quando a busca global navega para ?openId=...
  useEffect(() => {
    const openId = searchParams.get('openId');
    if (!openId || !processos.length) return;
    const proc = processos.find(p => String(p.id) === openId);
    if (proc) {
      setSelectedProcesso(proc);
      setIsDetailsOpen(true);
    }
    navigate('/processos', { replace: true });
  }, [location.search, processos]);

  const [filters, setFilters] = useState<IProcessoFilters>({
    search: '',
    status: 'all',
    cliente: 'all',
    numeroProcesso: '',
    area: 'all',
    movimentacao: 'all',
  });

  const tabCounts = useMemo(() => {
    const result: Record<string, number> = {};
    for (const tab of STATUS_TABS) {
      result[tab.key] = processos.filter(tab.match).length;
    }
    return result;
  }, [processos]);

  // Busca adiada (input responsivo; filtragem/lista re-renderiza em baixa prioridade)
  const dSearch = useDeferredValue(filters.search);
  const filteredProcessos = useMemo(() => {
    const tab = STATUS_TABS.find(t => t.key === activeTab);
    const teamMemberIds = teamFilter
      ? myTeams.find(t => t.id === teamFilter)?.memberIds ?? []
      : null;
    const q = dSearch.toLowerCase();
    return processos.filter(p => {
      const matchesSearch =
        p.titulo.toLowerCase().includes(q) ||
        p.cliente.toLowerCase().includes(q) ||
        (p.numeroProcesso && p.numeroProcesso.includes(dSearch));
      const matchesCliente = filters.cliente === 'all' || p.cliente === filters.cliente;
      const matchesArea = filters.area === 'all' || p.area === filters.area;
      const matchesTab = tab ? tab.match(p) : true;
      const matchesTeam = !teamMemberIds || teamMemberIds.includes(p.responsavelId ?? '');
      return matchesSearch && matchesCliente && matchesArea && matchesTab && matchesTeam;
    });
  }, [processos, dSearch, filters.cliente, filters.area, activeTab, teamFilter, myTeams]);

  const clientesDisponiveis = useMemo(() => {
    const unique = new Set(processos.map(p => p.cliente));
    return Array.from(unique).sort();
  }, [processos]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.cliente !== 'all') count++;
    if (filters.area !== 'all') count++;
    return count;
  }, [filters]);

  const handleClearFilters = useCallback(() => {
    setFilters({ search: '', status: 'all', cliente: 'all', area: 'all', movimentacao: 'all', numeroProcesso: '' });
  }, []);

  if (loading && processos.length === 0) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const activeTabDef = STATUS_TABS.find(t => t.key === activeTab) ?? STATUS_TABS[0];
  const isEncontrados = activeTab === 'encontrados';

  return (
    <div className="space-y-5 p-4 md:p-6 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Scale className="h-5 w-5" />
            </div>
            Processos Judiciais
          </h1>
          <p className="text-muted-foreground mt-1 text-sm ml-1">
            Gestão inteligente de processos e acompanhamento processual.
          </p>
        </div>

        <PermissionGuard permission="canCreateProcesses">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsIntegracaoOpen(true)}
            className="rounded-xl h-9 px-4 font-semibold text-xs border-black/10 dark:border-border gap-1.5"
            title="Buscar e importar processo pelo número"
          >
            <Database className="h-3.5 w-3.5 text-primary" />
            Consultar Processo
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsSyncDialogOpen(true)}
            className="rounded-xl h-9 px-4 font-semibold text-xs border-black/10 dark:border-border gap-1.5"
            title="Busca automaticamente novas publicações e andamentos pela OAB do advogado"
          >
            <RotateCw className="h-3.5 w-3.5 text-primary" />
            Sincronizar OAB
          </Button>
          <Button
            onClick={() => setIsNovoDialogOpen(true)}
            size="sm"
            className="rounded-xl h-9 px-4 font-bold text-xs shadow-md shadow-primary/20 gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Novo Processo
          </Button>
        </div>
        </PermissionGuard>
      </div>

      {/* KPI tabs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {STATUS_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'relative flex items-center gap-3 p-4 rounded-2xl border text-left transition-all duration-200 hover:-translate-y-0.5',
                isActive
                  ? `${tab.bg} ${tab.border} shadow-md`
                  : 'bg-card/60 border-black/5 dark:border-border hover:border-black/10 dark:hover:border-border'
              )}
            >
              <div className={cn('p-2 rounded-xl', isActive ? tab.bg : 'bg-muted/50')}>
                <Icon className={cn('h-4 w-4', isActive ? tab.color : 'text-muted-foreground')} />
              </div>
              <div>
                <div className={cn('text-2xl font-black leading-none', isActive ? tab.color : 'text-foreground')}>
                  {tabCounts[tab.key] ?? 0}
                </div>
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mt-0.5">
                  {tab.label}
                </div>
              </div>
              {isActive && (
                <div className={cn('absolute bottom-0 inset-x-0 h-0.5 rounded-b-2xl', tab.bar)} />
              )}
            </button>
          );
        })}

        {/* Aba especial: Processos Encontrados (robô) */}
        <button
          onClick={() => setActiveTab('encontrados')}
          className={cn(
            'relative flex items-center gap-3 p-4 rounded-2xl border text-left transition-all duration-200 hover:-translate-y-0.5',
            isEncontrados
              ? 'bg-primary/10 border-primary/30 shadow-md'
              : 'bg-card/60 border-black/5 dark:border-border hover:border-black/10 dark:hover:border-border'
          )}
        >
          <div className={cn('p-2 rounded-xl relative', isEncontrados ? 'bg-primary/10' : 'bg-muted/50')}>
            <Inbox className={cn('h-4 w-4', isEncontrados ? 'text-primary' : 'text-muted-foreground')} />
            {encontradosCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center">{encontradosCount}</span>
            )}
          </div>
          <div>
            <div className={cn('text-2xl font-black leading-none', isEncontrados ? 'text-primary' : 'text-foreground')}>{encontradosCount}</div>
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mt-0.5">Encontrados</div>
          </div>
          {isEncontrados && <div className="absolute bottom-0 inset-x-0 h-0.5 rounded-b-2xl bg-primary" />}
        </button>
      </div>

      {/* Barra de pesquisa + filtros */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1 group/s">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50 group-focus-within/s:text-primary transition-colors" />
          <Input
            placeholder="Buscar por título, cliente ou número CNJ..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="pl-10 h-10 rounded-xl bg-background border-black/10 dark:border-border text-sm"
          />
        </div>
        <ProcessoFilters
          filters={filters}
          onFiltersChange={setFilters}
          clientes={clientesDisponiveis}
          activeFiltersCount={activeFiltersCount}
          onClearFilters={handleClearFilters}
        />
        {/* Filtro de equipe — visível só para coordenadores */}
        {isAnyCoordinator && myTeams.filter(t => t.myRole === 'coordinator').length > 0 && (
          <div className="flex gap-1.5">
            {myTeams.filter(t => t.myRole === 'coordinator').map(team => (
              <button
                key={team.id}
                onClick={() => setTeamFilter(prev => prev === team.id ? null : team.id)}
                className={cn(
                  "h-10 px-3 rounded-xl border text-xs font-black flex items-center gap-1.5 transition-all whitespace-nowrap",
                  teamFilter === team.id
                    ? "border-transparent text-white"
                    : "border-black/10 dark:border-border text-muted-foreground hover:text-foreground hover:bg-muted/40"
                )}
                style={teamFilter === team.id ? { backgroundColor: team.color } : {}}
              >
                <Users className="h-3.5 w-3.5" />
                {team.name}
              </button>
            ))}
          </div>
        )}
        <ProcessoViewSwitcher view={view} onViewChange={setView} />
      </div>

      {/* Conteúdo */}
      <Card className="border-black/5 dark:border-border bg-card/50 rounded-2xl overflow-hidden">
        <div className={cn('h-1 w-full', isEncontrados ? 'bg-primary' : activeTabDef.bar)} />
        <CardContent className="p-5">
          {isEncontrados ? (
            <ProcessosEncontradosInbox
              onChange={() => { refresh(); refetchEncontrados(); }}
              onBuscar={() => setIsSyncDialogOpen(true)}
            />
          ) : filteredProcessos.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="Nenhum processo encontrado"
              description={
                filters.search || activeFiltersCount > 0
                  ? 'Nenhum processo corresponde aos filtros selecionados.'
                  : 'Clique em "Novo Processo" para adicionar o primeiro.'
              }
              actionLabel={filters.search || activeFiltersCount > 0 ? 'Limpar filtros' : undefined}
              onAction={filters.search || activeFiltersCount > 0 ? handleClearFilters : undefined}
            />
          ) : view === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredProcessos.map((p) => (
                <ProcessoCard
                  key={p.id}
                  processo={p}
                  onEdit={(proc) => { setSelectedProcesso(proc); setIsDetailsOpen(true); }}
                  onDelete={(proc) => { setProcessoToDelete(proc); setIsDeleteDialogOpen(true); }}
                  onClienteClick={(clienteId) => navigate(`/clientes?id=${clienteId}`)}
                  onClick={() => { setSelectedProcesso(p); setIsDetailsOpen(true); }}
                />
              ))}
            </div>
          ) : (
            <ProcessoTable
              processos={filteredProcessos}
              onEdit={(p) => { setSelectedProcesso(p); setIsDetailsOpen(true); }}
              onDelete={(p) => { setProcessoToDelete(p); setIsDeleteDialogOpen(true); }}
              onViewDetails={(p) => { setSelectedProcesso(p); setIsDetailsOpen(true); }}
            />
          )}
        </CardContent>
      </Card>

      {/* Modais */}
      <NovoProcessoDialog
        open={isNovoDialogOpen}
        onOpenChange={setIsNovoDialogOpen}
        onSuccess={() => { refresh(); setIsNovoDialogOpen(false); }}
      />
      <JudicialSyncDialog
        open={isSyncDialogOpen}
        onOpenChange={setIsSyncDialogOpen}
        onSyncComplete={() => { refresh(); refetchEncontrados(); setIsSyncDialogOpen(false); toast({ title: 'Sincronização concluída', description: 'Processos atualizados com dados oficiais.' }); }}
      />
      <ProcessoIntegracaoPanel open={isIntegracaoOpen} onOpenChange={setIsIntegracaoOpen} />
      <DeleteConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={async () => {
          if (!processoToDelete) return;
          setIsDeleting(true);
          try {
            await requestDelete(processoToDelete.id);
          } finally {
            setIsDeleting(false);
            setIsDeleteDialogOpen(false);
            setTimeout(() => {
              setProcessoToDelete(null);
              if (typeof document !== 'undefined') document.body.style.pointerEvents = '';
            }, 100);
          }
        }}
        title="Arquivar Processo"
        description={`Deseja arquivar o processo "${processoToDelete?.titulo}"?`}
        isLoading={isDeleting}
      />
      <ProcessoDetailsDrawer 
        processo={selectedProcesso ? (processos.find(p => p.id === selectedProcesso.id) || selectedProcesso) : null} 
        open={isDetailsOpen} 
        onOpenChange={setIsDetailsOpen} 
      />
    </div>
  );
};

export default Processos;
