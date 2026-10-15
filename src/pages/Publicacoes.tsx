
import { useState, useMemo, useEffect, useDeferredValue } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PublicationDetailsDialog } from "@/components/Publications/PublicationDetailsDialog";
import { PublicationSummary } from "@/components/Publications/PublicationSummary";
import { PublicationTable } from "@/components/Publications/PublicationTable";
import { PublicationFilters } from "@/components/Publications/PublicationFilters";
import { PublicationCard } from "@/components/Publications/PublicationCard";
import { PublicationsToolbar } from "@/components/Publications/PublicationsToolbar";
import { BulkActionsBar } from "@/components/Publications/BulkActionsBar";
import { PublicationsPagination } from "@/components/Publications/PublicationsPagination";
import { ArchiveConfirmDialogs } from "@/components/Publications/ArchiveConfirmDialogs";
import { BookOpen, LayoutGrid, Table as TableIcon, Inbox, RefreshCw, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { getErrorMessage } from "@/lib/errors";
import { Separator } from "@/components/ui/separator";

import { usePublicacoes } from "@/hooks/usePublicacoes";
import { usePublicacoesLista, usePublicacoesStats, fetchAllPublicacoesForExport } from "@/hooks/usePublicacoesLista";
import { useMonitoredOabs } from "@/hooks/useMonitoredOabs";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

import { NovoProcessoDialog } from "@/components/Processos/NovoProcessoDialog";
import { AgendarPublicacaoDialog, AcaoTipo } from "@/components/Processos/AgendarPublicacaoDialog";

// Datas centralizadas em @/lib/dates (fuso local, parse defensivo)
import { fmtDataBR } from "@/lib/dates";

export default function Publicacoes() {
  const { toast } = useToast();
  const { canCreateProcesses, canManagePublicacoes } = usePermissions();
  const { oabs: monitoredOabs } = useMonitoredOabs();
  const { user, profile } = useAuth();
  const { deletePublication, updateStatus, bulkUpdateStatus, syncByOab, refresh, linkPublicacaoToProcesso, findProcessoIdByCnj } = usePublicacoes();
  const { stats, loading: statsLoading, isError: statsError, refetch: refetchStats } = usePublicacoesStats();
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 24;
  const [view, setView] = useState<'grid' | 'table'>('table');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedPub, setSelectedPub] = useState<any>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [novoProcessoOpen, setNovoProcessoOpen] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [scheduleTipo, setScheduleTipo] = useState<AcaoTipo>('prazo');
  const [initialProcessData, setInitialProcessData] = useState<any>(null);
  const [registering, setRegistering] = useState(false);
  // Arquivar move a publicação pra fora das listas ativas e só o suporte
  // restaura — misclique sem confirmação era um achado da auditoria.
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null);
  const [confirmBulkArchive, setConfirmBulkArchive] = useState(false);
  const requestArchive = (id: string) => setConfirmArchiveId(id);
  const confirmArchive = async () => {
    if (!confirmArchiveId) return;
    await deletePublication(confirmArchiveId);
    setConfirmArchiveId(null);
  };

  const handleCardClick = (type: 'prazos' | 'novas' | 'sem_vinculo' | 'com_vinculo' | 'hoje' | 'tratadas') => {
    if (type === 'hoje') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const to = new Date();
      to.setHours(23, 59, 59, 999);
      setFilters({ ...filters, dateRange: { from: today, to }, status: 'all', vinculo: 'all' });
    } else if (type === 'novas') {
      setFilters({ ...filters, status: 'nova', vinculo: 'all', dateRange: { from: undefined, to: undefined } });
    } else if (type === 'tratadas') {
      setFilters({ ...filters, status: 'lida', vinculo: 'all', dateRange: { from: undefined, to: undefined } });
    } else if (type === 'prazos') {
      setFilters({ ...filters, urgencia: 'alta', vinculo: 'all', dateRange: { from: undefined, to: undefined } });
    } else if (type === 'sem_vinculo') {
      setFilters({ ...filters, search: '', status: 'all', urgencia: 'all', vinculo: 'sem', dateRange: { from: undefined, to: undefined } });
    } else if (type === 'com_vinculo') {
      setFilters({ ...filters, search: '', status: 'all', urgencia: 'all', vinculo: 'com', dateRange: { from: undefined, to: undefined } });
    }
  };

  const handleRegister = async (pub: any) => {
    if (!canCreateProcesses) {
      toast({ title: "Sem permissão", description: "Você não tem permissão para criar processos.", variant: "destructive" });
      return;
    }
    setSelectedPub(pub);

    // Anti-duplicata: se o processo já estiver cadastrado, apenas vincula a publicação.
    let processoExistenteId: string | null;
    try {
      processoExistenteId = await findProcessoIdByCnj(pub.numero_processo);
    } catch (e) {
      toast({ title: "Não foi possível verificar o processo", description: `${getErrorMessage(e)} Tente de novo para não cadastrar em dobro.`, variant: "destructive" });
      return;
    }
    if (processoExistenteId) {
      setDetailDialogOpen(false);
      const ok = await linkPublicacaoToProcesso(pub.id, processoExistenteId);
      toast({
        title: ok ? 'Publicação vinculada' : 'Atenção',
        description: ok
          ? 'Este processo já estava cadastrado. A publicação foi vinculada a ele (sem duplicar).'
          : 'Não foi possível vincular automaticamente.',
        variant: ok ? undefined : 'destructive',
      });
      refresh();
      return;
    }

    setRegistering(true);
    setDetailDialogOpen(false);

    toast({
      title: 'Buscando dados do processo…',
      description: `Consultando DataJud para ${pub.numero_processo}`,
    });

    // Fallback básico (caso a busca por CNJ falhe ou demore)
    const fallbackData = {
      titulo: pub.titulo || `Processo ${pub.numero_processo}`,
      numeroProcesso: pub.numero_processo,
      tribunal: pub.tribunal,
      vara: pub.vara,
      comarca: pub.comarca,
      descricao: `Cadastrado a partir da publicação em ${pub.data_publicacao ? fmtDataBR(pub.data_publicacao) : 'data não identificada'}.`,
    };

    try {
      // Tenta enriquecer via DataJud + PJE antes de abrir o dialog
      // OAB/UF do profile aumentam a chance de extrair partes via regex no PJE-Comunica
      const { data, error } = await supabase.functions.invoke('fetch-processo', {
        body: {
          numeroProcesso: pub.numero_processo,
          oab: profile?.oab,
          uf: profile?.oab_uf,
        },
      });

      if (!error && data && !data.error) {
        setInitialProcessData({
          ...fallbackData,
          // Sobrescreve com dados ricos do DataJud
          titulo: data.titulo && data.titulo !== 'Não identificado x Não identificado' ? data.titulo : fallbackData.titulo,
          tribunal: data.tribunal || fallbackData.tribunal,
          vara: data.vara || fallbackData.vara,
          comarca: data.comarca || fallbackData.comarca,
          valorCausa: data.valorCausa || 0,
          // Campos novos que o useProcessosV2.create entende
          autor: data.autor,
          reu: data.reu,
          classe: data.classe,
          assunto: data.assunto,
          faseProcessual: data.faseProcessual,
          instancia: data.instancia,
          dataAjuizamento: data.dataAjuizamento,
          orgaoJulgadorCodigo: data.orgaoJulgadorCodigo,
          nivelSigilo: data.nivelSigilo,
          ultimoAndamento: data.ultimoAndamento,
          andamentos: Array.isArray(data.andamentos) ? data.andamentos : [],
        });
        toast({
          title: 'Dados do processo carregados',
          description: `${data.andamentos?.length || 0} movimentação(ões) encontrada(s) no DataJud.`,
        });
      } else {
        console.warn('[handleRegister] fetch-processo retornou erro/vazio:', error?.message || data?.error);
        setInitialProcessData(fallbackData);
      }
    } catch (e: unknown) {
      console.error('[handleRegister] erro ao buscar processo:', e);
      setInitialProcessData(fallbackData);
    } finally {
      setRegistering(false);
      setNovoProcessoOpen(true);
    }
  };

  const handleSchedule = (pub: any, tipo: AcaoTipo = 'prazo') => {
    setSelectedPub(pub);
    setScheduleTipo(tipo);
    setScheduleDialogOpen(true);
  };
  
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    urgencia: 'all',
    cnj: '',
    vinculo: 'all' as 'all' | 'sem' | 'com',
    dateRange: { from: undefined as Date | undefined, to: undefined as Date | undefined }
  });

  // Busca adiada para não travar a digitação
  const dSearch = useDeferredValue(filters.search);

  // Volta pra página 1 sempre que um filtro muda (senão o usuário podia ficar
  // preso numa página 4 vazia depois de estreitar os filtros).
  useEffect(() => { setPage(1); }, [dSearch, filters.status, filters.urgencia, filters.vinculo, filters.dateRange]);
  // Seleção vale só para o que está na tela: sem isto, itens marcados numa página/
  // filtro anterior continuavam selecionados (invisíveis) e entravam na ação em lote.
  useEffect(() => { setSelectedIds([]); }, [page, dSearch, filters.status, filters.urgencia, filters.vinculo, filters.dateRange]);

  const { data: filteredPublications, total: totalFiltered, loading, error: listaError, refetch: refetchLista } = usePublicacoesLista({
    page,
    pageSize: PAGE_SIZE,
    status: filters.status,
    urgencia: filters.urgencia,
    vinculo: filters.vinculo,
    search: dSearch,
    dateFrom: filters.dateRange.from,
    dateTo: filters.dateRange.to,
  });
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));

  const activeFiltersCount = useMemo(() => {
    return [
      filters.search !== '',
      filters.status !== 'all',
      filters.urgencia !== 'all',
      filters.vinculo !== 'all',
      filters.dateRange.from !== undefined
    ].filter(Boolean).length;
  }, [filters]);

  const handleExportCSV = async () => {
    if (!user?.id) return;
    // Exporta TODAS as publicações que casam com o filtro ativo, não só a
    // página atual — com paginação, filteredPublications é só a página visível.
    let toExport;
    try {
      toExport = await fetchAllPublicacoesForExport(user, {
        status: filters.status,
        urgencia: filters.urgencia,
        vinculo: filters.vinculo,
        search: dSearch,
        dateFrom: filters.dateRange.from,
        dateTo: filters.dateRange.to,
      });
    } catch (e) {
      toast({ title: 'Erro ao exportar', description: getErrorMessage(e, 'Não foi possível buscar as publicações.'), variant: 'destructive' });
      return;
    }

    const rows = [
      ['Título', 'Processo', 'Tribunal', 'Comarca', 'Data', 'Status', 'Urgência'],
      ...toExport.map(p => [
        `"${(p.titulo || '').replace(/"/g, '""')}"`,
        p.numero_processo,
        p.tribunal || '',
        p.comarca || '',
        fmtDataBR(p.data_publicacao),
        p.status,
        p.urgencia,
      ]),
    ];
    const csv = rows.map(r => r.join(';')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `publicacoes_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Exportado', description: `${toExport.length} publicações exportadas.` });
  };

  // Handlers
  const handleToggleSelection = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleToggleAll = () => {
    if (selectedIds.length === filteredPublications.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredPublications.map(p => p.id));
    }
  };

  const handleBulkUpdateStatus = async (newStatus: string) => {
    if (!canManagePublicacoes) return;
    const count = selectedIds.length;
    toast({ title: "Processando...", description: `Atualizando ${count} publicações...` });

    const ok = await bulkUpdateStatus(selectedIds, newStatus);

    setSelectedIds([]);
    if (ok) {
      toast({ title: "Sucesso", description: `${count} publicações atualizadas.` });
    }
    // erro já mostra seu próprio toast (bulkUpdateStatus)
  };

  const handleManualSync = async (days: number) => {
    if (!canManagePublicacoes) return;
    // Sincroniza TODAS as OABs monitoradas do escritório (fallback: OAB do perfil, se ainda não houver lista).
    const alvos = monitoredOabs.length > 0
      ? monitoredOabs.map((m) => ({ oab: m.oab, uf: m.uf }))
      : (profile?.oab && profile?.oab_uf ? [{ oab: profile.oab, uf: profile.oab_uf }] : []);

    if (alvos.length === 0) {
      toast({
        title: "Nenhuma OAB monitorada",
        description: "Cadastre uma OAB em Configurações → OABs monitoradas para sincronizar.",
        variant: "destructive"
      });
      return;
    }

    setIsSyncing(true);
    toast({
      title: "Sincronizando...",
      description: `Buscando publicações de ${alvos.length} OAB(s), últimos ${days === 1 ? 'dia' : days + ' dias'}...`,
    });

    try {
      let total = 0;
      for (const a of alvos) {
        const results = await syncByOab(a.oab, a.uf, days);
        total += results.length;
      }
      if (total > 0) {
        toast({
          title: "Sincronização concluída",
          description: `${total} novas publicações importadas.`,
        });
        refresh();
      } else {
        toast({
          title: "Tudo atualizado",
          description: "Não foram encontradas novas publicações neste período.",
        });
      }
    } catch (error) {
      console.error('Manual Sync Failed:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="flex-1 p-4 md:p-8 space-y-8 md:space-y-12 overflow-x-hidden entry-animate bg-background">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-primary/10 border border-black/5 dark:border-primary/20 shadow-sm">
              <BookOpen className="h-6 w-6 md:h-8 md:w-8 text-primary" />
            </div>
            <h1 className="text-3xl md:text-5xl font-black tracking-tighter text-foreground">
              Publicações
            </h1>
            {registering && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-bold animate-pulse">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Buscando dados...
              </div>
            )}
          </div>
          <p className="text-sm md:text-lg text-muted-foreground font-medium max-w-2xl px-1">
            Gestão automatizada de intimações e andamentos processuais.
          </p>
        </div>
        
        <div className="flex items-center gap-2 glass-morphism p-1.5 rounded-2xl border-black/5 dark:border-border bg-black/[0.02] dark:bg-card/30">
          <Button 
            variant={view === 'grid' ? "secondary" : "ghost"} 
            size="sm" 
            className={cn("rounded-xl h-10 px-4 transition-all duration-500", view === 'grid' && "shadow-lg scale-105")}
            onClick={() => setView('grid')}
          >
            <LayoutGrid className="h-4 w-4 mr-2" />
            <span className="font-bold text-xs uppercase tracking-wider">Cartões</span>
          </Button>
          <Button 
            variant={view === 'table' ? "secondary" : "ghost"} 
            size="sm" 
            className={cn("rounded-xl h-10 px-4 transition-all duration-500", view === 'table' && "shadow-lg scale-105")}
            onClick={() => setView('table')}
          >
            <TableIcon className="h-4 w-4 mr-2" />
            <span className="font-bold text-xs uppercase tracking-wider">Tabela</span>
          </Button>
        </div>
      </div>

      {statsError ? (
        // Com erro, os cards mostrariam 0 como número real.
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <span>Não foi possível carregar os contadores das publicações.</span>
          <Button size="sm" variant="outline" onClick={refetchStats} className="rounded-xl">Tentar novamente</Button>
        </div>
      ) : (
        <PublicationSummary stats={stats} loading={statsLoading} onCardClick={handleCardClick} />
      )}

      <div className="space-y-6">
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-end px-4 mt-4">
             <h3 className="text-2xl font-black tracking-tight text-foreground">Lista de Publicações</h3>
             <Badge variant="secondary" className="rounded-lg h-7 font-black tracking-[0.1em] text-[10px] uppercase shadow-sm">
               {totalFiltered} Itens Encontrados
             </Badge>
          </div>
          
          <div className="space-y-6">
            <PublicationFilters 
              filters={filters}
              setFilters={setFilters}
              activeFiltersCount={activeFiltersCount}
              onClear={() => setFilters({
                search: '',
                status: 'all',
                urgencia: 'all',
                cnj: '',
                vinculo: 'all',
                dateRange: { from: undefined, to: undefined }
              })}
            />
            
            <Separator className="bg-black/5 dark:bg-border/30" />

            <PublicationsToolbar totalFiltered={totalFiltered} isSyncing={isSyncing} onExportCSV={handleExportCSV} onManualSync={handleManualSync} />
          </div>
        </div>

        <div className="relative">
          <BulkActionsBar count={selectedIds.length} onMarkRead={() => handleBulkUpdateStatus('lida')}
            onArchive={() => setConfirmBulkArchive(true)} onClear={() => setSelectedIds([])} />

          {listaError ? (
            <div className="py-24 text-center glass-card rounded-[3rem] bg-black/[0.02] dark:bg-card/30 space-y-6 border-black/5 dark:border-border shadow-inner">
              <div className="p-8 bg-destructive/10 rounded-full inline-block border border-black/5 dark:border-border shadow-sm">
                <AlertTriangle className="h-16 w-16 text-destructive/60" />
              </div>
              <div className="space-y-2">
                <p className="text-xl font-black uppercase tracking-widest text-muted-foreground/40">Não foi possível carregar</p>
                <p className="text-sm text-muted-foreground/60 font-medium">{listaError}</p>
              </div>
              <Button variant="outline" onClick={() => refetchLista()} className="rounded-xl font-bold">Tentar novamente</Button>
            </div>
          ) : loading && filteredPublications.length === 0 ? (
            // Antes o carregamento mostrava "Caixa de Entrada Vazia" até a lista chegar.
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <div key={i} className="h-16 rounded-2xl bg-muted/30 animate-pulse" />)}
            </div>
          ) : filteredPublications.length === 0 ? (
            <div className="py-24 text-center glass-card rounded-[3rem] bg-black/[0.02] dark:bg-card/30 space-y-6 border-black/5 dark:border-border shadow-inner">
              <div className="p-8 bg-black/[0.03] dark:bg-background/50 rounded-full inline-block border border-black/5 dark:border-border shadow-sm">
                <Inbox className="h-16 w-16 text-muted-foreground/20" />
              </div>
              <div className="space-y-2">
                <p className="text-xl font-black uppercase tracking-widest text-muted-foreground/40">Caixa de Entrada Vazia</p>
                <p className="text-sm text-muted-foreground/60 font-medium">Nenhum registro encontrado para os filtros aplicados.</p>
              </div>
            </div>
          ) : view === 'table' ? (
            <PublicationTable
              publications={filteredPublications}
              selectedIds={selectedIds}
              onToggleSelection={handleToggleSelection}
              onToggleAll={handleToggleAll}
              onViewDetails={(pub) => {
                setSelectedPub(pub);
                setDetailDialogOpen(true);
              }}
              onDelete={requestArchive}
              onUpdateStatus={updateStatus}
              onRegister={canCreateProcesses ? handleRegister : undefined}
              onSchedule={handleSchedule}
            />
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {filteredPublications.map((publication) => (
                <PublicationCard key={publication.id} publication={publication} selected={selectedIds.includes(publication.id)}
                  onOpen={(pub) => { setSelectedPub(pub); setDetailDialogOpen(true); }} onToggleSelection={handleToggleSelection}
                  onUpdateStatus={updateStatus} onRegister={canCreateProcesses ? handleRegister : undefined}
                  onSchedule={handleSchedule} onArchive={requestArchive} />
              ))}
            </div>
          )}

          <PublicationsPagination page={page} totalPages={totalPages} total={totalFiltered} loading={loading} onPage={setPage} />
        </div>
      </div>

      {selectedPub && (
        <PublicationDetailsDialog
          publication={selectedPub}
          open={detailDialogOpen}
          onOpenChange={setDetailDialogOpen}
          onDelete={requestArchive}
          onProcess={(id) => {
            const isTratada = selectedPub?.status === 'lida' || selectedPub?.status === 'processada';
            updateStatus(id, isTratada ? 'nova' : 'processada');
          }}
          onRegister={canCreateProcesses ? handleRegister : undefined}
          onSchedule={handleSchedule}
        />
      )}

      {/* Dialogs de Ação Vinculada */}
      <NovoProcessoDialog
        open={novoProcessoOpen}
        onOpenChange={setNovoProcessoOpen}
        initialData={initialProcessData}
        onSuccess={async () => {
          if (selectedPub?.id) {
            await updateStatus(selectedPub.id, 'processada');
            toast({
              title: 'Processo cadastrado',
              description: 'Processo e movimentações foram salvos. A publicação foi marcada como tratada.',
            });
          }
          setNovoProcessoOpen(false);
          refresh();
        }}
      />

      <AgendarPublicacaoDialog
        open={scheduleDialogOpen}
        onOpenChange={setScheduleDialogOpen}
        defaultTipo={scheduleTipo}
        publicacaoId={selectedPub?.id}
        numeroProcesso={selectedPub?.numero_processo}
        processoId={selectedPub?.processo_id ?? null}
        tituloSugerido={selectedPub ? `${selectedPub.titulo || selectedPub.numero_processo}` : ''}
        onSuccess={async () => {
          if (selectedPub?.id) {
            await updateStatus(selectedPub.id, 'processada');
            toast({ title: "Agendado", description: "Item salvo e publicação marcada como tratada." });
          }
          setScheduleDialogOpen(false);
          refresh();
        }}
      />

      {/* Confirmações de arquivar (item único e em lote) */}
      <ArchiveConfirmDialogs confirmArchiveId={confirmArchiveId} onCloseSingle={() => setConfirmArchiveId(null)} onConfirmSingle={confirmArchive}
        confirmBulkArchive={confirmBulkArchive} setConfirmBulkArchive={setConfirmBulkArchive} bulkCount={selectedIds.length}
        onConfirmBulk={() => { setConfirmBulkArchive(false); handleBulkUpdateStatus('arquivada'); }} />
    </div>
  );
}


