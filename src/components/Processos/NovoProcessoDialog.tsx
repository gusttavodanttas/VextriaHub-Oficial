import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, FileText, Scale, User, Gavel, ShieldCheck, Info, RotateCw, Search, Loader2, AlertTriangle } from 'lucide-react';
import { usePlanLimits } from '@/hooks/usePlanFeatures';
import { useToast } from '@/hooks/use-toast';
import { PermissionGuard } from '@/components/Auth/PermissionGuard';
import { useOfficeUsers } from '@/hooks/useOfficeUsers';
import { useAuth } from '@/contexts/AuthContext';
import { NovoProcessoForm, tiposProcesso, statusProcesso, fasesProcessuais } from '@/types/processo';
import { Separator } from '@/components/ui/separator';
import { formatCNJ, unformatCNJ } from '@/lib/formatters';
import { JudicialSyncDialog, JudicialSyncContent } from './JudicialSyncDialog';
import { useProcessosV2 } from '@/hooks/useProcessosV2';
import { supabase } from '@/integrations/supabase/client';

interface NovoProcessoDialogProps {
  // Opcional: se não passado, usamos useProcessosV2.create direto
  onAddProcesso?: (processo: any) => Promise<any> | any;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialData?: Partial<NovoProcessoForm>;
  onSuccess?: () => void;
}

export const NovoProcessoDialog: React.FC<NovoProcessoDialogProps> = ({
  onAddProcesso,
  trigger,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  initialData,
  onSuccess,
}) => {
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const { limits } = usePlanLimits();
  const { users: teamMembers } = useOfficeUsers();
  const { addMovimentacao, create } = useProcessosV2();

  // Wrapper: usa o callback do pai se existir; senão chama create() direto.
  const addProcesso = async (proc: any) => {
    if (onAddProcesso) {
      return await onAddProcesso(proc);
    }
    return await create(proc);
  };
  const isLimitReached = limits.processes.isReached;
  
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = setControlledOpen ?? setInternalOpen;
  const [step, setStep] = useState<'choice' | 'oab' | 'cnj' | 'form'>('choice');
  const [isLoading, setIsLoading] = useState(false);
  const [cnjInput, setCnjInput] = useState('');
  // Sinaliza que a busca rodou mas não localizou as partes (sigilo/sem cadastro)
  const [partesNaoLocalizadas, setPartesNaoLocalizadas] = useState(false);
  
  const [formData, setFormData] = useState<NovoProcessoForm & { parteAutora?: string }>({
    titulo: initialData?.titulo || '',
    cliente: initialData?.cliente || '',
    status: initialData?.status || 'Em andamento',
    proximoPrazo: initialData?.proximoPrazo || '',
    descricao: initialData?.descricao || '',
    valorCausa: initialData?.valorCausa || 0,
    numeroProcesso: initialData?.numeroProcesso || '',
    tipoProcesso: initialData?.tipoProcesso || '',
    faseProcessual: initialData?.faseProcessual || 'Fase Inicial',
    responsavelId: user?.id || '',
    tribunal: initialData?.tribunal || '',
    vara: initialData?.vara || '',
    comarca: initialData?.comarca || '',
    requerido: initialData?.requerido || (initialData as any)?.reu || '',
    parteAutora: (initialData as any)?.parteAutora || (initialData as any)?.autor || '',
    segredoJustica: false,
    justicaGratuita: false
  });

  // Reseta formData a partir do initialData sempre que ele chega/muda.
  // Aceita tanto chaves canônicas (parteAutora/requerido) quanto raw da edge function (autor/reu).
  React.useEffect(() => {
    if (!initialData) return;
    const i: any = initialData;
    setFormData((prev) => ({
      ...prev,
      titulo: i.titulo || prev.titulo || '',
      cliente: i.cliente || prev.cliente || '',
      clienteId: i.clienteId || (prev as any).clienteId,
      status: i.status || prev.status || 'Em andamento',
      proximoPrazo: i.proximoPrazo || prev.proximoPrazo || '',
      descricao: i.descricao || prev.descricao || '',
      valorCausa: typeof i.valorCausa === 'number' ? i.valorCausa : (prev.valorCausa || 0),
      numeroProcesso: i.numeroProcesso || prev.numeroProcesso || '',
      tipoProcesso: i.tipoProcesso || i.classe || prev.tipoProcesso || '',
      faseProcessual: i.faseProcessual || prev.faseProcessual || 'Fase Inicial',
      responsavelId: prev.responsavelId || user?.id || '',
      tribunal: i.tribunal || prev.tribunal || '',
      vara: i.vara || prev.vara || '',
      comarca: i.comarca || prev.comarca || '',
      requerido: i.requerido || i.reu || prev.requerido || '',
      parteAutora: i.parteAutora || i.autor || (prev as any).parteAutora || '',
      segredoJustica: !!i.segredoJustica,
      justicaGratuita: !!i.justicaGratuita,
      // Extras que o useProcessosV2.create entende — não aparecem no form mas vão pro create
      classe: i.classe,
      assunto: i.assunto,
      instancia: i.instancia,
      dataAjuizamento: i.dataAjuizamento,
      orgaoJulgadorCodigo: i.orgaoJulgadorCodigo,
      nivelSigilo: i.nivelSigilo,
      ultimoAndamento: i.ultimoAndamento,
      andamentos: Array.isArray(i.andamentos) ? i.andamentos : [],
    } as any));
    setStep('form');
  }, [initialData, user?.id]);

  const resetForm = () => {
    setFormData({
      titulo: '',
      cliente: '',
      status: 'Em andamento',
      proximoPrazo: '',
      descricao: '',
      valorCausa: 0,
      numeroProcesso: '',
      tipoProcesso: '',
      faseProcessual: 'Fase Inicial',
      responsavelId: user?.id || '',
      tribunal: '',
      vara: '',
      comarca: '',
      requerido: '',
      parteAutora: '',
      segredoJustica: false,
      justicaGratuita: false,
    } as any);
    setStep('choice');
    setCnjInput('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLimitReached) return;
    
    setIsLoading(true);
    try {
      const fd = formData as any;

      // Rede de segurança contra duplicata ao salvar (ex: CNJ digitado manualmente)
      const cnjLimpo = (fd.numeroProcesso || '').replace(/\D/g, '');
      if (user?.office_id && cnjLimpo) {
        const { data: jaExiste } = await supabase
          .from('processos')
          .select('id')
          .eq('office_id', user.office_id)
          .eq('numero_processo', cnjLimpo)
          .eq('deletado', false)
          .maybeSingle();
        if (jaExiste) {
          toast({
            title: 'Processo já cadastrado',
            description: 'Já existe um processo com este número no seu escritório.',
            variant: 'destructive',
          });
          setIsLoading(false);
          return;
        }
      }

      // Prioriza dataAjuizamento (DataJud) > dataInicio passada > hoje
      const dataInicio =
        (fd.dataAjuizamento ? String(fd.dataAjuizamento).split('T')[0] : null) ||
        fd.dataInicio ||
        new Date().toISOString().split('T')[0];

      const novoProcesso = {
        ...formData,
        id: Date.now().toString(),
        dataInicio,
        valorCausa: formData.valorCausa || 0,
      };

      // Inclui andamentos no payload pra que useProcessosV2.create persista em batch.
      const createdProc = await addProcesso({
        ...novoProcesso,
        andamentos: fd.andamentos || [],
      });

      resetForm();
      setOpen(false);
      onSuccess?.();

      toast({
        title: 'Processo criado',
        description: `Processo salvo com ${(fd.andamentos || []).length} movimentação(ões) sincronizadas.`,
      });
    } catch (error) {
      console.error('Erro ao criar processo:', error);
      toast({
        title: "Erro ao criar",
        description: "Ocorreu um erro ao criar o processo.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCnjSearch = async () => {
    if (!cnjInput) return;
    setPartesNaoLocalizadas(false);
    setIsLoading(true);
    try {
      // Bloqueia duplicata: se o CNJ já estiver cadastrado no escritório, não busca de novo.
      const cnjLimpo = cnjInput.replace(/\D/g, '');
      if (user?.office_id && cnjLimpo) {
        const { data: jaExiste } = await supabase
          .from('processos')
          .select('id')
          .eq('office_id', user.office_id)
          .eq('numero_processo', cnjLimpo)
          .eq('deletado', false)
          .maybeSingle();
        if (jaExiste) {
          toast({
            title: 'Processo já cadastrado',
            description: 'Este número de processo já existe no seu escritório. Não é necessário cadastrar de novo.',
            variant: 'destructive',
          });
          setIsLoading(false);
          return;
        }
      }

      const { data, error } = await supabase.functions.invoke('fetch-processo', {
        body: {
          numeroProcesso: cnjInput,
          oab: (profile as any)?.oab,
          uf: (profile as any)?.oab_uf,
        },
      });

      if (error) throw error;
      if (data && !data.error) {
        setFormData((prev) => ({
          ...prev,
          titulo: (data.titulo && !data.titulo.includes('Não identificado') ? data.titulo : '') || (data.classe || '') || prev.titulo || `Processo ${cnjInput}`,
          numeroProcesso: data.numeroProcesso || cnjInput,
          tribunal: data.tribunal || '',
          vara: data.vara || '',
          comarca: data.comarca || '',
          valorCausa: data.valorCausa || 0,
          tipoProcesso: data.classe || prev.tipoProcesso || '',
          faseProcessual: data.faseProcessual || 'Fase Inicial',
          requerido: data.reu && data.reu !== 'Não identificado' ? data.reu : '',
          parteAutora: data.autor && data.autor !== 'Não identificado' ? data.autor : '',
          // (flag de partes não localizadas é setada logo após este setFormData)
          // Extras que useProcessosV2.create entende
          classe: data.classe,
          assunto: data.assunto,
          instancia: data.instancia,
          dataAjuizamento: data.dataAjuizamento,
          orgaoJulgadorCodigo: data.orgaoJulgadorCodigo,
          nivelSigilo: data.nivelSigilo,
          ultimoAndamento: data.ultimoAndamento,
          andamentos: Array.isArray(data.andamentos) ? data.andamentos : [],
          descricao: `Auto-preenchido via CNJ. Última movimentação: ${data.ultimoAndamento?.descricao?.slice(0, 200) || 'N/A'}`,
        } as any));
        const semPartes = (!data.autor || data.autor === 'Não identificado')
          && (!data.reu || data.reu === 'Não identificado');
        setPartesNaoLocalizadas(semPartes);
        setStep('form');
        toast({
          title: 'Processo encontrado!',
          description: `${data.andamentos?.length || 0} movimentação(ões) recuperada(s) do DataJud.`,
        });
      } else {
        throw new Error(data?.error || 'Processo não localizado.');
      }
    } catch (error: any) {
      console.error('Erro ao buscar CNJ:', error);
      toast({
        title: "Não encontrado",
        description: "Não conseguimos localizar este processo no DataJud. Você pode cadastrar manualmente.",
        variant: "destructive"
      });
      setStep('form');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportedSync = async (processes: any[]) => {
    try {
      for (const proc of processes) {
        // Passa o objeto completo: useProcessosV2.create já lida com
        // andamentos[], ultimoAndamento, classe, assunto, etc., e persiste
        // todas as movimentações em batch (deduplicadas via hash).
        await addProcesso({
          ...proc,
          cliente: proc.clienteDestaque || 'Importado via OAB',
          clienteId: proc.clienteId,
          status: 'Em andamento',
          descricao: `Importado via OAB. Último andamento: ${proc.ultimoAndamento?.descricao || 'N/A'}`,
        });
      }
      onSuccess?.();
      setOpen(false);
      resetForm();
    } catch (error) {
      console.error('Erro ao importar processos da OAB:', error);
      throw error;
    }
  };

  const handleChange = (field: keyof NovoProcessoForm, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const defaultTrigger = (
    <Button className="h-12 px-6 rounded-2xl font-bold bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95 flex items-center gap-2">
      <Plus className="h-5 w-5" />
      Novo Processo
    </Button>
  );

  const isControlled = controlledOpen !== undefined;

  return (
    <PermissionGuard permissions={['admin', 'owner', 'super_admin']}>
      <Dialog open={open} onOpenChange={(v) => { if(!v) resetForm(); setOpen(v); }}>
        {!isControlled && (
          <DialogTrigger asChild>
            {trigger || defaultTrigger}
          </DialogTrigger>
        )}
        
        <DialogContent className="sm:max-w-[800px] bg-background border-border shadow-2xl p-0 overflow-hidden rounded-[2rem] flex flex-col h-[90vh] max-h-[90vh]">
          <DialogHeader className="p-8 pb-5 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                  <Gavel className="h-6 w-6" />
                </div>
                <div>
                  <DialogTitle className="text-2xl font-black text-foreground">
                    Novo Processo
                  </DialogTitle>
                  <p className="text-muted-foreground text-xs font-semibold uppercase tracking-widest mt-0.5">
                    {step === 'choice' ? 'Selecione o método de entrada' :
                     step === 'oab' ? 'Sincronização via OAB' :
                     step === 'cnj_search' ? 'Busca Inteligente DataJud' : 'Cadastro Detalhado'}
                  </p>
                </div>
              </div>
              {step !== 'choice' && (
                <Button variant="ghost" size="sm" onClick={() => setStep('choice')} className="rounded-xl h-9 px-4 font-semibold text-muted-foreground hover:text-foreground transition-all">
                  Voltar
                </Button>
              )}
            </div>
          </DialogHeader>

          <div className="flex-1 min-h-0 flex flex-col">
            {step === 'oab' ? (
              <div className="flex-1 overflow-hidden flex flex-col px-8 pb-6">
                <JudicialSyncContent 
                  onImport={handleImportedSync}
                  onCancel={() => setStep('choice')}
                />
              </div>
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto px-8">
                <div className="py-8">
                  {step === 'choice' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      {/* Sincronizar OAB */}
                      <button
                        type="button"
                        onClick={() => setStep('oab')}
                        className="group relative flex flex-col items-center gap-5 p-7 rounded-2xl border border-border bg-card hover:border-indigo-400 hover:shadow-lg hover:shadow-indigo-500/10 hover:-translate-y-0.5 transition-all duration-200 text-center cursor-pointer"
                      >
                        <div className="w-14 h-14 rounded-xl bg-indigo-50 dark:bg-indigo-500/15 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:scale-110 group-hover:rotate-6 transition-all duration-200">
                          <RotateCw className="h-7 w-7" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="font-bold text-base text-foreground">Sincronizar OAB</h4>
                          <p className="text-xs text-muted-foreground leading-relaxed">Importa todos os processos<br/>vinculados ao seu número de OAB</p>
                        </div>
                        <div className="absolute bottom-0 inset-x-0 h-0.5 rounded-b-2xl bg-indigo-500 scale-x-0 group-hover:scale-x-100 transition-transform duration-200" />
                      </button>

                      {/* Buscar por CNJ */}
                      <button
                        type="button"
                        onClick={() => setStep('cnj_search')}
                        className="group relative flex flex-col items-center gap-5 p-7 rounded-2xl border border-border bg-card hover:border-emerald-400 hover:shadow-lg hover:shadow-emerald-500/10 hover:-translate-y-0.5 transition-all duration-200 text-center cursor-pointer"
                      >
                        <div className="w-14 h-14 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-200">
                          <Search className="h-7 w-7" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="font-bold text-base text-foreground">Buscar por CNJ</h4>
                          <p className="text-xs text-muted-foreground leading-relaxed">Preenche automaticamente<br/>com dados do DataJud pelo número</p>
                        </div>
                        <div className="absolute bottom-0 inset-x-0 h-0.5 rounded-b-2xl bg-emerald-500 scale-x-0 group-hover:scale-x-100 transition-transform duration-200" />
                      </button>

                      {/* Manual */}
                      <button
                        type="button"
                        onClick={() => { setPartesNaoLocalizadas(false); setStep('form'); }}
                        className="group relative flex flex-col items-center gap-5 p-7 rounded-2xl border border-border bg-card hover:border-amber-400 hover:shadow-lg hover:shadow-amber-500/10 hover:-translate-y-0.5 transition-all duration-200 text-center cursor-pointer"
                      >
                        <div className="w-14 h-14 rounded-xl bg-amber-50 dark:bg-amber-500/15 flex items-center justify-center text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-all duration-200">
                          <Plus className="h-7 w-7" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="font-bold text-base text-foreground">Manual</h4>
                          <p className="text-xs text-muted-foreground leading-relaxed">Preencha os dados<br/>do processo manualmente</p>
                        </div>
                        <div className="absolute bottom-0 inset-x-0 h-0.5 rounded-b-2xl bg-amber-500 scale-x-0 group-hover:scale-x-100 transition-transform duration-200" />
                      </button>
                    </div>
                  )}

                  {step === 'cnj_search' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                      <div className="text-center space-y-2">
                         <h3 className="text-xl font-bold text-foreground">Busca Automática CNJ</h3>
                         <p className="text-sm text-muted-foreground">Informe o número do processo para preenchimento inteligente</p>
                      </div>

                      <div className="max-w-md mx-auto space-y-4">
                        <div className="space-y-2">
                          <Label>Número do Processo (CNJ)</Label>
                          <Input
                            placeholder="0000000-00.0000.0.00.0000"
                            value={cnjInput}
                            onChange={(e) => setCnjInput(formatCNJ(e.target.value))}
                            className="h-12 rounded-xl font-mono text-center tracking-widest text-lg"
                          />
                        </div>
                        <Button
                          className="w-full h-12 rounded-xl font-bold"
                          onClick={handleCnjSearch}
                          disabled={isLoading || cnjInput.length < 15}
                        >
                          {isLoading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Search className="h-5 w-5 mr-2" />}
                          {isLoading ? "Buscando dados..." : "Buscar e Avançar"}
                        </Button>
                      </div>
                    </div>
                  )}

                  {step === 'form' && (
                    <form onSubmit={handleSubmit} className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-700 pb-10">
                      {partesNaoLocalizadas && (
                        <div className="flex items-start gap-3 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
                          <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-bold text-yellow-600 dark:text-yellow-400">Partes não localizadas</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              O autor e o réu não foram encontrados na base pública (possível segredo de justiça ou cadastro incompleto no tribunal). Preencha o Polo Ativo e o Polo Passivo manualmente antes de salvar.
                            </p>
                          </div>
                        </div>
                      )}
                      {/* Seção 1: Identificação Básica */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
                            <Info className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <h3 className="text-base font-bold text-foreground">Identificação Básica</h3>
                            <p className="text-xs text-muted-foreground">Informações essenciais de registro</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5 rounded-xl bg-muted/30 border border-border">
                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="titulo">Título do Processo *</Label>
                            <Input
                              id="titulo"
                              required
                              value={formData.titulo}
                              onChange={(e) => handleChange('titulo', e.target.value)}
                              placeholder="Ex: Ação Trabalhista - Cliente X"
                              className="h-11 rounded-xl"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="cliente">Cliente / Autor *</Label>
                            <Input
                              id="cliente"
                              required
                              value={formData.cliente}
                              onChange={(e) => handleChange('cliente', e.target.value)}
                              placeholder="Nome do cliente"
                              className="h-11 rounded-xl"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="numeroProcesso">Número do Processo (CNJ)</Label>
                            <Input
                              id="numeroProcesso"
                              value={formData.numeroProcesso || ''}
                              onChange={(e) => handleChange('numeroProcesso', formatCNJ(e.target.value))}
                              placeholder="0000000-00.0000.0.00.0000"
                              className="font-mono h-11 rounded-xl text-primary"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Seção 2: Capa Jurídica */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20">
                            <Gavel className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                          </div>
                          <div>
                            <h3 className="text-base font-bold text-foreground">Capa Jurídica</h3>
                            <p className="text-xs text-muted-foreground">Dados de localização do processo</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5 rounded-xl bg-muted/30 border border-border">
                          <div className="space-y-2">
                            <Label htmlFor="tribunal">Tribunal / Instância</Label>
                            <Input id="tribunal" value={formData.tribunal || ''} onChange={(e) => handleChange('tribunal', e.target.value)} className="h-11 rounded-xl" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="vara">Vara / Secretaria</Label>
                            <Input id="vara" value={formData.vara || ''} onChange={(e) => handleChange('vara', e.target.value)} className="h-11 rounded-xl" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="parteAutora">Polo Ativo (Autor / Requerente)</Label>
                            <Input id="parteAutora" value={(formData as any).parteAutora || ''} onChange={(e) => handleChange('parteAutora' as any, e.target.value)} placeholder="Não localizado — preencha manualmente" className="h-11 rounded-xl" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="requerido">Polo Passivo (Réu / Requerido)</Label>
                            <Input id="requerido" value={formData.requerido || ''} onChange={(e) => handleChange('requerido', e.target.value)} placeholder="Não localizado — preencha manualmente" className="h-11 rounded-xl" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="valorCausa">Valor da Causa</Label>
                            <Input id="valorCausa" type="number" value={formData.valorCausa || 0} onChange={(e) => handleChange('valorCausa', Number(e.target.value))} className="h-11 rounded-xl" />
                          </div>
                        </div>
                      </div>

                      <DialogFooter className="pt-2">
                        <Button variant="ghost" type="button" onClick={() => setStep('choice')}>Cancelar</Button>
                        <Button type="submit" disabled={isLoading || isLimitReached} className="px-8">
                          {isLoading ? "Salvando..." : "Finalizar Cadastro"}
                        </Button>
                      </DialogFooter>
                    </form>
                  )}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </PermissionGuard>
  );
};
