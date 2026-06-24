import React, { useState, useEffect, useCallback } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Processo } from '@/types/processo';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  User,
  Calendar,
  Scale,
  DollarSign,
  Clock,
  History,
  Info,
  Gavel,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Building2,
  Users,
  RotateCw,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { formatCNJ } from '@/utils/formatCNJ';
import { useProcessosV2 } from '@/hooks/useProcessosV2';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface Movimentacao {
  id: string;
  data: string;
  texto: string;
  tipo?: string | null;
  fonte?: string;
  metadata?: Record<string, any>;
}

interface ProcessoDetailsDrawerProps {
  processo: Processo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ProcessoDetailsDrawer: React.FC<ProcessoDetailsDrawerProps> = ({
  processo,
  open,
  onOpenChange
}) => {
  if (!processo) return null;

  const { user, profile } = useAuth();
  const { persistAndamentos } = useProcessosV2();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [movements, setMovements] = useState<Movimentacao[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedProcessoId, setLastSyncedProcessoId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("resumo");

  const fetchMovements = useCallback(async () => {
    if (!processo?.id) return;
    setLoadingMovements(true);
    try {
      const { data, error } = await supabase
        .from('movimentacoes_processo')
        .select('id, data:data_movimentacao, texto:descricao, tipo, metadata')
        .eq('processo_id', processo.id)
        .order('data_movimentacao', { ascending: false });

      if (!error && data) {
        setMovements(data as any);
      }
    } catch (err) {
      console.error('Erro ao buscar movimentações:', err);
    } finally {
      setLoadingMovements(false);
    }
  }, [processo?.id]);

  // Sincroniza com a fonte oficial (DataJud) e persiste novos andamentos.
  // Atualiza tambem processos.sincronizado_em e data_ultima_atualizacao.
  const syncFromOrigin = useCallback(async () => {
    if (!processo?.id || !processo.numeroProcesso || syncing) return;
    setSyncing(true);
    try {
      console.log('🔄 [drawer] sincronizando processo via fetch-processo:', processo.numeroProcesso);
      const { data, error } = await supabase.functions.invoke('fetch-processo', {
        body: {
          numeroProcesso: processo.numeroProcesso,
          oab: (profile as any)?.oab,
          uf: (profile as any)?.oab_uf,
        },
      });

      if (error || !data || data.error) {
        console.warn('🔄 [drawer] sync falhou:', error?.message || data?.error);
        return;
      }

      const andamentos = Array.isArray(data.andamentos) ? data.andamentos : [];
      if (andamentos.length === 0) {
        console.log('🔄 [drawer] nenhum andamento retornado pela fonte');
      } else {
        const inseridos = await persistAndamentos(processo.id, user?.office_id, andamentos, 'datajud');
        console.log(`🔄 [drawer] ${inseridos} novos andamentos persistidos`);

        if (inseridos > 0) {
          toast({
            title: 'Histórico atualizado',
            description: `${inseridos} nova(s) movimentação(ões) sincronizada(s) com o tribunal.`,
          });
        }

        // Atualiza meta-dados de sync e dados do processo
        const ultimo = data.ultimoAndamento?.data || andamentos[0]?.data;
        const updatePayload: any = {
          sincronizado_em: new Date().toISOString(),
          data_ultima_atualizacao: ultimo ? String(ultimo).split('T')[0] : new Date().toISOString().split('T')[0],
        };

        if (data.titulo && data.titulo !== 'Processo' && (!processo.titulo || processo.titulo.includes('(Auto)'))) {
          updatePayload.titulo = data.titulo;
        }
        if (data.autor && data.autor !== 'Não identificado' && !processo.parteAutora) {
          updatePayload.parte_autora = data.autor;
        }
        if (data.reu && data.reu !== 'Não identificado' && !processo.requerido) {
          updatePayload.requerido = data.reu;
        }
        if (data.classe && !processo.classeJudicial) {
          updatePayload.classe_judicial = data.classe;
        }
        if (data.assunto && !processo.assuntoPrincipal) {
          updatePayload.assunto_principal = data.assunto;
        }
        if (data.faseProcessual && !processo.faseProcessual) {
          updatePayload.fase_processual = data.faseProcessual;
        }
        if (data.instancia && !processo.instancia) {
          updatePayload.instancia = data.instancia;
        }
        if (data.valorCausa && !processo.valorCausa) {
          updatePayload.valor_causa = data.valorCausa;
        }
        if (data.vara && !processo.vara) {
          updatePayload.vara = data.vara;
        }
        if (data.comarca && !processo.comarca) {
          updatePayload.comarca = data.comarca;
        }

        await supabase
          .from('processos')
          .update(updatePayload)
          .eq('id', processo.id);

        // Invalida o cache do react-query para atualizar a listagem e os campos na tela
        queryClient.invalidateQueries({ queryKey: ['processos'] });
      }

      // Re-busca movimentos pra refletir os novos
      await fetchMovements();
    } catch (err: any) {
      console.error('🔄 [drawer] erro no sync:', err);
    } finally {
      setSyncing(false);
    }
  }, [processo?.id, processo?.numeroProcesso, syncing, user?.office_id, profile, persistAndamentos, toast, fetchMovements, queryClient]);

  // Carrega movimentações ao abrir o drawer
  useEffect(() => {
    if (!processo?.id || !open) return;
    fetchMovements();
  }, [processo?.id, open, fetchMovements]);

  // Ao abrir a tab Histórico, dispara sync com a fonte (1x por abertura do drawer)
  useEffect(() => {
    if (!open || activeTab !== 'timeline' || !processo?.id) return;
    if (lastSyncedProcessoId === processo.id) return; // já sincronizou nesta abertura
    setLastSyncedProcessoId(processo.id);
    syncFromOrigin();
  }, [open, activeTab, processo?.id, lastSyncedProcessoId, syncFromOrigin]);

  // Reset do flag de sync quando trocar de processo ou fechar
  useEffect(() => {
    if (!open) setLastSyncedProcessoId(null);
  }, [open]);

  const getStatusStyle = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s.includes('andamento') || s === 'ativo') 
      return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
    if (s.includes('concluído') || s.includes('encerrado')) 
      return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
    if (s.includes('suspenso')) 
      return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
    return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20';
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="p-0 border-l border-border bg-background w-full sm:max-w-2xl overflow-hidden flex flex-col shadow-2xl">
        {/* Header Consolidado */}
        <div className="p-8 pb-4 space-y-6 relative overflow-hidden">
          {/* Background Decor */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[100px] -mr-32 -mt-32 rounded-full pointer-events-none" />
          
          <div className="flex items-start justify-between relative">
            <div className="space-y-4 flex-1">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className={cn("px-3 py-1 text-[10px] font-black uppercase tracking-widest border-2", getStatusStyle(processo.status))}>
                   {processo.status}
                </Badge>
                <div className="flex items-center gap-1.5 text-foreground/30 dark:text-white/30 text-[10px] uppercase font-black tracking-widest leading-none">
                  <Clock className="h-3 w-3" />
                  Desde {processo.dataInicio ? new Date(processo.dataInicio).toLocaleDateString() : '—'}
                </div>
              </div>
              
              <div className="space-y-1">
                <SheetTitle className="text-2xl md:text-3xl font-black text-foreground dark:text-white leading-tight tracking-tight">
                  {processo.titulo}
                </SheetTitle>
                <div className="flex items-center gap-2 group">
                   <div className="w-2 h-2 rounded-full bg-primary/40 group-hover:bg-primary transition-colors animate-pulse" />
                   <span className="font-mono text-sm font-bold text-primary tracking-tight">
                     {formatCNJ(processo.numeroProcesso)}
                   </span>
                </div>
              </div>
            </div>
          </div>

          {/* Tab Selection Navigation */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="bg-black/5 dark:bg-white/5 p-1 h-12 rounded-2xl w-full justify-between">
              <TabsTrigger value="resumo" className="flex-1 rounded-xl data-[state=active]:bg-background dark:data-[state=active]:bg-[#1A1A1B] data-[state=active]:text-primary font-bold text-xs">
                <Info className="h-3.5 w-3.5 mr-2" /> RESUMO
              </TabsTrigger>
              <TabsTrigger value="timeline" className="flex-1 rounded-xl data-[state=active]:bg-background dark:data-[state=active]:bg-[#1A1A1B] data-[state=active]:text-primary font-bold text-xs">
                <History className="h-3.5 w-3.5 mr-2" /> HISTÓRICO
              </TabsTrigger>
              <TabsTrigger value="partes" className="flex-1 rounded-xl data-[state=active]:bg-background dark:data-[state=active]:bg-[#1A1A1B] data-[state=active]:text-primary font-bold text-xs">
                <Users className="h-3.5 w-3.5 mr-2" /> PARTES
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-8 pt-2">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              
              {/* ABA: RESUMO */}
              <TabsContent value="resumo" className="space-y-8 animate-in fade-in duration-300">
                {/* Métricas Principais */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-5 rounded-[2rem] bg-emerald-500/5 border border-emerald-500/10 space-y-2">
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                      <DollarSign className="h-4 w-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Valor da Causa</span>
                    </div>
                    <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 tracking-tighter">
                      {processo.valorCausa ? 
                        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(processo.valorCausa) 
                        : 'R$ 0,00'}
                    </p>
                  </div>
                  <div className="p-5 rounded-[2rem] bg-blue-500/5 border border-blue-500/10 space-y-2">
                    <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                      <Scale className="h-4 w-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Área Jurídica</span>
                    </div>
                    <p className="text-lg font-black text-blue-600 dark:text-blue-400 uppercase leading-none">
                      {processo.tipoProcesso || 'Cível'}
                    </p>
                  </div>
                </div>

                {/* Capa Jurídica Detalhada */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-[.2em]">
                    <Gavel className="h-4 w-4" />
                    <span>Capa Jurídica</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 rounded-[2rem] border border-border bg-muted/30">
                    <div className="space-y-1">
                      <p className="text-[10px] text-foreground/30 dark:text-white/30 uppercase font-black tracking-widest">Classe</p>
                      <p className="text-sm font-bold text-foreground/80 dark:text-white/80">{processo.classeJudicial || processo.tipoProcesso || '—'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-foreground/30 dark:text-white/30 uppercase font-black tracking-widest">Assunto Principal</p>
                      <p className="text-sm font-bold text-foreground/80 dark:text-white/80">{processo.assuntoPrincipal || '—'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-foreground/30 dark:text-white/30 uppercase font-black tracking-widest">Fase Atual</p>
                      <p className="text-sm font-bold text-foreground/80 dark:text-white/80">{processo.faseProcessual || '—'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-foreground/30 dark:text-white/30 uppercase font-black tracking-widest">Instância</p>
                      <p className="text-sm font-bold text-foreground/80 dark:text-white/80">{processo.instancia || '—'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-foreground/30 dark:text-white/30 uppercase font-black tracking-widest">Tribunal</p>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5 text-primary/60" />
                        <p className="text-sm font-bold text-foreground/80 dark:text-white/80">{processo.tribunal || '—'}</p>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-foreground/30 dark:text-white/30 uppercase font-black tracking-widest">Vara</p>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-primary/60" />
                        <p className="text-sm font-bold text-foreground/80 dark:text-white/80">{processo.vara || '—'}</p>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-foreground/30 dark:text-white/30 uppercase font-black tracking-widest">Comarca / UF</p>
                      <p className="text-sm font-bold text-foreground/80 dark:text-white/80 pl-5.5">{processo.comarca || '—'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-foreground/30 dark:text-white/30 uppercase font-black tracking-widest">Sigilo / Justiça Grat.</p>
                      <div className="flex gap-2 pl-3">
                         {processo.segredoJustica && <Badge variant="secondary" className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 text-[9px]">Segredo</Badge>}
                         {processo.justicaGratuita && <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 text-[9px]">Gratuita</Badge>}
                         {!processo.segredoJustica && !processo.justicaGratuita && <span className="text-xs text-foreground/20 dark:text-white/20">Não consta</span>}
                      </div>
                    </div>
                  </div>
                </div>

              </TabsContent>

              {/* ABA: TIMELINE */}
              <TabsContent value="timeline" className="space-y-6 animate-in fade-in duration-300">
                 <div className="flex items-center justify-between -mt-2 mb-2">
                   <p className="text-[10px] text-foreground/30 dark:text-white/30 uppercase font-black tracking-widest">
                     {syncing ? 'Sincronizando com o tribunal…' : `${movements.length} movimentação(ões)`}
                   </p>
                   <button
                     onClick={() => syncFromOrigin()}
                     disabled={syncing}
                     className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-black text-primary/70 hover:text-primary disabled:opacity-30 transition-colors"
                   >
                     <RotateCw className={cn("h-3 w-3", syncing && "animate-spin")} />
                     {syncing ? 'Atualizando' : 'Atualizar agora'}
                   </button>
                 </div>
                 {loadingMovements && movements.length === 0 ? (
                    <div className="py-20 flex flex-col items-center justify-center space-y-4 opacity-40">
                       <Clock className="h-10 w-10 animate-pulse text-primary" />
                       <p className="text-[10px] font-black uppercase tracking-widest">Consultando cronologia...</p>
                    </div>
                 ) : movements.length > 0 ? (
                    <div className="relative pl-6 space-y-10 border-l border-border ml-2 pt-4 pb-20">
                       {movements.map((mov) => (
                         <div key={mov.id} className="relative">
                            <div className="absolute -left-[31px] top-0 h-4 w-4 rounded-full bg-background border-2 border-primary/40 ring-4 ring-primary/5" />
                            <div className="space-y-2">
                               <div className="flex items-center justify-between">
                                 <span className="text-[10px] font-black text-primary/80 bg-primary/5 px-2 py-0.5 rounded-md">
                                   {new Date(mov.data).toLocaleDateString('pt-BR')}
                                 </span>
                                 <Badge variant="outline" className="text-[9px] uppercase tracking-tighter opacity-50">
                                   {mov.tipo || mov.metadata?.fase || 'Andamento'}
                                 </Badge>
                               </div>
                               <h4 className="font-bold text-foreground/90 dark:text-white/90 leading-tight whitespace-pre-wrap">
                                 {mov.texto}
                               </h4>
                            </div>
                         </div>
                       ))}
                    </div>
                 ) : (
                    <div className="py-32 flex flex-col items-center justify-center text-center space-y-6 opacity-30">
                       <History className="h-16 w-16" />
                       <div className="space-y-2">
                         <p className="font-black uppercase tracking-widest">Sem Histórico de Atividades</p>
                         <p className="text-xs max-w-xs mx-auto">Não encontramos movimentações para este processo no banco de dados.</p>
                       </div>
                    </div>
                 )}
              </TabsContent>

              {/* ABA: PARTES */}
              <TabsContent value="partes" className="space-y-6 animate-in fade-in duration-300">
                {(processo.parteAutora || processo.requerido) ? (
                  <div className="space-y-6">
                    <div className="p-6 rounded-[2rem] border border-emerald-500/15 bg-emerald-500/5 space-y-3">
                      <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                        <User className="h-4 w-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Polo Ativo (Autor / Requerente)</span>
                      </div>
                      <p className="text-base font-bold text-foreground/90 dark:text-white/90 leading-relaxed">
                        {processo.parteAutora || <span className="text-foreground/30 dark:text-white/30 italic">Não identificado</span>}
                      </p>
                    </div>
                    <div className="p-6 rounded-[2rem] border border-rose-500/15 bg-rose-500/5 space-y-3">
                      <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                        <Users className="h-4 w-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Polo Passivo (Réu / Requerido)</span>
                      </div>
                      <p className="text-base font-bold text-foreground/90 dark:text-white/90 leading-relaxed">
                        {processo.requerido || <span className="text-foreground/30 dark:text-white/30 italic">Não identificado</span>}
                      </p>
                    </div>
                    <p className="text-[10px] text-foreground/30 dark:text-white/30 italic text-center">
                      Histórico de advogados e prepostos será exibido em breve.
                    </p>
                  </div>
                ) : (
                  <div className="py-20 flex flex-col items-center justify-center text-center space-y-6 opacity-40 grayscale">
                    <Users className="h-16 w-16" />
                    <div className="space-y-2">
                      <p className="font-black uppercase tracking-widest">Sem Partes Cadastradas</p>
                      <p className="text-xs max-w-xs mx-auto">Sincronize via OAB ou edite o processo para registrar autor e réu.</p>
                    </div>
                  </div>
                )}
              </TabsContent>

            </Tabs>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
