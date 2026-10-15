import { useState, useMemo, useDeferredValue } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMultiSelect } from "@/hooks/useMultiSelect";
import { useToast } from "@/hooks/use-toast";
import { NovoPrazoStandaloneDialog, PrazoFormData } from "@/components/Processos/NovoPrazoStandaloneDialog";
import { useOpenItemFromSearch } from "@/hooks/useOpenItemFromSearch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOfficeUsers } from "@/hooks/useOfficeUsers";
import { useQueryClient } from "@tanstack/react-query";
import { addMonths } from 'date-fns';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { Plus, AlertTriangle, CalendarClock, Inbox, List, CalendarDays } from 'lucide-react';
import { AgendarPublicacaoDialog, type AcaoTipo } from '@/components/Processos/AgendarPublicacaoDialog';


// Módulos extraídos deste arquivo (desmonte do god-component) — comportamento idêntico
import {
  type Prazo, type Urgency,
  tituloPrazo, getUrgency, sortPrazos, ehSugestaoRobo, extrairAudienciaSugerida,
  URGENCY_CONFIG, SECTION_ORDER, SECTION_LABELS,
} from '@/components/Prazos/shared';
import { MonthView } from '@/components/Prazos/MonthView';
import { PrazoItem } from '@/components/Prazos/PrazoItem';
import { PrazosKpis } from '@/components/Prazos/PrazosKpis';
import { PrazosFilters } from '@/components/Prazos/PrazosFilters';
import { PrazosBulkBar } from '@/components/Prazos/PrazosBulkBar';
import { PrazosDeleteDialogs } from '@/components/Prazos/PrazosDeleteDialogs';
import { usePrazosData } from '@/hooks/usePrazosData';
import { CarregarMaisHistorico } from '@/components/shared/CarregarMaisHistorico';
import { assertRowsAffected, getErrorMessage } from '@/lib/errors';
import { usePermissions } from '@/hooks/usePermissions';

export default function Prazos() {
  const { toast } = useToast();
  const { canManagePrazos } = usePermissions();
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
  // Converter uma sugestão do robô em audiência/tarefa
  const [agendarTarget, setAgendarTarget] = useState<Prazo | null>(null);
  const [agendarTipo, setAgendarTipo] = useState<AcaoTipo>('audiencia');

  // Dados + mutações extraídos para hooks/usePrazosData (efeitos de UI via callbacks)
  const {
    prazos, isLoading, isError, error, refetch, auxError, refetchAux, pubInfo, teorMap, processoInfo,
    concluidosRestantes, carregarMaisConcluidos, carregandoMaisConcluidos,
    procDoPrazo, clienteDoPrazo, clienteNomeDoPrazo,
    aceitarMutation, concludeMutation, reopenMutation, deleteMutation,
    bulkConcludeMutation, bulkDeleteMutation, bulkAssignMutation,
  } = usePrazosData({
    showConcluidos,
    onDeleted: () => setDeleteTarget(null),
    onBulkDone: () => multiSelect.clearSelection(),
    onBulkDeleted: () => { multiSelect.clearSelection(); setBulkDeleteOpen(false); },
  });
  const [teorAberto, setTeorAberto] = useState<string | null>(null);

  // Busca global: rola até o prazo e abre o detalhe/edição
  useOpenItemFromSearch('/prazos', !isLoading && prazos.length > 0, (openId) => {
    const prazo = prazos.find(p => String(p.id) === openId);
    if (prazo) { setEditTarget(prazo); return true; }
    // Fallback: prazo de processo compartilhado de outro escritório não entra na
    // lista (filtrada por office_id do usuário atual) — busca direto por id, mesmo
    // padrão já usado em Audiencias.tsx.
    (async () => {
      const { data } = await supabase.from('prazos').select('*').eq('id', openId).maybeSingle();
      if (data) setEditTarget(data as Prazo);
    })();
    return true;
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
    // Prazos do robô nascem sem título/descrição — usa o da publicação de origem
    titulo: tituloPrazo(p, pubInfo),
    descricao: p.descricao || teorMap[p.id] || null,
    data_publicacao: p.data_publicacao,
    data_prazo_interno: p.data_prazo_interno,
    data_fim_prazo: p.data_fim_prazo || p.data_vencimento,
    prioridade: p.prioridade,
    // prazos do robô nascem sem processo_id — resolve pelo número do processo
    processo_id: p.processo_id || procDoPrazo(p)?.id || null,
    office_id: p.office_id,
    user_id: p.user_id,
    // Sem isto, editar um prazo pela página reatribuía o responsável para quem
    // editava (buildForm caía no userId). (v11)
    responsavel_id: p.responsavel_id ?? null,
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
              onClick={() => setView('lista')} className="h-9 w-9 rounded-lg" title="Lista" aria-label="Lista"><List className="h-4 w-4" /></Button>
            <Button size="icon" variant={view === 'calendario' ? 'secondary' : 'ghost'}
              onClick={() => setView('calendario')} className="h-9 w-9 rounded-lg" title="Calendário" aria-label="Calendário"><CalendarDays className="h-4 w-4" /></Button>
          </div>
          {canManagePrazos && (
            <Button
              onClick={() => setDialogOpen(true)}
              className="flex-1 sm:flex-none rounded-2xl h-11 gap-2 px-4 sm:px-6 font-black text-[11px] uppercase tracking-widest shadow-lg shadow-primary/20"
            >
              <Plus className="h-4 w-4" /> Novo Prazo
            </Button>
          )}
        </div>
      </div>

      {/* KPI Strip — clicáveis como filtro rápido */}
      <PrazosKpis kpis={kpis} filterUrgency={filterUrgency} onToggleUrgency={(u) => setFilterUrgency(prev => prev === u ? 'all' : u)} />

      {/* Search + Filters */}
      <PrazosFilters search={search} setSearch={setSearch} filterPriority={filterPriority} setFilterPriority={setFilterPriority}
        showConcluidos={showConcluidos} onToggleConcluidos={() => setShowConcluidos(v => !v)}
        filterResp={filterResp} setFilterResp={setFilterResp} filterCliente={filterCliente} setFilterCliente={setFilterCliente}
        filterTitular={filterTitular} setFilterTitular={setFilterTitular} officeUsers={officeUsers} membroMap={membroMap} clienteOptions={clienteOptions} />

      {/* Barra de ações em lote */}
      {canManagePrazos && multiSelect.selectedCount > 0 && (
        <PrazosBulkBar count={multiSelect.selectedCount} selectedIds={() => multiSelect.getSelectedItems().map(i => i.id)}
          officeUsers={officeUsers} membroMap={membroMap}
          onConcluir={(ids) => bulkConcludeMutation.mutate(ids)} concluindo={bulkConcludeMutation.isPending}
          onAtribuir={(ids, responsavel_id) => bulkAssignMutation.mutate({ ids, responsavel_id })} atribuindo={bulkAssignMutation.isPending}
          onExcluir={() => setBulkDeleteOpen(true)} excluindo={bulkDeleteMutation.isPending} onLimpar={() => multiSelect.clearSelection()} />
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Erro */}
      {!isLoading && isError && (
        <div className="py-20 flex flex-col items-center justify-center text-center space-y-4">
          <div className="p-5 rounded-full bg-destructive/10 text-destructive"><AlertTriangle className="h-10 w-10 opacity-70" /></div>
          <div>
            <p className="font-black text-lg">Não foi possível carregar os prazos</p>
            <p className="text-sm text-muted-foreground mt-1">{error instanceof Error ? error.message : "Tente novamente em instantes."}</p>
          </div>
          <Button variant="outline" onClick={() => refetch()} className="rounded-xl gap-2 font-bold">Tentar novamente</Button>
        </div>
      )}

      {!isLoading && !isError && auxError && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="flex-1">Não foi possível carregar o cliente ou o teor de alguns prazos — filtros por cliente podem ficar incompletos.</span>
          <Button size="sm" variant="outline" onClick={refetchAux} className="h-7 rounded-lg text-xs">Tentar de novo</Button>
        </div>
      )}

      {/* Calendário mensal */}
      {!isLoading && !isError && view === 'calendario' && (
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
      {!isLoading && !isError && view === 'lista' && filtered.length === 0 && (
        <div className="py-20 flex flex-col items-center justify-center text-center space-y-3 opacity-30">
          <Inbox className="h-14 w-14" />
          <p className="font-black uppercase tracking-widest text-sm">Nenhum prazo encontrado</p>
          <p className="text-xs max-w-xs">Crie um novo prazo ou ajuste os filtros.</p>
        </div>
      )}

      {/* Sections */}
      {!isLoading && !isError && view === 'lista' && SECTION_ORDER.map(urgency => {
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
              {items.map(prazo => (
                <PrazoItem key={prazo.id} prazo={prazo} urgency={urgency} selected={multiSelect.isSelected(prazo.id)}
                  onToggleSelect={(id) => multiSelect.toggleItem(id)} canManagePrazos={canManagePrazos}
                  titulo={tituloPrazo(prazo, pubInfo)} teor={teorMap[prazo.id]} clienteNome={clienteNomeDoPrazo(prazo)}
                  processo={procDoPrazo(prazo)} membroMap={membroMap} navigate={navigate}
                  teorAberto={teorAberto === prazo.id} onToggleTeor={() => setTeorAberto(teorAberto === prazo.id ? null : prazo.id)}
                  onAgendar={(p, tipo) => { setAgendarTipo(tipo); setAgendarTarget(p); }}
                  onConcluir={(id) => concludeMutation.mutate(id)} concluindo={concludeMutation.isPending}
                  onReabrir={(id) => reopenMutation.mutate(id)} reabrindo={reopenMutation.isPending}
                  onAceitar={(id) => aceitarMutation.mutate(id)} aceitando={aceitarMutation.isPending}
                  onEditar={setEditTarget} onExcluir={setDeleteTarget} />
              ))}
            </div>
          </div>
        );
      })}

      {/* Concluídos vêm paginados (só com o toggle ligado) — rodapé com o que falta carregar */}
      {!isLoading && !isError && view === 'lista' && showConcluidos && (
        <CarregarMaisHistorico restantes={concluidosRestantes} carregando={carregandoMaisConcluidos}
          onClick={carregarMaisConcluidos} rotulo="prazos concluídos" />
      )}

      {/* New */}
      <NovoPrazoStandaloneDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['prazos'] })}
      />

      {/* Converter sugestão do robô em audiência/tarefa (a sugestão é descartada ao confirmar) */}
      {agendarTarget && (
        <AgendarPublicacaoDialog
          open={!!agendarTarget}
          onOpenChange={v => { if (!v) setAgendarTarget(null); }}
          defaultTipo={agendarTipo}
          publicacaoId={agendarTarget.publicacao_id || undefined}
          numeroProcesso={agendarTarget.numero_processo || undefined}
          processoId={agendarTarget.processo_id || procDoPrazo(agendarTarget)?.id || null}
          tituloSugerido={tituloPrazo(agendarTarget, pubInfo)}
          descricaoSugerida={teorMap[agendarTarget.id]}
          dataSugerida={(agendarTarget.audiencia_data_sugerida || extrairAudienciaSugerida(teorMap[agendarTarget.id]).data) || undefined}
          horaSugerida={(agendarTarget.audiencia_hora_sugerida || extrairAudienciaSugerida(teorMap[agendarTarget.id]).hora) || undefined}
          tipoAudienciaSugerido={(agendarTarget.audiencia_tipo_sugerido || extrairAudienciaSugerida(teorMap[agendarTarget.id]).tipo) || undefined}
          prazoOrigemId={agendarTarget.id}
          onSuccess={async () => {
            // O descarte do prazo de origem acontece dentro do próprio dialog (prazoOrigemId)
            queryClient.invalidateQueries({ queryKey: ['prazos'] });
            queryClient.invalidateQueries({ queryKey: ['audiencias'] });
            queryClient.invalidateQueries({ queryKey: ['tarefas'] });
            toast({ title: 'Agendado', description: 'A sugestão do robô foi convertida e removida da lista de prazos.' });
            setAgendarTarget(null);
          }}
        />
      )}

      {/* Edit — passa dados completos para UPDATE real */}
      {editTarget && (
        <NovoPrazoStandaloneDialog
          open={!!editTarget}
          onOpenChange={v => { if (!v) setEditTarget(null); }}
          prazoParaEditar={prazoToFormData(editTarget)}
          onSuccess={async () => {
            // Revisar e salvar uma sugestão do robô equivale a aceitá-la
            if (ehSugestaoRobo(editTarget)) {
              const agora = new Date().toISOString();
              try {
                const { data, error } = await supabase.from('prazos')
                  .update({ confirmado_em: agora, confirmado_por: user?.id })
                  .eq('id', editTarget.id)
                  .select('id');
                if (error) {
                  const retry = await supabase.from('prazos').update({ confirmado_em: agora }).eq('id', editTarget.id).select('id');
                  assertRowsAffected(retry.data, retry.error, 1);
                } else {
                  assertRowsAffected(data, error, 1);
                }
              } catch (e) {
                // RLS bloqueada em silêncio (0 linhas, sem erro do Postgres) não deve
                // passar por "confirmado" sem avisar.
                toast({ title: "Não foi possível confirmar a sugestão", description: getErrorMessage(e), variant: "destructive" });
              }
            }
            queryClient.invalidateQueries({ queryKey: ['prazos'] });
            setEditTarget(null);
          }}
        />
      )}

      {/* Confirmações de exclusão (item único e em lote) */}
      <PrazosDeleteDialogs deleteTarget={deleteTarget} onCloseDelete={() => setDeleteTarget(null)}
        onConfirmDelete={(id) => deleteMutation.mutate(id)} excluindo={deleteMutation.isPending}
        bulkOpen={bulkDeleteOpen} setBulkOpen={setBulkDeleteOpen} bulkCount={multiSelect.selectedCount}
        onConfirmBulk={() => bulkDeleteMutation.mutate(multiSelect.getSelectedItems().map(i => i.id))} excluindoLote={bulkDeleteMutation.isPending} />
    </div>
  );
}
