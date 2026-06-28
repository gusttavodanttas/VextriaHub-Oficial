import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RotateCw, Search, Plus, ArrowLeft, Loader2, Info, Gavel } from 'lucide-react';
import { JudicialSyncContent, JudicialProcessResult } from './JudicialSyncDialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatCNJ } from '@/lib/formatters';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useProcessosV2 } from '@/hooks/useProcessosV2';
import { useAuth } from '@/contexts/AuthContext';

interface ProcessoIntegracaoPanelProps {
  // Modo "Dialog controlado" usado pela página Processos
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  // Modo legado (callback) — opcional
  onAddProcesso?: (processo: any) => Promise<void>;
  onSuccess?: () => void;
}

export const ProcessoIntegracaoPanel: React.FC<ProcessoIntegracaoPanelProps> = ({
  open,
  onOpenChange,
  onAddProcesso,
  onSuccess,
}) => {
  const isDialogMode = open !== undefined;
  const { create } = useProcessosV2();

  // Lida tanto com array (vindo do JudicialSyncContent) quanto objeto (vindo do form manual)
  const handleAdd = async (input: any) => {
    if (onAddProcesso) {
      await onAddProcesso(input);
      return;
    }
    if (Array.isArray(input)) {
      for (const proc of input) {
        await create(proc);
      }
    } else {
      await create(input);
    }
  };

  const handleSuccess = () => {
    if (onSuccess) onSuccess();
    if (onOpenChange) onOpenChange(false);
  };

  const body = (
    <ProcessoIntegracaoBody onAddProcesso={handleAdd} onSuccess={handleSuccess} />
  );

  if (isDialogMode) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent aria-describedby={undefined} className="max-w-[1280px] w-[95vw] bg-background border border-border p-0 overflow-hidden flex flex-col h-[90vh] max-h-[90vh] shadow-2xl rounded-[2rem]">
          <div className="flex-1 overflow-y-auto px-8 py-6">
            {body}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return body;
};

interface ProcessoIntegracaoBodyProps {
  onAddProcesso: (processo: any) => Promise<void>;
  onSuccess: () => void;
}

const ProcessoIntegracaoBody: React.FC<ProcessoIntegracaoBodyProps> = ({
  onAddProcesso,
  onSuccess,
}) => {
  const [mode, setMode] = useState<'choice' | 'oab' | 'cnj' | 'manual'>('choice');
  const [cnjLoading, setCnjLoading] = useState(false);
  const [cnjInput, setCnjInput] = useState('');
  const [capturedData, setCapturedData] = useState<any>(null);
  const { toast } = useToast();
  const { profile } = useAuth();

  const handleCnjSearch = async () => {
    if (!cnjInput) return;
    setCnjLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-processo', {
        body: {
          numeroProcesso: cnjInput,
          oab: (profile as any)?.oab,
          uf: (profile as any)?.oab_uf,
        }
      });

      if (error) {
        throw new Error(error.message || 'Erro ao buscar processo na integração.');
      }
      if (data) {
        setCapturedData(data);
        toast({
          title: "Processo encontrado!",
          description: "Dados básicos capturados. Finalize o cadastro abaixo.",
        });
        setMode('manual');
      } else {
        throw new Error("Dados não retornados pela API.");
      }
    } catch (error: any) {
      console.error('Erro ao buscar CNJ:', error);
      toast({
        title: "Não encontrado",
        description: error.message || "Não conseguimos localizar este processo. Verifique o número ou cadastre manualmente.",
        variant: "destructive"
      });
      // Mesmo com erro, permite ir pro manual se quiser
      if (error.message?.includes('não localizado')) {
          setMode('manual');
      }
    } finally {
      setCnjLoading(false);
    }
  };

  if (mode === 'manual') {
    return (
      <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-500">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => {
            setMode('choice');
            setCapturedData(null);
          }} className="rounded-full hover:bg-black/5 dark:hover:bg-muted/40 transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-2xl font-black text-foreground">Finalizar Cadastro</h2>
            <p className="text-muted-foreground/60 text-sm font-medium">Revise os dados capturados e complete o registro</p>
          </div>
        </div>
        
        <div className="max-w-4xl mx-auto w-full">
          <ManualProcessoForm 
            initialData={capturedData} 
            onSave={async (data) => {
              await onAddProcesso(data);
              onSuccess();
            }}
            onCancel={() => {
              setMode('choice');
              setCapturedData(null);
            }}
          />
        </div>
      </div>
    );
  }

  if (mode === 'oab') {
    return (
      <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-500">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => setMode('choice')} className="rounded-full hover:bg-black/5 dark:hover:bg-muted/40 transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-2xl font-black text-foreground">Sincronização via OAB</h2>
            <p className="text-muted-foreground/60 text-sm font-medium">Busca automática em tribunais (PJE/DataJud)</p>
          </div>
        </div>
        <div className="flex-1 bg-muted/10 rounded-[2rem] border border-border p-8 shadow-premium min-h-[600px] flex flex-col">
          <JudicialSyncContent 
            onImport={async (procs) => {
              await onAddProcesso(procs);
              onSuccess();
            }}
            onCancel={() => setMode('choice')}
          />
        </div>
      </div>
    );
  }

  if (mode === 'cnj') {
    return (
      <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-500">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => setMode('choice')} className="rounded-full hover:bg-black/5 dark:hover:bg-muted/40 transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-2xl font-black text-foreground">Busca Inteligente CNJ</h2>
            <p className="text-muted-foreground/60 text-sm font-medium">Preenchimento automático via número do processo</p>
          </div>
        </div>
        
        <Card className="max-w-2xl mx-auto w-full p-12 bg-card border border-border rounded-[2.5rem] shadow-premium">
          <div className="space-y-8 text-center">
            <div className="mx-auto w-20 h-20 rounded-3xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <Search className="h-10 w-10" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black tracking-tight">Informe o número CNJ</h3>
              <p className="text-sm text-muted-foreground/60 font-medium px-4">Utilizaremos nossa IA para buscar todos os dados da capa do processo instantaneamente.</p>
            </div>
            
            <div className="space-y-4 max-w-md mx-auto">
              <div className="space-y-2 text-left">
                <Label className="text-foreground ml-1">Número do Processo</Label>
                <Input 
                  placeholder="0000000-00.0000.0.00.0000"
                  value={cnjInput}
                  onChange={(e) => setCnjInput(formatCNJ(e.target.value))}
                  className="h-14 bg-background border-border text-foreground rounded-2xl font-mono text-center tracking-widest text-xl"
                />
              </div>
              <Button 
                className="w-full h-14 rounded-2xl font-bold text-lg bg-emerald-600 hover:bg-emerald-500" 
                onClick={handleCnjSearch}
                disabled={cnjLoading || cnjInput.length < 15}
              >
                {cnjLoading ? <Loader2 className="h-6 w-6 animate-spin mr-2" /> : <Search className="h-6 w-6 mr-2" />}
                {cnjLoading ? "Consultando..." : "Consultar e Avançar"}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-10 py-10 animate-in fade-in duration-700">
      <div className="text-center space-y-4 max-w-2xl mx-auto">
        <h2 className="text-4xl md:text-5xl font-black tracking-tight">
          Como deseja{" "}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
            iniciar?
          </span>
        </h2>
        <p className="text-muted-foreground/60 text-lg font-medium">
          Escolha o método mais eficiente para adicionar seus processos à plataforma.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto px-4">
        {/* Card OAB Premium */}
        <Card 
          className="group relative overflow-hidden cursor-pointer bg-card border border-border hover:border-primary/30 transition-all p-10 space-y-6 rounded-[3rem] shadow-premium hover:shadow-2xl hover:-translate-y-2"
          onClick={() => setMode('oab')}
        >
          <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-10 transition-opacity">
            <RotateCw className="h-24 w-24 -mr-8 -mt-8" />
          </div>
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform shadow-inner">
            <RotateCw className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h4 className="text-2xl font-black text-foreground uppercase tracking-tight">Sincronismo OAB</h4>
            <p className="text-sm text-muted-foreground/60 leading-relaxed font-medium">
              Busca automática em diversos tribunais simultaneamente através da sua OAB. Ideal para migrações em massa.
            </p>
          </div>
          <div className="pt-4">
            <Button className="w-full rounded-2xl font-black uppercase tracking-widest text-[10px] h-12 group-hover:bg-primary group-hover:text-foreground transition-all border-border" variant="outline">
              Iniciar Sincronismo
            </Button>
          </div>
        </Card>

        {/* Card CNJ Premium */}
        <Card 
          className="group relative overflow-hidden cursor-pointer bg-card border border-border hover:border-emerald-500/30 transition-all p-10 space-y-6 rounded-[3rem] shadow-premium hover:shadow-2xl hover:-translate-y-2"
          onClick={() => setMode('cnj')}
        >
          <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-10 transition-opacity">
            <Search className="h-24 w-24 -mr-8 -mt-8" />
          </div>
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform shadow-inner">
            <Search className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h4 className="text-2xl font-black text-foreground uppercase tracking-tight">Busca por CNJ</h4>
            <p className="text-sm text-muted-foreground/60 leading-relaxed font-medium">
              Informe o número e deixe que nossa IA busque o processo e preencha todos os dados da capa automaticamente.
            </p>
          </div>
          <div className="pt-4">
            <Button className="w-full rounded-2xl font-black uppercase tracking-widest text-[10px] h-12 group-hover:bg-emerald-600 dark:group-hover:bg-emerald-500 group-hover:text-foreground transition-all border-border" variant="outline">
              Buscar Processo
            </Button>
          </div>
        </Card>

        {/* Card Manual Premium */}
        <Card 
          className="group relative overflow-hidden cursor-pointer bg-card border border-border hover:border-amber-500/30 transition-all p-10 space-y-6 rounded-[3rem] shadow-premium hover:shadow-2xl hover:-translate-y-2 min-h-[320px] flex flex-col justify-between"
          onClick={() => setMode('manual')}
        >
          <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-10 transition-opacity">
            <Plus className="h-24 w-24 -mr-8 -mt-8" />
          </div>
          <div>
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform mb-6 shadow-inner">
              <Plus className="h-8 w-8" />
            </div>
            <div className="space-y-2">
              <h4 className="text-2xl font-black text-foreground uppercase tracking-tight">Cadastro Manual</h4>
              <p className="text-sm text-muted-foreground/60 leading-relaxed font-medium">
                Controle total e imediato. Insira cada detalhe do processo manualmente sem depender de buscas.
              </p>
            </div>
          </div>
          <div className="pt-4">
            <Button className="w-full rounded-2xl font-black uppercase tracking-widest text-[10px] h-12 group-hover:bg-amber-600 dark:group-hover:bg-amber-500 group-hover:text-foreground transition-all border-border" variant="outline">
              Cadastrar Agora
            </Button>
          </div>
        </Card>
      </div>

      <div className="max-w-xl mx-auto p-6 rounded-3xl bg-blue-500/5 border border-blue-500/20 flex flex-col md:flex-row items-center gap-4 text-xs text-foreground">
        <Info className="h-6 w-6 shrink-0 text-blue-500" />
        <p className="text-center md:text-left leading-relaxed">
          <span className="font-bold text-blue-400">Nota Jurídica:</span> A sincronização judicial consome créditos do seu plano. Novos advogados possuem limites diferenciados para a busca profunda da OAB.
        </p>
      </div>
    </div>
  );
};

interface ManualProcessoFormProps {
  initialData?: any;
  onSave: (data: any) => Promise<void>;
  onCancel: () => void;
}

const ManualProcessoForm: React.FC<ManualProcessoFormProps> = ({ initialData, onSave, onCancel }) => {
  const [loading, setLoading] = useState(false);
  const i: any = initialData || {};
  const [formData, setFormData] = useState<any>({
    titulo: i.titulo || '',
    numeroProcesso: i.numeroProcesso || '',
    status: 'Em andamento',
    tipoProcesso: i.classe || i.tipoProcesso || 'Cível',
    tribunal: i.tribunal || '',
    comarca: i.comarca || '',
    vara: i.vara || '',
    requerido: i.reu || i.requerido || '',
    parteAutora: i.autor || i.parteAutora || '',
    valorCausa: i.valorCausa || 0,
    descricao: i.descricao || i.ultimoAndamento?.descricao || '',
    // Extras que useProcessosV2.create entende
    classe: i.classe,
    assunto: i.assunto,
    faseProcessual: i.faseProcessual,
    instancia: i.instancia,
    dataAjuizamento: i.dataAjuizamento,
    orgaoJulgadorCodigo: i.orgaoJulgadorCodigo,
    nivelSigilo: i.nivelSigilo,
    ultimoAndamento: i.ultimoAndamento,
    andamentos: Array.isArray(i.andamentos) ? i.andamentos : [],
  });

  // Re-popula quando initialData muda (ex: depois de buscar CNJ)
  useEffect(() => {
    if (!initialData) return;
    const x: any = initialData;
    setFormData((prev: any) => ({
      ...prev,
      titulo: x.titulo || prev.titulo,
      numeroProcesso: x.numeroProcesso || prev.numeroProcesso,
      tipoProcesso: x.classe || x.tipoProcesso || prev.tipoProcesso,
      tribunal: x.tribunal || prev.tribunal,
      comarca: x.comarca || prev.comarca,
      vara: x.vara || prev.vara,
      requerido: x.reu || x.requerido || prev.requerido,
      parteAutora: x.autor || x.parteAutora || prev.parteAutora,
      valorCausa: x.valorCausa || prev.valorCausa,
      descricao: x.descricao || x.ultimoAndamento?.descricao || prev.descricao,
      classe: x.classe ?? prev.classe,
      assunto: x.assunto ?? prev.assunto,
      faseProcessual: x.faseProcessual ?? prev.faseProcessual,
      instancia: x.instancia ?? prev.instancia,
      dataAjuizamento: x.dataAjuizamento ?? prev.dataAjuizamento,
      orgaoJulgadorCodigo: x.orgaoJulgadorCodigo ?? prev.orgaoJulgadorCodigo,
      nivelSigilo: x.nivelSigilo ?? prev.nivelSigilo,
      ultimoAndamento: x.ultimoAndamento ?? prev.ultimoAndamento,
      andamentos: Array.isArray(x.andamentos) ? x.andamentos : prev.andamentos,
    }));
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave(formData);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-8 bg-card border border-border rounded-[2.5rem] shadow-premium">
      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2 md:col-span-2">
            <Label className="text-muted-foreground/60 ml-1 font-black uppercase tracking-widest text-[10px]">Título do Processo / Autor *</Label>
            <Input 
              required
              value={formData.titulo}
              onChange={(e) => setFormData({...formData, titulo: e.target.value})}
              placeholder="Ex: João da Silva x Banco SA"
              className="h-12 bg-background border-border text-foreground rounded-xl focus:ring-4 focus:ring-primary/10 font-bold transition-all"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-muted-foreground/60 ml-1 font-black uppercase tracking-widest text-[10px]">Número do Processo (CNJ)</Label>
            <Input 
              value={formData.numeroProcesso}
              onChange={(e) => setFormData({...formData, numeroProcesso: formatCNJ(e.target.value)})}
              placeholder="0000000-00.0000.0.00.0000"
              className="h-12 bg-background border-border text-foreground rounded-xl font-mono font-bold tracking-wider"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-muted-foreground/60 ml-1 font-black uppercase tracking-widest text-[10px]">Tipo / Classe Processual</Label>
            <Input 
              value={formData.tipoProcesso}
              onChange={(e) => setFormData({...formData, tipoProcesso: e.target.value})}
              placeholder="Ex: Procedimento Comum Cível"
              className="h-12 bg-background border-border text-foreground rounded-xl font-bold"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-muted-foreground/60 ml-1 font-black uppercase tracking-widest text-[10px]">Tribunal</Label>
            <Input 
              value={formData.tribunal}
              onChange={(e) => setFormData({...formData, tribunal: e.target.value})}
              placeholder="Ex: TJSP"
              className="h-12 bg-background border-border text-foreground rounded-xl font-bold"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-muted-foreground/60 ml-1 font-black uppercase tracking-widest text-[10px]">Vara / Secretaria</Label>
            <Input 
              value={formData.vara}
              onChange={(e) => setFormData({...formData, vara: e.target.value})}
              placeholder="Ex: 2ª Vara Cível"
              className="h-12 bg-background border-border text-foreground rounded-xl font-bold"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-muted-foreground/60 ml-1 font-black uppercase tracking-widest text-[10px]">Comarca</Label>
            <Input 
              value={formData.comarca}
              onChange={(e) => setFormData({...formData, comarca: e.target.value})}
              placeholder="Ex: São Paulo"
              className="h-12 bg-background border-border text-foreground rounded-xl font-bold"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-muted-foreground/60 ml-1 font-black uppercase tracking-widest text-[10px]">Polo Ativo (Autor / Requerente)</Label>
            <Input
              value={formData.parteAutora}
              onChange={(e) => setFormData({ ...formData, parteAutora: e.target.value })}
              placeholder="Ex: João da Silva"
              className="h-12 bg-background border-border text-foreground rounded-xl font-bold"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-muted-foreground/60 ml-1 font-black uppercase tracking-widest text-[10px]">Polo Passivo (Réu / Requerido)</Label>
            <Input
              value={formData.requerido}
              onChange={(e) => setFormData({...formData, requerido: e.target.value})}
              placeholder="Ex: Empresa de Energia S.A."
              className="h-12 bg-background border-border text-foreground rounded-xl font-bold"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label className="text-muted-foreground/60 ml-1 font-black uppercase tracking-widest text-[10px]">Observações / Último Andamento</Label>
            <Textarea 
              value={formData.descricao}
              onChange={(e) => setFormData({...formData, descricao: e.target.value})}
              placeholder="Informações adicionais sobre o processo..."
              className="bg-background border-border text-foreground rounded-xl min-h-[100px] font-medium"
            />
          </div>
        </div>

        <div className="flex gap-4 pt-4">
          <Button 
            type="button" 
            variant="ghost" 
            onClick={onCancel}
            className="flex-1 h-14 rounded-2xl font-black uppercase tracking-widest text-[10px] text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-all"
          >
            Cancelar
          </Button>
          <Button 
            disabled={loading}
            type="submit" 
            className="flex-1 h-14 rounded-2xl bg-primary hover:bg-primary/90 font-black uppercase tracking-widest text-[10px] shadow-premium transition-all"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Concluir Cadastro"}
          </Button>
        </div>
      </form>
    </Card>
  );
};
