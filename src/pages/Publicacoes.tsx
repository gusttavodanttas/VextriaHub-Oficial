
import { useState, useMemo } from "react";
import { formatCNJ } from "@/utils/formatCNJ";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PublicationDetailsDialog } from "@/components/Publications/PublicationDetailsDialog";
import { ScheduleDialog } from "@/components/Publications/ScheduleDialog";
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
  Archive, 
  Eye,
  Download,
  Filter,
  Inbox,
  X,
  RefreshCw,
  Clock,
  CalendarDays,
  CalendarRange
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
  
  const handleCardClick = (type: 'prazos' | 'novas' | 'sem_vinculo' | 'hoje') => {
    if (type === 'hoje') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const to = new Date();
      to.setHours(23, 59, 59, 999);
      setFilters({ ...filters, dateRange: { from: today, to }, status: 'all' });
    } else if (type === 'novas') {
      setFilters({ ...filters, status: 'nova', dateRange: { from: undefined, to: undefined } });
    } else if (type === 'sem_vinculo') {
      setFilters({ ...filters, search: '', status: 'all', dateRange: { from: undefined, to: undefined } });
    }
  };

  const handleRegister = async (pub: any) => {
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
    } catch (e: any) {
      console.error('[handleRegister] erro ao buscar processo:', e);
      setInitialProcessData(fallbackData);
    } finally {
      setRegistering(false);
      setNovoProcessoOpen(true);
    }
  };

  const handleSchedule = (pub: any) => {
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
      }).length
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
      
      const matchesStatus = filters.status === 'all' || pub.status === filters.status;
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
    toast({
      title: "Processando...",
      description: `Atualizando ${selectedIds.length} publicações para "${newStatus}".`,
    });
    
    for (const id of selectedIds) {
      await updateStatus(id, newStatus as any);
    }
    
    setSelectedIds([]);
    toast({
      title: "Sucesso",
      description: `${selectedIds.length} publicações atualizadas com sucesso.`,
    });
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
                  <DropdownMenuItem className="rounded-xl py-3 cursor-pointer group flex items-center gap-3">
                    <div className="p-1.5 rounded-lg bg-emerald-500/10 group-hover:bg-emerald-500/20 transition-colors">
                      <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-xs uppercase tracking-tight">Excel (.xlsx)</span>
                      <span className="text-[10px] text-muted-foreground/60 italic">Relatório em planilha</span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="rounded-xl py-3 cursor-pointer group flex items-center gap-3">
                    <div className="p-1.5 rounded-lg bg-red-500/10 group-hover:bg-red-500/20 transition-colors">
                      <FileTextIcon className="h-4 w-4 text-red-500" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-xs uppercase tracking-tight">PDF (.pdf)</span>
                      <span className="text-[10px] text-muted-foreground/60 italic">Documento formatado</span>
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
              <Card className="glass-card border-primary/20 bg-primary/10 backdrop-blur-2xl px-6 py-4 rounded-[2rem] shadow-2xl flex items-center gap-6 border-2">
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
            />
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              {filteredPublications.map((publication) => (
                <div 
                  key={publication.id} 
                  className={cn(
                    "glass-card hover-lift p-8 rounded-[2.5rem] border border-black/5 dark:border-border bg-black/[0.02] dark:bg-card/40 shadow-premium group relative transition-all duration-300",
                    selectedIds.includes(publication.id) && "ring-2 ring-primary bg-primary/5"
                  )}
                >
                  {/* Checkbox Overlay for Card View */}
                    <div 
                      className="absolute top-6 left-6 z-10 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleSelection(publication.id);
                      }}
                    >
                      <Checkbox 
                        checked={selectedIds.includes(publication.id)}
                        className="h-6 w-6 rounded-lg border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary transition-all scale-110 shadow-lg"
                      />
                    </div>

                  <div className="flex flex-col lg:flex-row justify-between gap-8 pl-10">
                    <div className="flex-1 space-y-6">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <h4 className="text-2xl font-black group-hover:text-primary transition-colors duration-500 leading-tight tracking-tight text-foreground">
                            {publication.titulo === publication.numero_processo ? `Publicação no ${publication.tribunal || 'Tribunal'}` : publication.titulo}
                          </h4>
                          <div className="flex flex-wrap items-center gap-3">
                            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-black px-3 py-1 rounded-lg text-xs font-mono uppercase">
                              {formatCNJ(publication.numero_processo)}
                            </Badge>
                            <span className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider opacity-60">
                              {new Date(publication.data_publicacao).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                        </div>
                        <Badge className={cn(
                          "px-4 py-1.5 rounded-full font-black text-[10px] uppercase tracking-[0.2em] shadow-lg",
                          publication.status === 'lida' || publication.status === 'processada' ? "bg-emerald-500 text-white" : 
                          publication.status === 'pendente' ? "bg-sky-500 text-white" :
                          "bg-primary text-white"
                        )}>
                          {
                            publication.status === 'lida' || publication.status === 'processada' ? 'Tratada' : 
                            publication.status === 'pendente' ? 'Pendente' : 'Nova'
                          }
                        </Badge>
                      </div>

                      <div className="p-8 bg-black/[0.03] dark:bg-background/50 rounded-[2rem] border border-black/5 dark:border-border text-foreground/80 font-medium line-clamp-4 leading-relaxed text-sm shadow-inner">
                        {publication.conteudo}
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        {publication.tags?.map((tag) => (
                          <Badge key={tag} className="bg-background text-muted-foreground/60 border-border px-4 py-1.5 rounded-xl font-black text-[9px] uppercase tracking-[0.15em] hover:bg-primary/10 hover:text-primary transition-all cursor-default shadow-sm">
                            #{tag}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="lg:w-48 flex flex-col gap-3 justify-center">
                      <PublicationDetailsDialog 
                        publication={publication} 
                        onRegister={handleRegister}
                        onSchedule={handleSchedule}
                        onProcess={(id) => updateStatus(id, 'processada')}
                        onDelete={deletePublication}
                      />
                      <div className="h-px bg-border my-2" />
                      <div className="grid grid-cols-3 gap-2">
                        <ScheduleDialog 
                          publicationTitle={publication.titulo}
                          processNumber={publication.numero_processo}
                          type="prazo"
                          iconOnly={true}
                        />
                        <ScheduleDialog 
                          publicationTitle={publication.titulo}
                          processNumber={publication.numero_processo}
                          type="audiencia"
                          iconOnly={true}
                        />
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" className="h-12 w-full rounded-2xl hover:bg-red-500/10 hover:text-red-500 group/del transition-all duration-300">
                              <Trash2 className="h-5 w-5 text-red-500/50 group-hover/del:text-red-500" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="rounded-[2.5rem] border-black/5 dark:border-border bg-card/80 backdrop-blur-2xl p-10 shadow-2xl">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-3xl font-black tracking-tighter">Eliminar Expediente</AlertDialogTitle>
                              <AlertDialogDescription className="text-base font-medium text-muted-foreground">
                                Esta publicação será removida permanentemente do sistema. Prosseguir com a exclusão definitiva?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="mt-10 gap-4">
                              <AlertDialogCancel className="rounded-2xl border-border h-14 px-8 font-black uppercase text-xs tracking-widest bg-background">Cancelar</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => deletePublication(publication.id)}
                                className="bg-red-500 hover:bg-red-600 text-white rounded-2xl h-14 px-10 font-black uppercase text-xs tracking-widest shadow-lg shadow-red-500/20"
                              >
                                Confirmar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                      <div className="flex items-center gap-4 pt-4 border-t border-border/20">
                        <PublicationDetailsDialog 
                          publication={publication}
                          onRegister={handleRegister}
                          onSchedule={handleSchedule}
                          onProcess={(id) => updateStatus(id, 'processada')}
                          onDelete={deletePublication}
                          trigger={
                            <Button variant="outline" size="sm" className="rounded-xl border-border hover:bg-card px-4 md:px-6 h-10 font-bold text-[10px] md:text-xs uppercase tracking-wider gap-2">
                              <Eye className="h-4 w-4" />
                              Ver Conteúdo
                            </Button>
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
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
          onProcess={(id) => updateStatus(id, 'processada')}
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
        onSuccess={async () => {
          if (selectedPub?.id) {
            await updateStatus(selectedPub.id, 'processada');
            toast({
              title: "Prazo Agendado",
              description: "O prazo foi criado e a publicação marcada como tratada."
            });
          }
          setScheduleDialogOpen(false);
          refresh();
        }}
      />
    </div>
  );
}


