
import { useState, useMemo } from "react";
import { formatCNJ } from "@/utils/formatCNJ";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PublicationDetailsDialog } from "@/components/Publications/PublicationDetailsDialog";
import { PublicationSummary } from "@/components/Publications/PublicationSummary";
import { PublicationTable } from "@/components/Publications/PublicationTable";
import { PublicationFilters } from "@/components/Publications/PublicationFilters";
import {
  BookOpen,
  Trash2,
  Search,
  LayoutGrid,
  Table as TableIcon,
  CheckSquare,
  Download,
  Inbox,
  X,
  RefreshCw,
  Clock,
  CalendarDays,
  CalendarRange,
  CheckCircle,
  PlusCircle,
  Link2,
  Link2Off,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { ChevronDown, FileSpreadsheet, FileText as FileTextIcon } from "lucide-react";

import { usePublicacoes } from "@/hooks/usePublicacoes";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";

import { NovoProcessoDialog } from "@/components/Processos/NovoProcessoDialog";
import { NovoPrazoStandaloneDialog } from "@/components/Processos/NovoPrazoStandaloneDialog";
import { supabase } from "@/integrations/supabase/client";

export default function Publicacoes() {
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const { publications, loading, deletePublication, updateStatus, syncByOab, refresh } = usePublicacoes();
  const [view, setView] = useState<'grid' | 'table'>('table');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedPub, setSelectedPub] = useState<any>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [novoProcessoOpen, setNovoProcessoOpen] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [initialProcessData, setInitialProcessData] = useState<any>(null);
  const [registering, setRegistering] = useState(false);
  
  const handleCardClick = (type: 'prazos' | 'novas' | 'sem_vinculo' | 'hoje' | 'tratadas') => {
    if (type === 'hoje') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const to = new Date();
      to.setHours(23, 59, 59, 999);
      setFilters({ ...filters, dateRange: { from: today, to }, status: 'all' });
    } else if (type === 'novas') {
      setFilters({ ...filters, status: 'nova', dateRange: { from: undefined, to: undefined } });
    } else if (type === 'tratadas') {
      setFilters({ ...filters, status: 'lida', dateRange: { from: undefined, to: undefined } });
    } else if (type === 'prazos') {
      setFilters({ ...filters, urgencia: 'alta', dateRange: { from: undefined, to: undefined } });
    } else if (type === 'sem_vinculo') {
      setFilters({ ...filters, search: '', status: 'all', dateRange: { from: undefined, to: undefined } });
    }
  };

  const handleRegister = async (pub: Record<string, any>) => {
    setSelectedPub(pub);
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
      descricao: `Cadastrado a partir da publicação em ${pub.data_publicacao ? new Date(pub.data_publicacao).toLocaleDateString('pt-BR') : 'data não identificada'}.`,
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

  const handleSchedule = (pub: Record<string, any>) => {
    setSelectedPub(pub);
    setScheduleDialogOpen(true);
  };
  
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    urgencia: 'all',
    cnj: '',
    dateRange: { from: undefined as Date | undefined, to: undefined as Date | undefined }
  });

  // Cálculo de Estatísticas
  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const tratadas = publications.filter(p => p.status === 'lida' || p.status === 'processada').length;
    return {
      prazosSemana: publications.filter(p => p.urgencia === 'alta').length,
      naoTratadas: publications.filter(p => p.status === 'nova' || p.status === 'pendente').length,
      semVinculo: publications.filter(p => !p.processo_id).length,
      novosAndamentos: publications.filter(p => {
        try {
          if (!p.data_publicacao) return false;
          const dStr = new Date(p.data_publicacao).toISOString().split('T')[0];
          return dStr === todayStr;
        } catch (e) {
          return false;
        }
      }).length,
      tratadas,
      total: publications.length,
    };
  }, [publications]);

  // Filtragem
  const filteredPublications = useMemo(() => {
    // 1. De-duplicação por CNJ + Conteúdo (primeiros 50 chars) + Data
    const uniqueMap = new Map();
    publications.forEach(pub => {
      const key = `${pub.numero_processo}-${pub.data_publicacao}-${(pub.conteudo || '').substring(0, 50)}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, pub);
      }
    });
    
    const uniquePublicacoes = Array.from(uniqueMap.values());

    // 2. Filtros
    return uniquePublicacoes.filter(pub => {
      const searchTerm = filters.search.toLowerCase();
      const matchesSearch = (pub.titulo || '').toLowerCase().includes(searchTerm) ||
                           (pub.numero_processo || '').includes(filters.search) ||
                           (pub.conteudo || '').toLowerCase().includes(searchTerm);
      
      // 'all' exclui arquivadas — arquivadas só aparecem quando filtro = 'arquivada'
      const matchesStatus = filters.status === 'all'
        ? pub.status !== 'arquivada'
        : pub.status === filters.status;
      const matchesUrgencia = filters.urgencia === 'all' || pub.urgencia === filters.urgencia;
      
      let matchesDate = true;
      if (filters.dateRange.from) {
        try {
          if (!pub.data_publicacao) {
            matchesDate = false;
          } else {
            const pubDateStr = new Date(pub.data_publicacao).toISOString().split('T')[0];
            const fromDateStr = filters.dateRange.from.toISOString().split('T')[0];
            
            if (filters.dateRange.to) {
              const toDateStr = filters.dateRange.to.toISOString().split('T')[0];
              matchesDate = pubDateStr >= fromDateStr && pubDateStr <= toDateStr;
            } else {
              matchesDate = pubDateStr >= fromDateStr;
            }
          }
        } catch (e) {
          matchesDate = true;
        }
      }
      
      return matchesSearch && matchesStatus && matchesUrgencia && matchesDate;
    });
  }, [publications, filters]);

  const activeFiltersCount = useMemo(() => {
    return [
      filters.search !== '',
      filters.status !== 'all',
      filters.urgencia !== 'all',
      filters.dateRange.from !== undefined
    ].filter(Boolean).length;
  }, [filters]);

  const handleExportCSV = () => {
    const rows = [
      ['Título', 'Processo', 'Tribunal', 'Comarca', 'Data', 'Status', 'Urgência'],
      ...filteredPublications.map(p => [
        `"${(p.titulo || '').replace(/"/g, '""')}"`,
        p.numero_processo,
        p.tribunal || '',
        p.comarca || '',
        p.data_publicacao ? new Date(p.data_publicacao).toLocaleDateString('pt-BR') : '',
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
    toast({ title: 'Exportado', description: `${filteredPublications.length} publicações exportadas.` });
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
    const count = selectedIds.length;
    toast({ title: "Processando...", description: `Atualizando ${count} publicações...` });

    let erros = 0;
    for (const id of selectedIds) {
      const ok = await updateStatus(id, newStatus as string);
      if (!ok) erros++;
    }

    setSelectedIds([]);
    if (erros > 0) {
      toast({ title: "Parcialmente concluído", description: `${count - erros} atualizadas, ${erros} falharam.`, variant: "destructive" });
    } else {
      toast({ title: "Sucesso", description: `${count} publicações atualizadas.` });
    }
  };

  const handleManualSync = async (days: number) => {
    if (!profile?.oab || !profile?.oab_uf) {
      toast({
        title: "OAB não configurada",
        description: "Por favor, cadastre sua OAB no perfil para sincronizar.",
        variant: "destructive"
      });
      return;
    }

    setIsSyncing(true);
    toast({
      title: "Sincronizando...",
      description: `Buscando publicações dos últimos ${days === 1 ? 'dia' : days + ' dias'}...`,
    });

    try {
      const results = await syncByOab(profile.oab, profile.oab_uf, days);
      if (results.length > 0) {
        toast({
          title: "Sincronização concluída",
          description: `${results.length} novas publicações importadas.`,
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

      <PublicationSummary stats={stats} loading={loading} onCardClick={handleCardClick} />

      <div className="space-y-6">
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-end px-4 mt-4">
             <h3 className="text-2xl font-black tracking-tight text-foreground">Lista de Publicações</h3>
             <Badge variant="secondary" className="rounded-lg h-7 font-black tracking-[0.1em] text-[10px] uppercase shadow-sm">
               {filteredPublications.length} Itens Encontrados
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
                dateRange: { from: undefined, to: undefined }
              })}
            />
            
            <Separator className="bg-black/5 dark:bg-border/30" />

            <div className="flex items-center justify-end gap-4 px-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-12 px-6 rounded-2xl border-border bg-card/50 hover:bg-card font-black text-xs uppercase tracking-widest text-primary gap-2 transition-all duration-300 shadow-md">
                    <Download className="h-4 w-4" />
                    Exportar
                    <ChevronDown className="h-3 w-3 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 p-2 rounded-2xl bg-card border-black/5 dark:border-border shadow-2xl">
                  <DropdownMenuItem onClick={() => handleExportCSV()} className="rounded-xl py-3 cursor-pointer group flex items-center gap-3">
                    <div className="p-1.5 rounded-lg bg-emerald-500/10 group-hover:bg-emerald-500/20 transition-colors">
                      <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-xs uppercase tracking-tight">CSV / Excel</span>
                      <span className="text-[10px] text-muted-foreground/60 italic">{filteredPublications.length} publicações</span>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    disabled={isSyncing}
                    className="h-12 rounded-2xl px-6 font-black text-xs uppercase tracking-widest bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all duration-300 gap-2"
                  >
                    {isSyncing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Sincronizar
                    <ChevronDown className="h-3 w-3 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 p-2 rounded-2xl bg-card border-black/5 dark:border-border shadow-2xl">
                  <DropdownMenuLabel className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Período de Busca</DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-border/50" />
                  <DropdownMenuItem onClick={() => handleManualSync(1)} className="rounded-xl py-3 cursor-pointer group flex items-center gap-3">
                    <div className="p-1.5 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                      <Clock className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-xs uppercase tracking-tight">Diário</span>
                      <span className="text-[10px] text-muted-foreground/60">Últimas 24 horas</span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleManualSync(7)} className="rounded-xl py-3 cursor-pointer group flex items-center gap-3">
                    <div className="p-1.5 rounded-lg bg-indigo-500/10 group-hover:bg-indigo-500/20 transition-colors">
                      <CalendarDays className="h-4 w-4 text-indigo-500" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-xs uppercase tracking-tight">Semanal</span>
                      <span className="text-[10px] text-muted-foreground/60">Últimos 7 dias</span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleManualSync(30)} className="rounded-xl py-3 cursor-pointer group flex items-center gap-3">
                    <div className="p-1.5 rounded-lg bg-violet-500/10 group-hover:bg-violet-500/20 transition-colors">
                      <CalendarRange className="h-4 w-4 text-violet-500" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-xs uppercase tracking-tight">Mensal</span>
                      <span className="text-[10px] text-muted-foreground/60">Últimos 30 dias</span>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        <div className="relative">
          {/* Bulk Actions Bar */}
          {selectedIds.length > 0 && (
            <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-10 fade-in duration-500">
              <Card className="glass-card border-primary/20 bg-primary/10 px-6 py-4 rounded-[2rem] shadow-2xl flex items-center gap-6 border-2">
                <div className="flex items-center gap-3 pr-6 border-r border-border text-primary">
                  <CheckSquare className="h-5 w-5" />
                  <span className="text-sm font-black uppercase tracking-widest">{selectedIds.length} Selecionados</span>
                </div>
                <div className="flex items-center gap-3">
                  <Button 
                    size="sm" 
                    onClick={() => handleBulkUpdateStatus('lida')}
                    className="rounded-xl font-black text-[10px] uppercase tracking-widest h-10 px-6"
                  >
                    Marcar como Lida
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleBulkUpdateStatus('arquivada')}
                    className="rounded-xl border-border hover:bg-card font-black text-[10px] uppercase tracking-widest h-10 px-6"
                  >
                    Arquivar
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="rounded-xl h-10 w-10 p-0 text-red-500 hover:bg-red-500/10"
                    onClick={() => setSelectedIds([])}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </Card>
            </div>
          )}

          {filteredPublications.length === 0 ? (
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
              onDelete={deletePublication}
              onUpdateStatus={updateStatus}
              onRegister={handleRegister}
              onSchedule={handleSchedule}
            />
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {filteredPublications.map((publication) => {
                const isTratada = publication.status === 'lida' || publication.status === 'processada';
                return (
                  <div
                    key={publication.id}
                    className={cn(
                      "bg-card border border-border p-6 rounded-[2rem] hover:shadow-lg transition-all duration-300 hover:border-primary/25 hover:-translate-y-0.5 group relative shadow-sm cursor-pointer",
                      selectedIds.includes(publication.id) && "ring-2 ring-primary bg-primary/5"
                    )}
                    onClick={() => { setSelectedPub(publication); setDetailDialogOpen(true); }}
                  >
                    {/* Checkbox */}
                    <div
                      className="absolute top-5 left-5 z-10 cursor-pointer"
                      onClick={(e) => { e.stopPropagation(); handleToggleSelection(publication.id); }}
                    >
                      <Checkbox
                        checked={selectedIds.includes(publication.id)}
                        className="h-5 w-5 rounded-lg border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary shadow-md"
                      />
                    </div>

                    <div className="pl-8 space-y-4">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <h4 className="font-black text-base group-hover:text-primary transition-colors leading-tight tracking-tight truncate">
                            {publication.titulo === publication.numero_processo ? `Publicação no ${publication.tribunal || 'Tribunal'}` : publication.titulo}
                          </h4>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-black px-2 py-0.5 rounded-lg text-[10px] font-mono uppercase">
                              {formatCNJ(publication.numero_processo)}
                            </Badge>
                            {publication.tribunal && (
                              <span className="text-[10px] text-muted-foreground/60 font-bold uppercase">{publication.tribunal}</span>
                            )}
                            <span className="text-[10px] text-muted-foreground/50 font-bold">
                              {new Date(publication.data_publicacao).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <Badge className={cn(
                            "px-3 py-1 rounded-full font-black text-[9px] uppercase tracking-widest",
                            isTratada ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" :
                            publication.status === 'pendente' ? "bg-sky-500/10 text-sky-600 border border-sky-500/20" :
                            "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                          )}>
                            {isTratada ? 'Tratada' : publication.status === 'pendente' ? 'Pendente' : 'Nova'}
                          </Badge>
                          {publication.urgencia === 'alta' && (
                            <Badge variant="outline" className="px-2 py-0.5 text-[9px] font-black uppercase tracking-widest bg-red-500/10 text-red-600 border-red-500/20">
                              Urgente
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Content preview */}
                      <div className="p-4 bg-muted/20 rounded-2xl border border-border text-foreground/70 font-medium line-clamp-3 leading-relaxed text-sm">
                        {publication.conteudo || '—'}
                      </div>

                      {/* Footer actions */}
                      <div className="flex items-center justify-between pt-1" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5">
                          {publication.processo_id ? (
                            <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-600 border-emerald-500/20 gap-1 px-2 py-0.5">
                              <Link2 className="h-3 w-3" /> Vinculada
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest bg-orange-500/10 text-orange-500 border-orange-500/20 gap-1 px-2 py-0.5">
                              <Link2Off className="h-3 w-3" /> Avulsa
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {!isTratada && (
                            <Button size="sm" variant="ghost" className="h-8 rounded-xl text-[10px] font-bold gap-1 text-emerald-600 hover:bg-emerald-500/10"
                              onClick={() => updateStatus(publication.id, 'lida')}>
                              <CheckCircle className="h-3.5 w-3.5" /> Tratar
                            </Button>
                          )}
                          {!publication.processo_id && (
                            <Button size="sm" variant="ghost" className="h-8 rounded-xl text-[10px] font-bold gap-1 text-violet-600 hover:bg-violet-500/10"
                              onClick={() => handleRegister(publication)}>
                              <PlusCircle className="h-3.5 w-3.5" /> Processo
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-8 rounded-xl text-[10px] font-bold gap-1 text-amber-600 hover:bg-amber-500/10"
                            onClick={() => handleSchedule(publication)}>
                            <CalendarDays className="h-3.5 w-3.5" /> Prazo
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-xl text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                            onClick={() => deletePublication(publication.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {selectedPub && (
        <PublicationDetailsDialog
          publication={selectedPub}
          open={detailDialogOpen}
          onOpenChange={setDetailDialogOpen}
          onDelete={deletePublication}
          onProcess={(id) => {
            const pub = publications.find(p => p.id === id);
            const isTratada = pub?.status === 'lida' || pub?.status === 'processada';
            updateStatus(id, isTratada ? 'nova' : 'processada');
          }}
          onRegister={handleRegister}
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

      <NovoPrazoStandaloneDialog
        open={scheduleDialogOpen}
        onOpenChange={setScheduleDialogOpen}
        publicacaoId={selectedPub?.id}
        numeroProcesso={selectedPub?.numero_processo}
        tituloSugerido={selectedPub ? `Prazo — ${selectedPub.titulo || selectedPub.numero_processo}` : ''}
        onSuccess={async () => {
          if (selectedPub?.id) {
            await updateStatus(selectedPub.id, 'processada');
            toast({ title: "Prazo Agendado", description: "Prazo salvo e publicação marcada como tratada." });
          }
          setScheduleDialogOpen(false);
          refresh();
        }}
      />
    </div>
  );
}


