import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Gavel } from 'lucide-react';
import { usePlanLimits } from '@/hooks/usePlanFeatures';
import { getErrorMessage } from '@/lib/errors';
import { captureError } from '@/lib/monitoring';
import { planQuotaMessage } from '@/lib/planQuotaError';
import { useToast } from '@/hooks/use-toast';
import { PermissionGuard } from '@/components/Auth/PermissionGuard';
import { useOfficeUsers } from '@/hooks/useOfficeUsers';
import { useOfficeTeams } from '@/hooks/useOfficeTeams';
import { useAuth } from '@/contexts/AuthContext';
import type { ProcessoCreateInput, FetchProcessoResposta } from '@/types/processo';
import { useOfficeSettingList } from '@/hooks/useOfficeSettingList';
import { TIPOS_PROCESSO_DEFAULT, type TipoProcesso } from '@/components/Settings/ProcessTypeSimple';
import { tribunalFromCNJ } from '@/utils/tribunalCNJ';
import { JudicialSyncContent } from './JudicialSyncDialog';
import { MetodoEntrada } from './NovoProcesso/MetodoEntrada';
import { BuscaCnj } from './NovoProcesso/BuscaCnj';
import { FormularioProcesso } from './NovoProcesso/FormularioProcesso';
import type { ProcessoParaImportar } from './JudicialSync/types';
import { useProcessosV2 } from '@/hooks/useProcessosV2';
import { useClientes } from '@/hooks/useClientes';
import { supabase } from '@/integrations/supabase/client';

interface NovoProcessoDialogProps {
  // Opcional: se não passado, usamos useProcessosV2.create direto
  onAddProcesso?: (processo: ProcessoCreateInput) => Promise<unknown> | unknown;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialData?: Partial<ProcessoCreateInput>;
  onSuccess?: () => void;
  // Abre direto num passo específico (ex.: 'form' ao vir da caixa "Encontrados")
  initialStep?: 'choice' | 'oab' | 'cnj_search' | 'form';
}

export const NovoProcessoDialog: React.FC<NovoProcessoDialogProps> = ({
  onAddProcesso,
  trigger,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  initialData,
  onSuccess,
  initialStep,
}) => {
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const { limits } = usePlanLimits();
  const { users: teamMembers } = useOfficeUsers();
  const { teams: officeTeams } = useOfficeTeams();
  const { addMovimentacao, create } = useProcessosV2({ lista: false });
  const { data: clientesData = [] } = useClientes();
  // Tipos de processo cadastrados em Config → Processos (antes essa lista não era lida em lugar nenhum)
  const { items: tiposProcessoCfg, persist: persistTipos } = useOfficeSettingList<TipoProcesso>('tipos_processo', TIPOS_PROCESSO_DEFAULT);

  // Wrapper: usa o callback do pai se existir; senão chama create() direto.
  const addProcesso = async (proc: ProcessoCreateInput) => {
    if (onAddProcesso) {
      return await onAddProcesso(proc);
    }
    return await create(proc);
  };
  const isLimitReached = limits.processes.isReached;
  
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = setControlledOpen ?? setInternalOpen;
  const [step, setStep] = useState<'choice' | 'oab' | 'cnj' | 'cnj_search' | 'form'>(initialStep ?? 'choice');
  const [isLoading, setIsLoading] = useState(false);
  const [cnjInput, setCnjInput] = useState('');
  // Sinaliza que a busca rodou mas não localizou as partes (sigilo/sem cadastro)
  const [partesNaoLocalizadas, setPartesNaoLocalizadas] = useState(false);
  
  const [formData, setFormData] = useState<ProcessoCreateInput>({
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
    requerido: initialData?.requerido || initialData?.reu || '',
    parteAutora: initialData?.parteAutora || initialData?.autor || '',
    segredoJustica: false,
    justicaGratuita: false,
    teamId: '',
  });

  // Auto-preenche teamId com a primeira equipe do usuário logado
  React.useEffect(() => {
    if (officeTeams.length === 0) return;
    setFormData(prev => {
      if (prev.teamId) return prev;
      // Deixa em branco — o trigger do banco preenche pelo responsavelId
      return prev;
    });
  }, [officeTeams]);

  // Auto-vínculo: se a parte autora/ré bate com um cliente do cadastro, vincula sozinho
  React.useEffect(() => {
    if (formData.clienteId) return;
    const norm = (s: string | null | undefined) => (s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').trim();
    const autor = norm(formData.parteAutora);
    const reu = norm(formData.requerido);
    if (!autor && !reu) return;
    const match = clientesData.find((c) => {
      const n = norm(c.nome);
      if (!n || n.length < 4) return false; // evita match por nomes muito curtos
      return n === autor || n === reu || (autor && autor.includes(n)) || (reu && reu.includes(n));
    });
    if (match) setFormData((prev) => ({ ...prev, clienteId: match.id, cliente: match.nome }));
  }, [clientesData, formData.parteAutora, formData.requerido]);

  // Reseta formData a partir do initialData sempre que ele chega/muda.
  // Aceita tanto chaves canônicas (parteAutora/requerido) quanto raw da edge function (autor/reu).
  React.useEffect(() => {
    if (!initialData) return;
    const i = initialData;
    setFormData((prev) => ({
      ...prev,
      titulo: i.titulo || prev.titulo || '',
      cliente: i.cliente || prev.cliente || '',
      clienteId: i.clienteId || prev.clienteId,
      status: i.status || prev.status || 'Em andamento',
      proximoPrazo: i.proximoPrazo || prev.proximoPrazo || '',
      descricao: i.descricao || prev.descricao || '',
      valorCausa: typeof i.valorCausa === 'number' ? i.valorCausa : (prev.valorCausa || 0),
      numeroProcesso: i.numeroProcesso || prev.numeroProcesso || '',
      tipoProcesso: i.tipoProcesso || i.classe || prev.tipoProcesso || '',
      faseProcessual: i.faseProcessual || prev.faseProcessual || 'Fase Inicial',
      responsavelId: prev.responsavelId || user?.id || '',
      tribunal: tribunalFromCNJ(i.numeroProcesso || prev.numeroProcesso) || i.tribunal || prev.tribunal || '',
      vara: i.vara || prev.vara || '',
      comarca: i.comarca || prev.comarca || '',
      requerido: i.requerido || i.reu || prev.requerido || '',
      parteAutora: i.parteAutora || i.autor || prev.parteAutora || '',
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
    }));
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
    });
    setStep('choice');
    setCnjInput('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLimitReached) return;
    
    setIsLoading(true);
    try {
      const fd = formData;

      // Rede de segurança contra duplicata ao salvar (ex: CNJ digitado manualmente)
      const cnjLimpo = (fd.numeroProcesso || '').replace(/\D/g, '');
      if (user?.office_id && cnjLimpo) {
        const { data: jaExiste, error: dupErr } = await supabase
          .from('processos')
          .select('id')
          .eq('office_id', user.office_id)
          .eq('numero_processo', cnjLimpo)
          .eq('deletado', false)
          .maybeSingle();
          // Sem isto, a falha virava "não existe" e o cadastro seguia em dobro.
          if (dupErr) throw dupErr;
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
      const quota = planQuotaMessage(error);
      toast({
        title: quota?.title ?? "Erro ao criar",
        description: quota?.description ?? getErrorMessage(error, "Ocorreu um erro ao criar o processo."),
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
    let naoLocalizado = false;
    try {
      // Bloqueia duplicata: se o CNJ já estiver cadastrado no escritório, não busca de novo.
      const cnjLimpo = cnjInput.replace(/\D/g, '');
      if (user?.office_id && cnjLimpo) {
        const { data: jaExiste, error: dupErr } = await supabase
          .from('processos')
          .select('id')
          .eq('office_id', user.office_id)
          .eq('numero_processo', cnjLimpo)
          .eq('deletado', false)
          .maybeSingle();
          // Sem isto, a falha virava "não existe" e o cadastro seguia em dobro.
          if (dupErr) throw dupErr;
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
          oab: profile?.oab,
          uf: profile?.oab_uf,
        },
      });

      if (error) throw error;
      const resposta = data as FetchProcessoResposta | null;
      if (resposta && !resposta.error) {
        const data = resposta;
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
        }));
        const semPartes = (!data.autor || data.autor === 'Não identificado')
          && (!data.reu || data.reu === 'Não identificado');
        setPartesNaoLocalizadas(semPartes);
        setStep('form');
        toast({
          title: 'Processo encontrado!',
          description: `${data.andamentos?.length || 0} movimentação(ões) recuperada(s) do DataJud.`,
        });
      } else {
        naoLocalizado = true;
        throw new Error(data?.error || 'Processo não localizado.');
      }
    } catch (error: unknown) {
      // Distingue "o DataJud não tem esse processo" de "a consulta falhou" (rede,
      // função fora do ar) — antes tudo virava "Não encontrado".
      if (!naoLocalizado) captureError(error, { context: 'NovoProcessoDialog.handleCnjSearch' });
      toast({
        title: naoLocalizado ? "Não encontrado" : "Não foi possível consultar agora",
        description: naoLocalizado
          ? "Não conseguimos localizar este processo no DataJud. Você pode cadastrar manualmente."
          : `${getErrorMessage(error, "Falha na consulta.")} Tente de novo ou cadastre manualmente.`,
        variant: "destructive"
      });
      setStep('form');
    } finally {
      setIsLoading(false);
    }
  };

  // Erros sobem para quem chamou (o dialog de importação), que mostra o toast.
  const handleImportedSync = async (processes: ProcessoParaImportar[]) => {
    for (const proc of processes) {
      // Passa o objeto completo: useProcessosV2.create já lida com
      // andamentos[], ultimoAndamento, classe, assunto, etc., e persiste
      // todas as movimentações em batch (deduplicadas via hash).
      await addProcesso({
        ...proc,
        cliente: 'Importado via OAB',
        clienteId: proc.clienteId ?? undefined,
        status: 'Em andamento',
        descricao: `Importado via OAB. Último andamento: ${proc.ultimoAndamento?.descricao || 'N/A'}`,
      });
    }
    onSuccess?.();
    setOpen(false);
    resetForm();
  };

  const handleChange = <K extends keyof ProcessoCreateInput>(field: K, value: ProcessoCreateInput[K]) => {
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
    <PermissionGuard permission="canCreateProcesses">
      <Dialog open={open} onOpenChange={(v) => { if(!v) resetForm(); setOpen(v); }}>
        {!isControlled && (
          <DialogTrigger asChild>
            {trigger || defaultTrigger}
          </DialogTrigger>
        )}
        
        <DialogContent
          className="sm:max-w-[800px] bg-background border-border shadow-2xl p-0 overflow-hidden rounded-[2rem] flex flex-col h-[90vh] max-h-[90vh]"
          onInteractOutside={(e) => e.preventDefault()}
        >
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
                    <MetodoEntrada onEscolher={(m) => { if (m === 'form') setPartesNaoLocalizadas(false); setStep(m); }} />
                  )}

                  {step === 'cnj_search' && (
                    <BuscaCnj cnjInput={cnjInput} setCnjInput={setCnjInput} isLoading={isLoading} onBuscar={handleCnjSearch} />
                  )}

                  {step === 'form' && (
                    <FormularioProcesso formData={formData} setFormData={setFormData} handleChange={handleChange}
                      partesNaoLocalizadas={partesNaoLocalizadas} tiposProcessoCfg={tiposProcessoCfg} persistTipos={persistTipos}
                      officeTeams={officeTeams} teamMembers={teamMembers} user={user} isLimitReached={isLimitReached}
                      limiteProcessos={limits.processes.max} isLoading={isLoading} onSubmit={handleSubmit} onCancel={() => setStep('choice')} />
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
