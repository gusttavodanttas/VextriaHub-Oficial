import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Search, 
  RotateCw, 
  ShieldCheck, 
  Gavel, 
  User, 
  Users,
  Loader2, 
  ChevronRight,
  Database,
  Info,
  AlertCircle,
  Clock
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useProcessosV2 } from '@/hooks/useProcessosV2';

const UFs = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 
  'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 
  'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'
];

export interface Andamento {
  data: string | null;
  resumo: string;
  descricao?: string;
  fase?: string;
}

export interface JudicialProcessResult {
  id: string;
  numeroProcesso: string;
  numeroFormatado?: string;
  titulo: string;
  partes: string;
  tribunal: string;
  ultimoAndamento: { descricao: string; data: string | null } | null;
  andamentos?: Andamento[];
  faseProcessual: string;
  classe?: string;
  assunto?: string;
  dataAjuizamento?: string | null;
  instancia?: string;
  valorCausa?: number;
  vara?: string;
  comarca?: string;
  orgaoJulgadorCodigo?: string;
  nivelSigilo?: number;
  conteudo?: string;
  autor: string;
  reu: string;
}

interface JudicialSyncContentProps {
  onImport: (processes: (JudicialProcessResult & { clienteId?: string | null })[]) => Promise<void>;
  onCancel: () => void;
}

// ---------- Utils ----------
function formatCNJ(numero: string | undefined | null): string {
  const d = (numero ?? '').replace(/\D/g, '');
  if (d.length !== 20) return numero ?? '';
  return d.replace(/(\d{7})(\d{2})(\d{4})(\d{1})(\d{2})(\d{4})/, '$1-$2.$3.$4.$5.$6');
}

function looksLikeContaminatedName(s: string): boolean {
  if (!s) return false;
  if (s.length > 120) return true;
  if (s.split(' ').length > 12) return true;
  return /\b(SENTEN[ÇC]A|DECIS[ÃA]O|CERTID[ÃA]O|FINALIDADE|DESTINAT|OBSERVA[ÇC][ÃA]O|INTIMA[ÇC][ÃA]O)\b/i.test(s);
}

function normalizeClientName(s: string): string {
  return s.replace(/\s+/g, ' ').trim().split(' ').slice(0, 8).join(' ').slice(0, 100);
}

interface JudicialSyncContentProps {
  onImport: (processes: (JudicialProcessResult & { clienteId?: string | null })[]) => Promise<void>;
  onCancel: () => void;
}

export const JudicialSyncContent: React.FC<JudicialSyncContentProps> = ({
  onImport,
  onCancel
}) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [oab, setOab] = useState('');
  const [uf, setUf] = useState('DF');
  const [results, setResults] = useState<JudicialProcessResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [clientPolos, setClientPolos] = useState<Record<string, 'autor' | 'reu'>>({});
  const [previewProc, setPreviewProc] = useState<JudicialProcessResult | null>(null);
  const [loadingAndamentos, setLoadingAndamentos] = useState(false);

  const handleSearch = async () => {
    const cleanOab = oab.replace(/\D/g, '');
    if (!cleanOab || !uf) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, informe a OAB (somente números) e o Estado.",
        variant: "destructive"
      });
      return;
    }

    const key = `${cleanOab}-${uf}`;

    setLoading(true);
    setResults([]);
    setSelectedIds(new Set());
    setCurrentPage(1);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      
      const { data, error } = await supabase.functions.invoke('fetch-by-oab', {
        body: { oab: cleanOab, uf }
      });

      if (error) {
        throw new Error(error.message || `Falha na comunicação com o servidor judicial.`);
      }

      const rawItems = Array.isArray(data) ? data : (data?.items ?? []);
      const status = Array.isArray(data) ? 'ok' : (data?.status ?? 'ok');

      if (status === 'not_found') {
        toast({
          title: "OAB não encontrada",
          description: `Não localizamos registros para OAB ${cleanOab}/${uf}.`,
          variant: "destructive"
        });
        setSearched(true);
        return;
      }

      const mappedResults: JudicialProcessResult[] = rawItems.map((item: any) => ({
        ...item,
        id: String(item.id || item.numeroProcesso),
        autor: item.autor === 'Não identificado' ? '' : (item.autor || ''),
        reu: item.reu === 'Não identificado' ? '' : (item.reu || ''),
        andamentos: Array.isArray(item.andamentos) ? item.andamentos : [],
      }));

      // Filtra processos já importados e descartados no escritório
      const numeros = mappedResults.map(r => (r.numeroProcesso || '').replace(/\D/g, ''));

      const [{ data: existentes }, { data: descartados }] = await Promise.all([
        supabase.from('processos').select('numero_processo').eq('office_id', user?.office_id).in('numero_processo', numeros),
        supabase.from('processos_descartados').select('numero_processo').eq('office_id', user?.office_id).in('numero_processo', numeros),
      ]);

      const ocultos = new Set([
        ...(existentes || []).map(e => e.numero_processo),
        ...(descartados || []).map(d => d.numero_processo),
      ]);
      const filteredResults = mappedResults.filter(r => !ocultos.has((r.numeroProcesso || '').replace(/\D/g, '')));

      setResults(filteredResults);
      setSearched(true);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      toast({
        title: "Erro na sincronização",
        description: err.message || "Não foi possível conectar ao serviço de busca.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === results.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(results.map(r => r.id)));
    }
  };

  const updateResultLocally = (id: string, updates: Partial<JudicialProcessResult>) => {
    setResults(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
    if (previewProc?.id === id) {
      setPreviewProc(curr => curr ? { ...curr, ...updates } : null);
    }
  };

  const openPreview = async (proc: JudicialProcessResult) => {
    setPreviewProc(proc);
    // Só busca andamentos se ainda não foram carregados
    if (!proc.andamentos || proc.andamentos.length === 0) {
      setLoadingAndamentos(true);
      try {
        // Tenta com OAB primeiro; se não retornar andamentos, tenta sem OAB
        let response = await supabase.functions.invoke('fetch-processo', {
          body: { numeroProcesso: proc.numeroProcesso, oab: oab.replace(/\D/g, ''), uf },
        });
        if (!response.error && (!response.data?.andamentos?.length)) {
          response = await supabase.functions.invoke('fetch-processo', {
            body: { numeroProcesso: proc.numeroProcesso },
          });
        }
        const { data, error } = response;
        if (error) throw error;
        // A função pode retornar andamentos em diferentes campos dependendo da versão
        const raw = data?.andamentos ?? data?.movimentos ?? data?.movimentacoes ?? [];
        if (Array.isArray(raw) && raw.length > 0) {
          const andamentos: Andamento[] = raw.map((a: any) => ({
            data: a.data || a.dataMovimento || a.data_movimentacao || null,
            resumo: a.resumo || a.descricao || a.texto || '',
            descricao: a.descricao || a.resumo || a.texto || '',
            fase: a.fase || a.tipo || null,
          }));
          updateResultLocally(proc.id, { andamentos });
          setPreviewProc(curr => curr ? { ...curr, andamentos } : null);
        }
      } catch (e) {
        // silencioso — exibe "nenhum andamento" normalmente
      } finally {
        setLoadingAndamentos(false);
      }
    }
  };

  const ignorarProcesso = async (id: string) => {
    const proc = results.find(r => r.id === id);
    // Salvar no Supabase para não aparecer mais e para o suporte poder recuperar
    if (proc && user?.office_id) {
      try {
        await supabase.from('processos_descartados').insert({
          office_id: user.office_id,
          user_id: user.id,
          numero_processo: (proc.numeroProcesso || '').replace(/\D/g, ''),
          titulo: proc.titulo,
          tribunal: proc.tribunal,
          motivo: 'descartado_busca_oab',
          dados_originais: proc as any,
        });
      } catch (err) {
        console.error('[sync] erro ao salvar descarte:', err);
      }
    }
    setResults(prev => prev.filter(item => item.id !== id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setPreviewProc(null);
    toast({
      title: "Processo descartado",
      description: "Removido da lista. O suporte pode recuperá-lo se necessário.",
    });
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const processesToImport = results.filter(p => selectedIds.has(p.id));
      
      const flagged = processesToImport.filter(p => 
        looksLikeContaminatedName(p.autor) || looksLikeContaminatedName(p.reu)
      );

      if (flagged.length > 0) {
        toast({
          title: "Revise antes de importar",
          description: `${flagged.length} processos têm nomes suspeitos. Por favor, edite-os manualmente.`,
          variant: "destructive"
        });
        setImporting(false);
        return;
      }

      const finalProcesses = await Promise.all(processesToImport.map(async (proc) => {
        let finalClienteId = null;
        const polo = clientPolos[proc.id];
        
        if (polo) {
          const rawName = polo === 'autor' ? proc.autor : proc.reu;
          if (rawName) {
            const nomeCliente = normalizeClientName(rawName);
            
            // Verificar se cliente já existe por nome no escritório
            const { data: existingClient } = await supabase
              .from('clientes')
              .select('id')
              .eq('nome', nomeCliente)
              .eq('office_id', user?.office_id)
              .maybeSingle();

            if (existingClient) {
              finalClienteId = existingClient.id;
            } else {
              const { data: novoCliente, error: errCliente } = await supabase
                .from('clientes')
                .insert({ 
                  nome: nomeCliente, 
                  office_id: user?.office_id,
                  user_id: user?.id 
                })
                .select('id').single();
                
              if (!errCliente && novoCliente) {
                finalClienteId = novoCliente.id;
              }
            }
          }
        }
        
        return {
          ...proc,
          clienteId: finalClienteId
        };
      }));

      await onImport(finalProcesses);
      toast({ title: "Importação concluída", description: `${selectedIds.size} processos foram salvos.` });
    } catch (e: any) {
      toast({ title: 'Erro ao importar', description: e.message, variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  };

  const totalPages = Math.ceil(results.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedResults = results.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4 items-end p-1">
        <div className="space-y-2">
          <Label className="text-muted-foreground/60 font-black uppercase tracking-widest text-[10px] ml-1">UF do Tribunal</Label>
          <Select value={uf} onValueChange={setUf}>
            <SelectTrigger className="bg-background border-border text-foreground h-11 rounded-xl font-bold">
              <SelectValue placeholder="UF" />
            </SelectTrigger>
            <SelectContent className="bg-background border-border rounded-2xl shadow-2xl">
              {UFs.map(state => <SelectItem key={state} value={state}>{state}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-3 space-y-2">
          <Label className="text-muted-foreground/60 font-black uppercase tracking-widest text-[10px] ml-1">Número da OAB</Label>
          <div className="relative group">
            <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/30 group-focus-within:text-primary transition-colors" />
            <Input 
              className="pl-12 bg-background border-border text-foreground h-11 rounded-xl font-bold transition-all focus:ring-4 focus:ring-primary/10"
              placeholder="Ex: 61199" 
              value={oab}
              onChange={(e) => setOab(e.target.value.replace(/\D/g, ''))}
            />
          </div>
        </div>
        <Button onClick={handleSearch} disabled={loading} className="gap-2 h-11 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-premium">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {loading ? 'Buscando...' : 'Pesquisar'}
        </Button>
      </div>

      {results.length > 0 && (
        <div className="bg-primary/5 border border-primary/20 p-3 rounded-xl mb-4 flex items-center gap-2">
          <Info className="h-4 w-4 text-primary" />
          <span className="text-xs font-medium text-foreground">
            Dica: Clique no processo para ver a pasta e configurar quem é o cliente (Autor ou Réu).
          </span>
        </div>
      )}

      {/* Resultados e Paginação Premium */}
      {results.length > 0 && (
        <div className="bg-muted/30 border border-border p-4 rounded-2xl mb-4 flex items-center justify-between px-6 shrink-0 shadow-premium">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Database className="h-4 w-4" />
              </div>
              <span className="text-sm font-black text-foreground uppercase tracking-tight">Encontrados ({results.length})</span>
            </div>
            
            {/* Controles de Paginação */}
            <div className="flex items-center gap-2 border-l border-black/5 dark:border-border ml-2 pl-4">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-muted-foreground hover:bg-muted"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
              >
                <ChevronRight className="h-4 w-4 rotate-180" />
              </Button>
              <span className="text-[10px] text-muted-foreground/60 font-mono font-bold">
                {currentPage} / {totalPages}
              </span>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-muted-foreground hover:bg-muted"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-6">
             <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">{selectedIds.size} selecionados</span>
             <button 
               onClick={toggleSelectAll}
               className="text-[10px] font-black uppercase tracking-widest text-primary hover:text-primary/80 transition-colors border-b border-primary/20 pb-0.5"
             >
               {selectedIds.size === results.length ? 'Desmarcar todos' : 'Selecionar todos'}
             </button>
          </div>
        </div>
      )}

      <div className="flex-1 min-h-[300px] border border-border rounded-[2rem] bg-muted/10 overflow-hidden flex flex-col mb-4 shadow-inner">
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {results.length > 0 ? (
            <Table>
              <TableHeader className="bg-muted sticky top-0 z-20 backdrop-blur-md">
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="w-[40px] px-6">
                    <Checkbox 
                      checked={selectedIds.size === results.length && results.length > 0} 
                      onCheckedChange={toggleSelectAll}
                      className="border-border data-[state=checked]:bg-primary"
                    />
                  </TableHead>
                  <TableHead className="text-muted-foreground/60 text-[10px] uppercase tracking-widest font-black py-5">Processo</TableHead>
                  <TableHead className="text-muted-foreground/60 text-[10px] uppercase tracking-widest font-black py-5">Autor</TableHead>
                  <TableHead className="text-muted-foreground/60 text-[10px] uppercase tracking-widest font-black py-5">Réu</TableHead>
                  <TableHead className="text-muted-foreground/60 text-[10px] uppercase tracking-widest font-black py-5">Fase</TableHead>
                  <TableHead className="text-muted-foreground/60 text-[10px] uppercase tracking-widest font-black py-5">Tribunal</TableHead>
                  <TableHead className="text-muted-foreground/60 text-[10px] uppercase tracking-widest font-black py-5">Último Andamento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedResults.map((proc) => (
                  <TableRow 
                    key={proc.id} 
                    className={cn(
                       "group border-border transition-colors cursor-pointer",
                       selectedIds.has(proc.id) ? "bg-primary/[0.04] dark:bg-primary/[0.08]" : "hover:bg-muted/30"
                    )}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('.checkbox-cell')) return;
                      openPreview(proc);
                    }}
                  >
                    <TableCell className="px-4 checkbox-cell">
                      <Checkbox 
                        checked={selectedIds.has(proc.id)} 
                        onCheckedChange={() => toggleSelect(proc.id)}
                        className="border-border data-[state=checked]:bg-primary"
                      />
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-[10px] font-bold text-primary whitespace-nowrap">
                        {proc.numeroProcesso.replace(/[.-]/g, '').length === 20 
                          ? proc.numeroProcesso.replace(/[.-]/g, '').replace(/^(\d{7})(\d{2})(\d{4})(\d)(\d{2})(\d{4})$/, '$1-$2.$3.$4.$5.$6')
                          : proc.numeroProcesso}
                      </span>
                    </TableCell>
                    <TableCell>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="text-[10px] font-black line-clamp-1 text-foreground cursor-default max-w-[200px]">
                              {proc.autor || 'Não identificado'}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="bg-background border-border text-foreground max-w-sm">
                            {proc.autor || 'Não identificado'}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="text-[10px] font-medium line-clamp-2 text-foreground/80 cursor-default max-w-[200px]">
                              {proc.reu || 'Não identificada'}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="bg-background border-border text-foreground max-w-sm">
                            {proc.reu || 'Não identificada'}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[8px] h-5 uppercase font-black bg-muted border-border text-muted-foreground/60 whitespace-nowrap rounded-md">
                        {proc.faseProcessual}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-[10px] text-muted-foreground/60 truncate max-w-[120px] inline-block font-bold">
                        {proc.tribunal} {proc.vara && `• ${proc.vara}`}
                      </span>
                    </TableCell>
                    <TableCell>
                      {proc.ultimoAndamento ? (
                        <div className="flex flex-col gap-0.5 max-w-[200px]">
                          <span className="text-[9px] text-primary/70 font-black uppercase">
                            {new Date(proc.ultimoAndamento.data).toLocaleDateString()}
                          </span>
                          <span className="text-[10px] line-clamp-1 italic text-muted-foreground/40 font-medium">{proc.ultimoAndamento.descricao}</span>
                        </div>
                      ) : <span className="text-muted-foreground/20 italic text-[10px] font-medium">Sem andamento</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground/30 h-full">
              {loading ? (
                <>
                  <Loader2 className="h-10 w-10 animate-spin mb-4 text-primary" />
                  <p className="text-muted-foreground animate-pulse">Sincronizando com tribunais...</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-2">Isso pode levar alguns segundos.</p>
                </>
              ) : searched ? (
                <>
                  <AlertCircle className="h-12 w-12 mb-4 text-orange-500 opacity-60" />
                  <p className="text-lg font-medium text-foreground">Nenhum processo encontrado</p>
                  <p className="text-xs mt-2 max-w-[300px] mx-auto text-muted-foreground italic">
                    Não encontramos processos vinculados à OAB {oab}/{uf} nos tribunais integrados. 
                    Confira se o número está correto ou tente buscar por outros critérios.
                  </p>
                </>
              ) : (
                <>
                  <Database className="h-12 w-12 mb-4 opacity-10" />
                  <p className="text-lg font-medium text-muted-foreground">Busca pronta</p>
                  <p className="text-xs mt-2 max-w-[240px] mx-auto text-muted-foreground">
                    Informe sua OAB e Estado para sincronizar processos diretamente dos tribunais.
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 pt-6 border-t border-border flex items-center justify-between bg-transparent">
        <Button variant="ghost" onClick={onCancel} disabled={importing} className="text-muted-foreground hover:text-foreground hover:bg-muted font-black uppercase tracking-widest text-[10px] h-11 px-6 rounded-xl transition-all">
          Cancelar
        </Button>
        <Button 
          onClick={handleImport} 
          disabled={selectedIds.size === 0 || importing}
          className={`gap-2 px-8 bg-primary shadow-premium h-11 font-black uppercase tracking-widest text-[10px] rounded-xl transition-all hover:scale-[1.02] ${selectedIds.size === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
          {importing ? 'Importando...' : selectedIds.size > 0 ? `Importar ${selectedIds.size} Processo(s)` : 'Nenhum Selecionado'}
        </Button>
      </div>

      <Dialog open={!!previewProc} onOpenChange={(open) => !open && setPreviewProc(null)}>
        <DialogContent className="max-w-2xl bg-background border border-border p-8 shadow-2xl rounded-2xl max-h-[90vh] flex flex-col gap-0">
          <DialogTitle className="sr-only">
            {previewProc ? `Processo ${previewProc.numeroProcesso}` : 'Detalhes do processo'}
          </DialogTitle>
          {previewProc && (
            <div className="flex flex-col flex-1 min-h-0 h-full gap-0">
              {/* Header Fixo */}
              <div className="flex items-center gap-4 border-b border-border pb-6 shrink-0">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shrink-0">
                  <Gavel className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-black font-mono text-primary tracking-tight">
                    {formatCNJ(previewProc.numeroProcesso)}
                  </h3>
                  <p className="text-muted-foreground text-[10px] font-black uppercase tracking-widest mt-1">
                    {previewProc.tribunal} • {previewProc.faseProcessual}
                  </p>
                </div>
              </div>

              {/* Corpo Rolável */}
              <div className="flex-1 overflow-y-auto py-6 pr-2 space-y-6 custom-scrollbar max-h-[calc(90vh-220px)]">
                <div className="grid grid-cols-2 gap-8">
                  {/* Lado Autor */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-muted-foreground/60 text-[10px] font-black uppercase tracking-widest">
                      <User className="h-4 w-4 text-primary" /> Autor / Requerente
                    </div>
                    <div className="space-y-3">
                      <Input 
                        className="bg-background border-border text-foreground text-xs h-10 rounded-xl focus:ring-4 focus:ring-primary/10 font-bold"
                        placeholder="Nome do Autor"
                        value={previewProc.autor}
                        onChange={(e) => updateResultLocally(previewProc.id, { autor: e.target.value })}
                      />
                      <Button 
                        variant={clientPolos[previewProc.id] === 'autor' ? 'default' : 'outline'}
                        size="sm"
                        className="w-full rounded-xl gap-2 font-black text-[10px] h-9 uppercase tracking-widest shadow-premium"
                        onClick={() => setClientPolos({...clientPolos, [previewProc.id]: 'autor'})}
                      >
                        {clientPolos[previewProc.id] === 'autor' && <ShieldCheck className="h-3 w-3" />}
                        Este é meu cliente
                      </Button>
                    </div>
                  </div>

                  {/* Lado Réu */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-muted-foreground/60 text-[10px] font-black uppercase tracking-widest">
                      <Users className="h-4 w-4 text-primary" /> Réu / Requerido
                    </div>
                    <div className="space-y-3">
                      <Input 
                        className="bg-background border-border text-foreground text-xs h-10 rounded-xl focus:ring-4 focus:ring-primary/10 font-bold"
                        placeholder="Nome do Réu"
                        value={previewProc.reu}
                        onChange={(e) => updateResultLocally(previewProc.id, { reu: e.target.value })}
                      />
                      <Button 
                        variant={clientPolos[previewProc.id] === 'reu' ? 'default' : 'outline'}
                        size="sm"
                        className="w-full rounded-xl gap-2 font-black text-[10px] h-9 uppercase tracking-widest shadow-premium"
                        onClick={() => setClientPolos({...clientPolos, [previewProc.id]: 'reu'})}
                      >
                        {clientPolos[previewProc.id] === 'reu' && <ShieldCheck className="h-3 w-3" />}
                        Este é meu cliente
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Vara e Comarca Premium */}
                <div className="grid grid-cols-2 gap-4 bg-muted/30 p-5 rounded-[1.5rem] border border-border shadow-inner">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] text-muted-foreground/40 uppercase font-black tracking-widest ml-1">Vara / Órgão</Label>
                    <Input 
                      className="bg-background border-border text-foreground text-xs h-9 font-bold"
                      value={previewProc.vara}
                      onChange={(e) => updateResultLocally(previewProc.id, { vara: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] text-muted-foreground/40 uppercase font-black tracking-widest ml-1">Comarca / UF</Label>
                    <Input 
                      className="bg-background border-border text-foreground text-xs h-9 font-bold"
                      value={previewProc.comarca}
                      onChange={(e) => updateResultLocally(previewProc.id, { comarca: e.target.value })}
                    />
                  </div>
                </div>

                <Separator className="bg-border" />

                <div className="space-y-4">
                  <div className="text-muted-foreground/60 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                      <Clock className="h-3 w-3" />
                    </div>
                    <span>Linha do Tempo de Movimentações</span>
                  </div>
                  
                  <div className="bg-muted/30 rounded-[1.5rem] p-6 border border-border max-h-[250px] overflow-y-auto custom-scrollbar space-y-6 relative pl-8 shadow-inner">
                    {/* Linha vertical da timeline */}
                    <div className="absolute left-[31px] top-6 bottom-6 w-0.5 bg-primary/20" />

                    {loadingAndamentos ? (
                      <div className="flex flex-col items-center justify-center py-8 gap-3">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Buscando andamentos...</p>
                      </div>
                    ) : previewProc.andamentos && previewProc.andamentos.length > 0 ? (
                      previewProc.andamentos.map((and, idx) => (
                        <div key={idx} className="relative">
                          <div className="absolute -left-[37px] top-1.5 h-3 w-3 rounded-full bg-primary ring-4 ring-card" />
                          <div className="space-y-1.5">
                            <span className="text-[10px] font-black text-primary uppercase">
                              {and.data ? new Date(and.data).toLocaleDateString('pt-BR') : 'Sem data'}
                            </span>
                            <p className="text-xs font-bold text-foreground/80 leading-relaxed">
                              {and.resumo || and.descricao}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 gap-3 opacity-70">
                        <AlertCircle className="h-8 w-8 text-yellow-500" />
                        <p className="text-[10px] uppercase font-black tracking-widest text-center text-yellow-500">Nenhum andamento extraído</p>
                        <p className="text-xs text-muted-foreground text-center max-w-xs">
                          Movimentos não disponíveis publicamente. Adicione manualmente após importar.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer Fixo */}
              <DialogFooter className="pt-4 border-t border-border mt-4 shrink-0 flex flex-row items-center justify-between w-full">
                <Button
                  variant="ghost"
                  onClick={() => setPreviewProc(null)}
                  className="text-muted-foreground text-[10px] font-black uppercase tracking-widest hover:bg-muted h-11 rounded-xl transition-all"
                >
                  Sair
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    className="border-red-500/30 text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/20 font-black uppercase tracking-widest text-[10px] px-6 h-11 rounded-xl transition-all"
                    onClick={() => ignorarProcesso(previewProc.id)}
                  >
                    Ignorar Processo
                  </Button>
                  <Button
                    className="font-black uppercase tracking-widest text-[10px] px-8 h-11 rounded-xl shadow-premium transition-all bg-primary hover:bg-primary/90 text-primary-foreground"
                    disabled={importing}
                    onClick={async () => {
                      setImporting(true);
                      try {
                        const polo = clientPolos[previewProc.id];
                        let finalClienteId = null;
                        if (polo) {
                          const rawName = polo === 'autor' ? previewProc.autor : previewProc.reu;
                          if (rawName) {
                            const nomeCliente = normalizeClientName(rawName);
                            const { data: existing } = await supabase
                              .from('clientes').select('id')
                              .eq('nome', nomeCliente).eq('office_id', user?.office_id).maybeSingle();
                            if (existing) {
                              finalClienteId = existing.id;
                            } else {
                              const { data: novo } = await supabase.from('clientes')
                                .insert({ nome: nomeCliente, office_id: user?.office_id, user_id: user?.id })
                                .select('id').single();
                              if (novo) finalClienteId = novo.id;
                            }
                          }
                        }
                        await onImport([{ ...previewProc, clienteId: finalClienteId }]);
                        toast({ title: 'Processo importado', description: `${previewProc.numeroProcesso} salvo com sucesso.` });
                        setPreviewProc(null);
                      } catch (e: any) {
                        toast({ title: 'Erro ao importar', description: e.message, variant: 'destructive' });
                      } finally {
                        setImporting(false);
                      }
                    }}
                  >
                    {importing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Database className="h-4 w-4 mr-1" />}
                    Importar Este Processo
                  </Button>
                </div>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>

  );
};

interface JudicialSyncDialogProps {
  // Modo legado: dispara via trigger interno + onImport
  onImport?: (processes: JudicialProcessResult[]) => Promise<void>;
  trigger?: React.ReactNode;
  // Modo controlado: aberto/fechado pela página + persistência interna via useProcessosV2
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSyncComplete?: () => void;
}

export const JudicialSyncDialog: React.FC<JudicialSyncDialogProps> = ({
  onImport,
  trigger,
  open: controlledOpen,
  onOpenChange,
  onSyncComplete,
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (next: boolean) => {
    if (isControlled) {
      onOpenChange?.(next);
    } else {
      setInternalOpen(next);
    }
  };

  // Quando em modo controlado, persistimos via useProcessosV2 internamente
  const { create } = useProcessosV2();

  const handleImport = async (procs: JudicialProcessResult[]) => {
    if (onImport) {
      await onImport(procs);
    } else {
      for (const proc of procs) {
        await create(proc as any);
      }
    }
    onSyncComplete?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          {trigger || (
            <Button variant="outline" className="gap-2">
              <RotateCw className="h-4 w-4" />
              Sincronizar OAB
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="max-w-[1200px] w-[95vw] bg-background border border-border p-0 overflow-hidden flex flex-col h-[90vh] max-h-[90vh] shadow-2xl rounded-[2rem]">
        <DialogHeader className="p-8 pb-4 border-b border-border bg-muted/20">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shadow-inner">
              <Database className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-black tracking-tight">Sincronização Judicial (PJE/CNJ)</DialogTitle>
              <DialogDescription className="text-muted-foreground/60 font-medium">
                Busque processos vinculados à sua OAB e importe-os seletivamente para seu escritório.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col px-8 pb-6">
          <JudicialSyncContent
            onImport={async (procs) => {
              await handleImport(procs);
              setOpen(false);
            }}
            onCancel={() => setOpen(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
