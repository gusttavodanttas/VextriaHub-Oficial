import React, { useState, useEffect } from 'react';
import { getErrorMessage } from '@/lib/errors';
import { captureError } from '@/lib/monitoring';
import { planQuotaMessage } from '@/lib/planQuotaError';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Search,
  RotateCw,
  ShieldCheck,
  Loader2,
  ChevronRight,
  Database,
  Info,
  AlertCircle,
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
import { useProcessosV2 } from '@/hooks/useProcessosV2';
import { useMonitoredOabs } from '@/hooks/useMonitoredOabs';
import {
  looksLikeContaminatedName,
  resolverClienteId,
  somenteDigitos,
  type Andamento,
  type JudicialProcessResult,
  type PoloCliente,
  type ProcessoParaImportar,
} from './JudicialSync/types';
import { ResultadosTable } from './JudicialSync/ResultadosTable';
import { PreviewProcessoDialog } from './JudicialSync/PreviewProcessoDialog';

// Sincronização judicial por OAB: este arquivo guarda busca, seleção e
// importação. Tabela e pasta do processo vivem em ./JudicialSync/.
export type { Andamento, JudicialProcessResult } from './JudicialSync/types';

interface JudicialSyncContentProps {
  onImport: (processes: ProcessoParaImportar[]) => Promise<void>;
  onCancel: () => void;
}

const ITEMS_PER_PAGE = 20;

export const JudicialSyncContent: React.FC<JudicialSyncContentProps> = ({
  onImport,
  onCancel
}) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [oab, setOab] = useState('');
  const [uf, setUf] = useState('DF');
  const [results, setResults] = useState<JudicialProcessResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [clientPolos, setClientPolos] = useState<Record<string, PoloCliente>>({});
  const [previewProc, setPreviewProc] = useState<JudicialProcessResult | null>(null);
  const [loadingAndamentos, setLoadingAndamentos] = useState(false);
  const { oabs: monitoredOabs, loading: loadingOabs } = useMonitoredOabs();
  const [selectedOabId, setSelectedOabId] = useState('');

  // A busca só olha as OABs MONITORADAS do escritório — auto-seleciona a primeira.
  useEffect(() => {
    if (monitoredOabs.length > 0 && !selectedOabId) {
      const first = monitoredOabs[0];
      setSelectedOabId(first.id);
      setOab(first.oab);
      setUf(first.uf);
    }
  }, [monitoredOabs, selectedOabId]);

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

    if (!user?.office_id) {
      toast({
        title: "Escritório não identificado",
        description: "Faça login novamente para sincronizar seus processos.",
        variant: "destructive"
      });
      return;
    }
    const officeId = user.office_id;

    setLoading(true);
    setResults([]);
    setSelectedIds(new Set());
    setCurrentPage(1);

    try {
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
      const numeros = mappedResults.map(r => somenteDigitos(r.numeroProcesso));

      const [{ data: existentes }, { data: descartados }] = await Promise.all([
        supabase.from('processos').select('numero_processo').eq('office_id', officeId).in('numero_processo', numeros),
        supabase.from('processos_descartados').select('numero_processo').eq('office_id', officeId).in('numero_processo', numeros),
      ]);

      const ocultos = new Set([
        ...(existentes || []).map(e => e.numero_processo),
        ...(descartados || []).map(d => d.numero_processo),
      ]);
      const filteredResults = mappedResults.filter(r => !ocultos.has(somenteDigitos(r.numeroProcesso)));

      setResults(filteredResults);
      setSearched(true);

      // Salva os achados na caixa "Processos Encontrados" (staging) para revisão posterior
      if (filteredResults.length > 0) {
        const rows = filteredResults.map((r) => ({
          office_id: officeId,
          numero_processo: somenteDigitos(r.numeroProcesso),
          titulo: r.titulo || null,
          tribunal: r.tribunal || null,
          autor: r.autor || null,
          reu: r.reu || null,
          fonte: r.fonte || 'oab',
          payload: r as any,
          encontrado_por: user.id,
        }));
        supabase.from('processos_encontrados')
          .upsert(rows, { onConflict: 'office_id,numero_processo', ignoreDuplicates: true })
          .then(() => {}, () => {});
      }
    } catch (error: unknown) {
      toast({
        title: "Erro na sincronização",
        description: getErrorMessage(error, "Não foi possível conectar ao serviço de busca."),
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
        // Silencioso pro usuário (exibe "nenhum andamento" normalmente) — mas reportado
        // pro Sentry, pra distinguir "sem andamentos mesmo" de falha real da integração.
        captureError(e, { context: 'JudicialSyncDialog: buscar andamentos' });
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
          numero_processo: somenteDigitos(proc.numeroProcesso),
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
    if (!user?.office_id) {
      toast({ title: 'Escritório não identificado', description: 'Faça login novamente para importar.', variant: 'destructive' });
      return;
    }
    const officeId = user.office_id;
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

      const finalProcesses = await Promise.all(processesToImport.map(async (proc) => ({
        ...proc,
        clienteId: await resolverClienteId(proc, clientPolos[proc.id], officeId, user.id),
      })));

      await onImport(finalProcesses);
      toast({ title: "Importação concluída", description: `${selectedIds.size} processos foram salvos.` });
    } catch (e: unknown) {
      const quota = planQuotaMessage(e);
      // O erro pode vir prefixado com "N de M processos importados antes de
      // parar." (ver handleImport do componente pai) — mantém essa parte visível
      // mesmo quando reconhecido como erro de cota, senão o usuário não sabe
      // quantos já foram salvos antes da falha no meio do lote.
      const progresso = getErrorMessage(e).match(/^\d+ de \d+ processos importados antes de parar\./)?.[0];
      toast(quota
        ? { ...quota, description: progresso ? `${progresso} ${quota.description}` : quota.description, variant: 'destructive' }
        : { title: 'Erro ao importar', description: getErrorMessage(e), variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  };

  // Importa só o processo aberto na pasta (botão "Importar Este Processo").
  const handleImportPreview = async () => {
    if (!previewProc) return;
    if (!user?.office_id) {
      toast({ title: 'Escritório não identificado', description: 'Faça login novamente para importar.', variant: 'destructive' });
      return;
    }
    const officeId = user.office_id;
    setImporting(true);
    try {
      const clienteId = await resolverClienteId(previewProc, clientPolos[previewProc.id], officeId, user.id);
      await onImport([{ ...previewProc, clienteId }]);
      toast({ title: 'Processo importado', description: `${previewProc.numeroProcesso} salvo com sucesso.` });
      setPreviewProc(null);
    } catch (e: unknown) {
      toast({ title: 'Erro ao importar', description: getErrorMessage(e), variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  };

  const totalPages = Math.ceil(results.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedResults = results.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4 items-end p-1">
        <div className="md:col-span-4 space-y-2">
          <Label className="text-muted-foreground/60 font-black uppercase tracking-widest text-[10px] ml-1">OAB monitorada</Label>
          {loadingOabs ? (
            <div className="h-11 rounded-xl bg-muted/30 border border-border flex items-center px-4"><Loader2 className="h-4 w-4 animate-spin text-primary/40" /></div>
          ) : monitoredOabs.length === 0 ? (
            <div className="h-11 rounded-xl bg-amber-500/5 border border-amber-500/20 flex items-center gap-2 px-4 text-xs text-amber-600 font-medium">
              <AlertCircle className="h-4 w-4 shrink-0" /> Nenhuma OAB monitorada. O admin cadastra em Configurações → OABs monitoradas.
            </div>
          ) : (
            <Select value={selectedOabId} onValueChange={(v) => {
              const m = monitoredOabs.find((x) => x.id === v);
              if (m) { setSelectedOabId(m.id); setOab(m.oab); setUf(m.uf); }
            }}>
              <SelectTrigger className="bg-background border-border text-foreground h-11 rounded-xl font-bold">
                <div className="flex items-center gap-2 min-w-0"><ShieldCheck className="h-4 w-4 text-primary shrink-0" /><SelectValue placeholder="Escolha a OAB monitorada" /></div>
              </SelectTrigger>
              <SelectContent className="bg-background border-border rounded-2xl shadow-2xl">
                {monitoredOabs.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.label ? `${m.label} — ` : ''}OAB {m.oab}/{m.uf}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <Button onClick={handleSearch} disabled={loading || monitoredOabs.length === 0} className="gap-2 h-11 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-premium">
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
                aria-label="Página anterior"
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
                aria-label="Próxima página"
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

      <ResultadosTable
        results={results}
        paginatedResults={paginatedResults}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        onToggleSelectAll={toggleSelectAll}
        onOpenPreview={openPreview}
        loading={loading}
        searched={searched}
        oab={oab}
        uf={uf}
      />

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

      <PreviewProcessoDialog
        proc={previewProc}
        onClose={() => setPreviewProc(null)}
        polo={previewProc ? clientPolos[previewProc.id] : undefined}
        onSetPolo={(polo) => { if (previewProc) setClientPolos({ ...clientPolos, [previewProc.id]: polo }); }}
        onChange={(updates) => { if (previewProc) updateResultLocally(previewProc.id, updates); }}
        loadingAndamentos={loadingAndamentos}
        importing={importing}
        onIgnorar={() => { if (previewProc) ignorarProcesso(previewProc.id); }}
        onImportar={handleImportPreview}
      />
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
  const { create } = useProcessosV2({ lista: false });

  const handleImport = async (procs: JudicialProcessResult[]) => {
    if (onImport) {
      await onImport(procs);
    } else {
      // Se um item no meio do lote bater a cota do plano (ou qualquer outro erro),
      // o loop para ali — mas sem isto o usuário não tinha como saber quantos dos
      // selecionados já tinham sido importados antes da falha.
      let importados = 0;
      for (const proc of procs) {
        try {
          await create(proc as any);
          importados++;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          throw new Error(importados > 0 ? `${importados} de ${procs.length} processos importados antes de parar. ${msg}` : msg);
        }
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
