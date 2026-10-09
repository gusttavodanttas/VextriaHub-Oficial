import { useState, useEffect, useRef } from "react";
import { AvisoDiasSelect } from "@/components/Notifications/AvisoDiasSelect";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/rows";
import { useAuth } from "@/contexts/AuthContext";
import { CalendarClock, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { prazoFormSchema, firstZodError } from "@/lib/validation";
import { planQuotaMessage } from "@/lib/planQuotaError";
import { assertRowsAffected, getErrorMessage } from "@/lib/errors";
import { useOfficeUsers } from "@/hooks/useOfficeUsers";
import { carregarTiposAto, type TipoAto } from "@/lib/tiposAtoPrazo";
import { addDiasUteisWith, addDiasCorridos, toISO } from "@/lib/prazoCalc";
import {
  DATE_FIELDS, emptyForm, prazoToForm, separarFeriados,
  type DateKey, type FormState, type PrazoFormData, type ProcessoOption,
} from "@/components/Prazos/prazoForm";
import { PrazoDatePicker } from "@/components/Prazos/PrazoDatePicker";
import { CalculadoraPrazo } from "@/components/Prazos/CalculadoraPrazo";
import { GerenciarTiposModal } from "@/components/Prazos/GerenciarTiposModal";

// Diálogo de agendar/editar prazo. Este arquivo guarda o estado, o cálculo de
// datas e o submit; DatePicker, calculadora, modal de tipos de ato e helpers
// do formulário vivem em src/components/Prazos/.
//
// Re-exports mantidos: Prazos.tsx importa PrazoFormData daqui e
// Settings/DeadlineConfig importa GerenciarTiposModal daqui.
export type { PrazoFormData } from "@/components/Prazos/prazoForm";
export type { TipoAto } from "@/lib/tiposAtoPrazo";
export { GerenciarTiposModal } from "@/components/Prazos/GerenciarTiposModal";

interface NovoPrazoStandaloneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  publicacaoId?: string;
  numeroProcesso?: string;
  tituloSugerido?: string;
  prazoParaEditar?: PrazoFormData;
}

export const NovoPrazoStandaloneDialog = ({
  open, onOpenChange, onSuccess, publicacaoId, numeroProcesso, tituloSugerido, prazoParaEditar,
}: NovoPrazoStandaloneDialogProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { users: officeUsers } = useOfficeUsers();
  const membros = officeUsers.map(u => ({
    id: u.user_id,
    label: u.profile?.full_name || u.profile?.email || "Membro",
  }));
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<FormState>(emptyForm(tituloSugerido, numeroProcesso, user?.id));
  const [tipoAto, setTipoAto] = useState('');
  const [dobro, setDobro] = useState(false);
  const [calculoAplicado, setCalculoAplicado] = useState(false);
  const [gerenciarOpen, setGerenciarOpen] = useState(false);
  const [tipos, setTipos] = useState<TipoAto[]>([]);
  const [feriadosAnual, setFeriadosAnual] = useState<Set<string>>(new Set());
  const [feriadosData, setFeriadosData] = useState<Set<string>>(new Set());

  const fetchFeriados = async () => {
    if (!user?.office_id) return;
    const { data } = await supabase.from('offices').select('settings').eq('id', user.office_id).maybeSingle();
    const arr = ((data?.settings as any)?.prazo_feriados as string[]) ?? [];
    const { anual, esp } = separarFeriados(arr);
    setFeriadosAnual(anual); setFeriadosData(esp);
  };

  const isEditing = !!prazoParaEditar?.id;

  // Busca de processo
  const [processoSearch, setProcessoSearch] = useState('');
  const [processoOptions, setProcessoOptions] = useState<ProcessoOption[]>([]);
  const [selectedProcesso, setSelectedProcesso] = useState<ProcessoOption | null>(null);
  // O usuário mexeu no campo de processo? Se não mexeu, o vínculo original é preservado
  // (evita desvincular caso o pré-preenchimento ainda não tenha carregado).
  const [processoTocado, setProcessoTocado] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const fetchTipos = async () => {
    if (!user?.office_id) return;
    try {
      // Primeiro acesso do escritório: o loader grava os padrões do CPC. Se a
      // semente não puder ser gravada, ele devolve os padrões em memória — o
      // cadastro do prazo continua possível.
      const r = await carregarTiposAto(user.office_id);
      setTipos(r.tipos);
    } catch (e) {
      toast({ title: 'Erro ao carregar tipos de prazo', description: getErrorMessage(e), variant: 'destructive' });
    }
  };

  useEffect(() => {
    if (!gerenciarOpen) { fetchTipos(); fetchFeriados(); } // recarrega após fechar modal de gerenciamento
  }, [gerenciarOpen, user?.office_id]);

  useEffect(() => {
    if (open) {
      setFormData(prazoParaEditar ? prazoToForm(prazoParaEditar, user?.id) : emptyForm(tituloSugerido, numeroProcesso, user?.id));
      setProcessoSearch(''); setSelectedProcesso(null); setProcessoOptions([]);
      setProcessoTocado(false);
      setTipoAto(''); setDobro(false); setCalculoAplicado(false);
      fetchTipos(); fetchFeriados();
    }
  }, [open, prazoParaEditar, tituloSugerido, numeroProcesso]);

  // Ao editar, mostra o processo já vinculado no campo de busca
  useEffect(() => {
    const procId = prazoParaEditar?.processo_id;
    if (!open || !procId) return;
    let cancelado = false;
    (async () => {
      const { data } = await supabase.from('processos')
        .select('id, titulo, numero_processo').eq('id', procId).maybeSingle();
      if (!cancelado && data) setSelectedProcesso(data as ProcessoOption);
    })();
    return () => { cancelado = true; };
  }, [open, prazoParaEditar?.processo_id]);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowOptions(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  useEffect(() => {
    if (!processoSearch.trim() || processoSearch.length < 2 || !user?.office_id) {
      setProcessoOptions([]); return;
    }
    const officeId = user.office_id;
    const t = setTimeout(async () => {
      const term = processoSearch.trim();
      const { data } = await supabase.from('processos').select('id, titulo, numero_processo')
        .eq('office_id', officeId).eq('deletado', false)
        .or(`titulo.ilike.%${term}%,numero_processo.ilike.%${term}%`).limit(6);
      setProcessoOptions((data || []) as ProcessoOption[]);
      setShowOptions(true);
    }, 300);
    return () => clearTimeout(t);
  }, [processoSearch, user?.office_id]);

  const calcularDatas = (tipo: string, pubDate: string, emDobro = dobro) => {
    const ato = tipos.find(t => t.value === tipo);
    if (!ato || !pubDate) return;
    const dias = emDobro ? ato.diasUteis * 2 : ato.diasUteis; // CPC 229/183/180/186
    const pub = new Date(`${pubDate}T12:00:00`);
    const intimacao = addDiasUteisWith(pub, 1, feriadosAnual, feriadosData); // CPC art. 231
    const fatal = ato.corridos ? addDiasCorridos(intimacao, dias) : addDiasUteisWith(intimacao, dias, feriadosAnual, feriadosData);
    const internoDias = Math.max(1, dias - ato.margem);
    const interno = ato.corridos
      ? addDiasCorridos(intimacao, internoDias)
      : addDiasUteisWith(intimacao, internoDias, feriadosAnual, feriadosData);
    setFormData(prev => ({ ...prev, dataPrazoFatal: toISO(fatal), dataPrazoInterno: toISO(interno) }));
    setCalculoAplicado(true);
  };

  const handleTipoChange = (v: string) => {
    setTipoAto(v); setCalculoAplicado(false);
    if (formData.dataPublicacao && v) calcularDatas(v, formData.dataPublicacao);
  };

  const handleDobroChange = (v: boolean) => {
    setDobro(v);
    if (tipoAto && formData.dataPublicacao) calcularDatas(tipoAto, formData.dataPublicacao, v);
  };

  const handleDateChange = (field: string, v: string) => {
    setFormData(prev => ({ ...prev, [field]: v }));
    if (field === 'dataPublicacao') {
      setCalculoAplicado(false);
      if (tipoAto && v) calcularDatas(tipoAto, v);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = prazoFormSchema.safeParse(formData);
    if (!val.success) {
      toast({ title: "Campos obrigatórios", description: firstZodError(val.error), variant: "destructive" }); return;
    }
    if (!user?.id) { toast({ title: "Erro", description: "Usuário não autenticado.", variant: "destructive" }); return; }
    // Sem office_id (perfil ainda carregando em background) o insert ia sem escritório
    // e a RLS (office_paid_gate) devolvia 403 — virava um "Erro ao salvar" opaco.
    if (!user.office_id) { toast({ title: "Seu escritório ainda está carregando", description: "Aguarde um instante e tente de novo.", variant: "destructive" }); return; }

    setIsLoading(true);
    try {
      if (isEditing) {
        const updates: Record<string, unknown> = {
          titulo: formData.titulo, descricao: formData.descricao || null,
          data_fim_prazo: formData.dataPrazoFatal, prioridade: formData.prioridade,
          data_publicacao: formData.dataPublicacao || null,
          data_prazo_interno: formData.dataPrazoInterno || null,
          responsavel_id: formData.responsavel_id || user?.id || null,
          titular: formData.titular,
          // só sobrescreve o vínculo se o usuário mexeu no campo
          processo_id: processoTocado
            ? (selectedProcesso?.id ?? null)
            : (prazoParaEditar?.processo_id ?? selectedProcesso?.id ?? null),
        };
        if (formData.avisosDias != null) updates.avisos_dias = formData.avisosDias;
        // .select('id') + assertRowsAffected: a RLS bloqueando a edição (prazo de outro
        // membro) devolvia 0 linhas sem erro e o dialog dizia "Prazo atualizado".
        let { data: upd, error } = await supabase.from('prazos').update(updates as TablesUpdate<'prazos'>).eq('id', prazoParaEditar!.id!).select('id');
        if (error && /titular/.test(error.message || '')) { // coluna ainda não criada
          const { titular: _t, ...semTitular } = updates;
          ({ data: upd, error } = await supabase.from('prazos').update(semTitular as TablesUpdate<'prazos'>).eq('id', prazoParaEditar!.id!).select('id'));
        }
        assertRowsAffected(upd, error, 1);
        toast({ title: "Prazo atualizado", description: "As alterações foram salvas." });
      } else {
        let processoId: string | null = selectedProcesso?.id || null;
        if (!processoId && numeroProcesso && user.office_id) {
          const { data } = await supabase.from('processos').select('id')
            .eq('numero_processo', numeroProcesso.replace(/\D/g, '')).eq('office_id', user.office_id).maybeSingle();
          processoId = data?.id || null;
        }
        const payload: Record<string, unknown> = {
          user_id: user.id, office_id: user.office_id, processo_id: processoId,
          publicacao_id: publicacaoId || null, titulo: formData.titulo,
          descricao: formData.descricao || null, data_fim_prazo: formData.dataPrazoFatal,
          prioridade: formData.prioridade, status: 'pendente',
          responsavel_id: formData.responsavel_id || user.id,
        };
        if (formData.dataPublicacao) payload.data_publicacao = formData.dataPublicacao;
        if (formData.dataPrazoInterno) payload.data_prazo_interno = formData.dataPrazoInterno;
        if (formData.avisosDias != null) payload.avisos_dias = formData.avisosDias;
        payload.titular = formData.titular;
        let { error } = await supabase.from('prazos').insert(payload as TablesInsert<'prazos'>);
        if (error && /titular/.test(error.message || '')) { // coluna ainda não criada
          const { titular: _t, ...semTitular } = payload;
          ({ error } = await supabase.from('prazos').insert(semTitular as TablesInsert<'prazos'>));
        }
        if (error) throw error;
        toast({ title: "Prazo adicionado", description: "O prazo foi salvo com sucesso." });
      }
      onOpenChange(false);
      onSuccess?.();
    } catch (error: unknown) {
      const quota = planQuotaMessage(error);
      toast({
        title: quota?.title ?? "Erro ao salvar",
        description: quota?.description ?? (error instanceof Error ? error.message : "Tente novamente."),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <GerenciarTiposModal open={gerenciarOpen} onClose={() => setGerenciarOpen(false)} officeId={user?.office_id || ''} />

      <Dialog open={open} onOpenChange={v => { if (!v) onOpenChange(false); }}>
        <DialogContent aria-describedby={undefined} className="max-w-md bg-background border border-border p-0 rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto [&>button]:z-20">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border sticky top-0 bg-background z-10">
            <DialogTitle className="flex items-center gap-2.5 text-base font-black text-foreground">
              <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
                <CalendarClock className="h-4 w-4" />
              </div>
              {isEditing ? "Editar Prazo" : "Agendar Prazo"}
            </DialogTitle>
            {numeroProcesso && (
              <p className="text-[11px] text-muted-foreground font-mono mt-1 ml-0.5">Processo: {numeroProcesso}</p>
            )}
          </DialogHeader>

          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5 min-w-0">

            {/* Título */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Título <span className="text-red-500">*</span>
              </Label>
              <Input value={formData.titulo} onChange={e => setFormData(p => ({ ...p, titulo: e.target.value }))}
                placeholder="Ex: Contestação, Recurso, Manifestação..." className="rounded-xl h-10" required />
            </div>

            {/* Processo vinculado */}
            {!numeroProcesso && (
              <div className="space-y-1.5" ref={searchRef}>
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Processo vinculado
                </Label>
                {selectedProcesso ? (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-primary/30 bg-primary/5 min-w-0 overflow-hidden">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate">{selectedProcesso.titulo}</p>
                      <p className="text-[10px] text-muted-foreground font-mono truncate">{selectedProcesso.numero_processo}</p>
                    </div>
                    <button type="button" onClick={() => { setSelectedProcesso(null); setProcessoSearch(''); setProcessoTocado(true); }}
                      className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                    <Input value={processoSearch} onChange={e => setProcessoSearch(e.target.value)}
                      onFocus={() => processoOptions.length > 0 && setShowOptions(true)}
                      placeholder="Buscar por número ou nome..." className="pl-9 h-10 rounded-xl text-sm" />
                    {showOptions && processoOptions.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-xl shadow-lg overflow-hidden">
                        {processoOptions.map(p => (
                          <button key={p.id} type="button"
                            onMouseDown={() => { setSelectedProcesso(p); setProcessoSearch(''); setShowOptions(false); setProcessoTocado(true); }}
                            className="w-full text-left px-4 py-2.5 hover:bg-muted/50 transition-colors border-b border-border/40 last:border-0">
                            <p className="text-xs font-bold truncate">{p.titulo}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{p.numero_processo}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── CALCULADORA ── */}
            {!isEditing && (
              <CalculadoraPrazo
                tipos={tipos}
                tipoAto={tipoAto}
                dobro={dobro}
                calculoAplicado={calculoAplicado}
                dataPublicacao={formData.dataPublicacao}
                onDataPublicacao={v => handleDateChange('dataPublicacao', v)}
                onTipoChange={handleTipoChange}
                onDobroChange={handleDobroChange}
                onGerenciarTipos={() => setGerenciarOpen(true)}
              />
            )}

            {/* Datas com DatePicker */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {isEditing ? 'Datas' : 'Ajuste fino das datas'}
              </Label>
              <div className="space-y-2">
                {DATE_FIELDS.filter(f => isEditing ? true : f.key !== 'dataPublicacao').map(
                  ({ key, label, hint, icon: Icon, color, ring, bg, required }) => (
                    <div key={key} className={cn(
                      'grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl border px-3 py-2.5 transition-all',
                      bg, ring,
                      calculoAplicado && (key === 'dataPrazoFatal' || key === 'dataPrazoInterno') && 'ring-1 ring-emerald-500/30'
                    )}>
                      <div className={cn('shrink-0', color)}><Icon className="h-4 w-4" /></div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-widest text-foreground/80 leading-none mb-0.5">
                          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
                        </p>
                        <p className="text-[10px] text-muted-foreground/60 leading-none">{hint}</p>
                      </div>
                      <PrazoDatePicker
                        value={formData[key as DateKey]}
                        onChange={v => handleDateChange(key, v)}
                        required={required}
                        highlight={calculoAplicado && (key === 'dataPrazoFatal' || key === 'dataPrazoInterno')}
                      />
                    </div>
                  )
                )}
              </div>
            </div>

            {/* De quem é o prazo */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">De quem é o prazo?</Label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setFormData(p => ({ ...p, titular: 'nosso' }))}
                  className={cn("h-10 rounded-xl border text-[11px] font-black uppercase tracking-widest transition-all",
                    formData.titular === 'nosso' ? "bg-primary/10 border-primary/40 text-primary" : "border-border text-muted-foreground hover:border-foreground/20")}>
                  Nosso escritório
                </button>
                <button type="button" onClick={() => setFormData(p => ({ ...p, titular: 'contraria' }))}
                  className={cn("h-10 rounded-xl border text-[11px] font-black uppercase tracking-widest transition-all",
                    formData.titular === 'contraria' ? "bg-indigo-500/10 border-indigo-500/40 text-indigo-600 dark:text-indigo-400" : "border-border text-muted-foreground hover:border-foreground/20")}>
                  Parte contrária
                </button>
              </div>
              {formData.titular === 'contraria' && (
                <p className="text-[10px] text-muted-foreground/60">Somente acompanhamento — não gera alertas no sino.</p>
              )}
            </div>

            {/* Prioridade */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Prioridade</Label>
              <Select value={formData.prioridade} onValueChange={v => setFormData(p => ({ ...p, prioridade: v }))}>
                <SelectTrigger className="rounded-xl h-10"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="alta">🔴 Alta</SelectItem>
                  <SelectItem value="media">🟡 Média</SelectItem>
                  <SelectItem value="baixa">🟢 Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Avisar (antecedência do lembrete) */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Avisar</Label>
              <AvisoDiasSelect value={formData.avisosDias} onChange={v => setFormData(p => ({ ...p, avisosDias: v }))} />
            </div>

            {/* Responsável */}
            {membros.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Responsável</Label>
                <Select value={formData.responsavel_id} onValueChange={v => setFormData(p => ({ ...p, responsavel_id: v }))}>
                  <SelectTrigger className="rounded-xl h-10"><SelectValue placeholder="Selecionar responsável" /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {membros.map(m => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Observações */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Observações</Label>
              <Textarea value={formData.descricao} onChange={e => setFormData(p => ({ ...p, descricao: e.target.value }))}
                placeholder="Detalhes adicionais do prazo..." rows={2} className="rounded-xl resize-none text-sm" />
            </div>

            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}
                className="flex-1 rounded-xl h-10" disabled={isLoading}>Cancelar</Button>
              <Button type="submit" className="flex-1 rounded-xl h-10 font-black" disabled={isLoading}>
                {isLoading ? "Salvando…" : isEditing ? "Salvar Alterações" : "Criar Prazo"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};
