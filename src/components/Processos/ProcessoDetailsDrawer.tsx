import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Processo } from '@/types/processo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  User,
  Scale,
  DollarSign,
  Clock,
  History,
  Info,
  Gavel,
  MapPin,
  Building2,
  Users,
  RotateCw,
  Save,
  Edit,
  X,
  Check,
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
  const { persistAndamentos, update } = useProcessosV2();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [movements, setMovements] = useState<Movimentacao[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedProcessoId, setLastSyncedProcessoId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("resumo");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingCliente, setSavingCliente] = useState(false);
  const [editData, setEditData] = useState({
    titulo: '',
    parte_autora: '',
    requerido: '',
    classe_judicial: '',
    assunto_principal: '',
    fase_processual: '',
    instancia: '',
    tribunal: '',
    vara: '',
    comarca: '',
    valor_causa: 0,
  });

  useEffect(() => {
    if (processo && open) {
      setEditData({
        titulo: processo.titulo || '',
        parte_autora: processo.parteAutora || '',
        requerido: processo.requerido || '',
        classe_judicial: processo.classeJudicial || processo.tipoProcesso || '',
        assunto_principal: processo.assuntoPrincipal || '',
        fase_processual: processo.faseProcessual || '',
        instancia: processo.instancia || '',
        tribunal: processo.tribunal || '',
        vara: processo.vara || '',
        comarca: processo.comarca || '',
        valor_causa: processo.valorCausa || 0,
      });
      setEditing(false);
      setActiveTab("resumo");
    }
  }, [processo?.id, open]);

  const handleSetCliente = async (polo: 'autor' | 'reu') => {
    if (!processo?.id || !user?.office_id) return;
    setSavingCliente(true);
    try {
      const rawName = polo === 'autor' ? (editData.parte_autora || processo.parteAutora) : (editData.requerido || processo.requerido);
      if (!rawName) {
        toast({ title: 'Nome não identificado', description: `Preencha o nome do ${polo === 'autor' ? 'autor' : 'réu'} antes de vincular.`, variant: 'destructive' });
        return;
      }
      const nomeCliente = rawName.replace(/\s+/g, ' ').trim().split(' ').slice(0, 8).join(' ').slice(0, 100);

      const { data: existing } = await supabase
        .from('clientes')
        .select('id')
        .eq('nome', nomeCliente)
        .eq('office_id', user.office_id)
        .maybeSingle();

      let clienteId: string;
      if (existing) {
        clienteId = existing.id;
      } else {
        const { data: novo } = await supabase
          .from('clientes')
          .insert({ nome: nomeCliente, office_id: user.office_id, user_id: user.id })
          .select('id')
          .single();
        if (!novo) throw new Error('Erro ao criar cliente');
        clienteId = novo.id;
      }

      await supabase.from('processos').update({ cliente_id: clienteId }).eq('id', processo.id);
      queryClient.invalidateQueries({ queryKey: ['processos'] });
      toast({ title: 'Cliente vinculado', description: `${nomeCliente} vinculado como cliente deste processo.` });
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setSavingCliente(false);
    }
  };

  const handleSave = async () => {
    if (!processo?.id) return;
    setSaving(true);
    try {
      await update(processo.id, {
        titulo: editData.titulo,
        parteAutora: editData.parte_autora,
        requerido: editData.requerido,
        classeJudicial: editData.classe_judicial,
        assuntoPrincipal: editData.assunto_principal,
        faseProcessual: editData.fase_processual,
        instancia: editData.instancia,
        tribunal: editData.tribunal,
        vara: editData.vara,
        comarca: editData.comarca,
        valorCausa: editData.valor_causa,
      } as any);
      toast({ title: 'Processo atualizado', description: 'Alterações salvas com sucesso.' });
      setEditing(false);
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const fetchMovements = useCallback(async () => {
    if (!processo?.id) return;
    setLoadingMovements(true);
    try {
      const { data, error } = await supabase
        .from('movimentacoes_processo')
        .select('id, data:data_movimentacao, texto:descricao, tipo, metadata')
        .eq('processo_id', processo.id)
        .order('data_movimentacao', { ascending: false });
      if (!error && data) setMovements(data as any);
    } catch (err) {
      console.error('Erro ao buscar movimentações:', err);
    } finally {
      setLoadingMovements(false);
    }
  }, [processo?.id]);

  const syncFromOrigin = useCallback(async () => {
    if (!processo?.id || !processo.numeroProcesso || syncing) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-processo', {
        body: {
          numeroProcesso: processo.numeroProcesso,
          oab: (profile as any)?.oab,
          uf: (profile as any)?.oab_uf,
        },
      });
      if (error || !data || data.error) return;

      const andamentos = Array.isArray(data.andamentos) ? data.andamentos : [];
      if (andamentos.length > 0) {
        const inseridos = await persistAndamentos(processo.id, user?.office_id, andamentos, 'datajud');
        if (inseridos > 0) {
          toast({ title: 'Histórico atualizado', description: `${inseridos} nova(s) movimentação(ões) sincronizada(s).` });
        }

        const ultimo = data.ultimoAndamento?.data || andamentos[0]?.data;
        const updatePayload: any = {
          sincronizado_em: new Date().toISOString(),
          data_ultima_atualizacao: ultimo ? String(ultimo).split('T')[0] : new Date().toISOString().split('T')[0],
        };
        if (data.titulo && data.titulo !== 'Processo' && (!processo.titulo || processo.titulo.includes('(Auto)'))) updatePayload.titulo = data.titulo;
        if (data.autor && data.autor !== 'Não identificado' && !processo.parteAutora) updatePayload.parte_autora = data.autor;
        if (data.reu && data.reu !== 'Não identificado' && !processo.requerido) updatePayload.requerido = data.reu;
        if (data.classe && !processo.classeJudicial) updatePayload.classe_judicial = data.classe;
        if (data.assunto && !processo.assuntoPrincipal) updatePayload.assunto_principal = data.assunto;
        if (data.faseProcessual && !processo.faseProcessual) updatePayload.fase_processual = data.faseProcessual;
        if (data.instancia && !processo.instancia) updatePayload.instancia = data.instancia;
        if (data.valorCausa && !processo.valorCausa) updatePayload.valor_causa = data.valorCausa;
        if (data.vara && !processo.vara) updatePayload.vara = data.vara;
        if (data.comarca && !processo.comarca) updatePayload.comarca = data.comarca;

        await supabase.from('processos').update(updatePayload).eq('id', processo.id);
        queryClient.invalidateQueries({ queryKey: ['processos'] });
      }
      await fetchMovements();
    } catch (err: any) {
      console.error('[drawer] erro no sync:', err);
    } finally {
      setSyncing(false);
    }
  }, [processo?.id, processo?.numeroProcesso, syncing, user?.office_id, profile, persistAndamentos, toast, fetchMovements, queryClient]);

  useEffect(() => {
    if (!processo?.id || !open) return;
    fetchMovements();
  }, [processo?.id, open, fetchMovements]);

  useEffect(() => {
    if (!open || activeTab !== 'timeline' || !processo?.id) return;
    if (lastSyncedProcessoId === processo.id) return;
    setLastSyncedProcessoId(processo.id);
    syncFromOrigin();
  }, [open, activeTab, processo?.id, lastSyncedProcessoId, syncFromOrigin]);

  useEffect(() => {
    if (!open) setLastSyncedProcessoId(null);
  }, [open]);

  const getStatusStyle = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s.includes('andamento') || s === 'ativo') return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
    if (s.includes('concluído') || s.includes('encerrado')) return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
    if (s.includes('suspenso')) return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
    return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20';
  };

  const Field = ({ label, field, icon }: { label: string; field: keyof typeof editData; icon?: React.ReactNode }) => (
    <div className="space-y-1.5">
      <p className="text-[10px] text-muted-foreground/60 uppercase font-black tracking-widest">{label}</p>
      {editing ? (
        <Input
          className="h-10 text-sm rounded-xl bg-background border-border focus:ring-2 focus:ring-primary/20"
          value={String(editData[field] || '')}
          onChange={(e) => setEditData({ ...editData, [field]: field === 'valor_causa' ? Number(e.target.value) || 0 : e.target.value })}
        />
      ) : (
        <div className="flex items-center gap-2 min-h-[40px] px-3 py-2 rounded-xl bg-muted/20 border border-transparent">
          {icon}
          <p className="text-sm font-semibold text-foreground">{String(editData[field]) || '—'}</p>
        </div>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] h-[90vh] p-0 rounded-3xl border border-border bg-background shadow-2xl flex flex-col overflow-hidden gap-0">

        {/* ═══ HEADER ═══ */}
        <div className="px-8 pt-8 pb-4 space-y-5 border-b border-border shrink-0 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-primary/5 blur-[120px] -mr-40 -mt-40 rounded-full pointer-events-none" />

          <div className="flex items-start justify-between relative">
            <div className="space-y-3 flex-1 min-w-0 pr-4">
              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant="outline" className={cn("px-3 py-1 text-[10px] font-black uppercase tracking-widest border-2", getStatusStyle(processo.status))}>
                  {processo.status}
                </Badge>
                <span className="text-[10px] text-muted-foreground/50 uppercase font-black tracking-widest flex items-center gap-1.5">
                  <Clock className="h-3 w-3" />
                  Desde {processo.dataInicio ? new Date(processo.dataInicio).toLocaleDateString('pt-BR') : '—'}
                </span>
              </div>

              {editing ? (
                <Input
                  className="text-2xl font-black rounded-xl bg-background border-border h-14 focus:ring-2 focus:ring-primary/20"
                  value={editData.titulo}
                  onChange={(e) => setEditData({ ...editData, titulo: e.target.value })}
                />
              ) : (
                <DialogTitle className="text-2xl md:text-3xl font-black text-foreground leading-tight tracking-tight pr-8">
                  {processo.titulo}
                </DialogTitle>
              )}

              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary/50 animate-pulse" />
                <span className="font-mono text-sm font-bold text-primary tracking-tight">
                  {formatCNJ(processo.numeroProcesso)}
                </span>
              </div>
            </div>

            {/* Botões Editar / Salvar no header */}
            <div className="flex items-center gap-2 shrink-0">
              {editing ? (
                <>
                  <Button variant="ghost" size="sm" onClick={() => setEditing(false)} className="h-9 rounded-xl text-xs gap-1.5">
                    <X className="h-3.5 w-3.5" /> Cancelar
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={saving} className="h-9 rounded-xl text-xs gap-1.5 shadow-md">
                    <Save className="h-3.5 w-3.5" /> {saving ? 'Salvando...' : 'Salvar'}
                  </Button>
                </>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="h-9 rounded-xl text-xs gap-1.5 border-border">
                  <Edit className="h-3.5 w-3.5" /> Editar Capa
                </Button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="bg-muted/40 p-1 h-11 rounded-2xl w-full justify-between">
              <TabsTrigger value="resumo" className="flex-1 rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary font-bold text-xs gap-2">
                <Info className="h-3.5 w-3.5" /> Resumo
              </TabsTrigger>
              <TabsTrigger value="timeline" className="flex-1 rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary font-bold text-xs gap-2">
                <History className="h-3.5 w-3.5" /> Histórico
              </TabsTrigger>
              <TabsTrigger value="partes" className="flex-1 rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary font-bold text-xs gap-2">
                <Users className="h-3.5 w-3.5" /> Partes
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* ═══ CONTEÚDO ═══ */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="p-8">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">

              {/* ── RESUMO ── */}
              <TabsContent value="resumo" className="space-y-8 mt-0">
                {/* KPIs */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 space-y-2">
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                      <DollarSign className="h-4 w-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Valor da Causa</span>
                    </div>
                    {editing ? (
                      <Input type="number" className="h-10 rounded-xl bg-background border-border" value={editData.valor_causa} onChange={(e) => setEditData({ ...editData, valor_causa: Number(e.target.value) || 0 })} />
                    ) : (
                      <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 tracking-tighter">
                        {processo.valorCausa ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(processo.valorCausa) : 'R$ 0,00'}
                      </p>
                    )}
                  </div>
                  <div className="p-5 rounded-2xl bg-blue-500/5 border border-blue-500/10 space-y-2">
                    <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                      <Scale className="h-4 w-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Classe</span>
                    </div>
                    <p className="text-lg font-black text-blue-600 dark:text-blue-400 uppercase leading-tight">
                      {processo.classeJudicial || processo.tipoProcesso || '—'}
                    </p>
                  </div>
                </div>

                {/* Capa Jurídica */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-[.2em]">
                    <Gavel className="h-4 w-4" />
                    <span>Capa Jurídica</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-6 rounded-2xl border border-border bg-muted/20">
                    <Field label="Classe" field="classe_judicial" />
                    <Field label="Assunto Principal" field="assunto_principal" />
                    <Field label="Fase Atual" field="fase_processual" />
                    <Field label="Instância" field="instancia" />
                    <Field label="Tribunal" field="tribunal" icon={<Building2 className="h-3.5 w-3.5 text-primary/60" />} />
                    <Field label="Vara" field="vara" icon={<MapPin className="h-3.5 w-3.5 text-primary/60" />} />
                    <Field label="Comarca / UF" field="comarca" />
                  </div>
                </div>

                {/* Partes resumidas */}
                {(processo.parteAutora || processo.requerido) && !editing && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-[.2em]">
                      <Users className="h-4 w-4" />
                      <span>Partes</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-2xl border border-emerald-500/10 bg-emerald-500/5">
                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-black uppercase tracking-widest mb-1">Autor</p>
                        <p className="text-sm font-bold">{processo.parteAutora || 'Não identificado'}</p>
                      </div>
                      <div className="p-4 rounded-2xl border border-rose-500/10 bg-rose-500/5">
                        <p className="text-[10px] text-rose-600 dark:text-rose-400 font-black uppercase tracking-widest mb-1">Réu</p>
                        <p className="text-sm font-bold">{processo.requerido || 'Não identificado'}</p>
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* ── HISTÓRICO ── */}
              <TabsContent value="timeline" className="space-y-6 mt-0">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] text-muted-foreground/60 uppercase font-black tracking-widest">
                    {syncing ? 'Sincronizando com o tribunal…' : `${movements.length} movimentação(ões)`}
                  </p>
                  <button onClick={() => syncFromOrigin()} disabled={syncing} className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-black text-primary/70 hover:text-primary disabled:opacity-30 transition-colors">
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
                  <div className="relative pl-6 space-y-8 border-l-2 border-border ml-2 pt-2 pb-10">
                    {movements.map((mov) => (
                      <div key={mov.id} className="relative">
                        <div className="absolute -left-[29px] top-1 h-3.5 w-3.5 rounded-full bg-background border-2 border-primary/40 ring-4 ring-primary/5" />
                        <div className="space-y-1.5 pl-2">
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-[10px] font-black text-primary/80 bg-primary/5 px-2.5 py-0.5 rounded-lg">
                              {new Date(mov.data).toLocaleDateString('pt-BR')}
                            </span>
                            <span className="text-[9px] uppercase tracking-widest text-muted-foreground/40 font-bold">
                              {mov.tipo || mov.metadata?.fase || 'Andamento'}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-foreground/85 leading-relaxed">
                            {mov.texto}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-24 flex flex-col items-center justify-center text-center space-y-4 opacity-30">
                    <History className="h-14 w-14" />
                    <div className="space-y-1.5">
                      <p className="font-black uppercase tracking-widest text-sm">Sem Histórico</p>
                      <p className="text-xs max-w-xs mx-auto">Clique em "Atualizar agora" para buscar movimentações do tribunal.</p>
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* ── PARTES ── */}
              <TabsContent value="partes" className="space-y-6 mt-0">
                <div className="space-y-6">
                  {/* Polo Ativo */}
                  <div className="p-6 rounded-2xl border border-emerald-500/15 bg-emerald-500/5 space-y-4">
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                      <User className="h-4 w-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Polo Ativo (Autor / Requerente)</span>
                    </div>
                    {editing ? (
                      <Input className="h-10 rounded-xl bg-background border-border" value={editData.parte_autora} onChange={(e) => setEditData({ ...editData, parte_autora: e.target.value })} placeholder="Nome do autor..." />
                    ) : (
                      <p className="text-base font-bold text-foreground leading-relaxed">
                        {processo.parteAutora || <span className="text-muted-foreground/50 italic">Não identificado</span>}
                      </p>
                    )}
                    <Button
                      variant={processo.clienteId && processo.cliente === (processo.parteAutora || '') ? 'default' : 'outline'}
                      size="sm"
                      className="w-full rounded-xl gap-2 font-black text-[10px] h-9 uppercase tracking-widest"
                      disabled={savingCliente || !(editData.parte_autora || processo.parteAutora)}
                      onClick={() => handleSetCliente('autor')}
                    >
                      {savingCliente ? <RotateCw className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                      Este é meu cliente
                    </Button>
                  </div>

                  {/* Polo Passivo */}
                  <div className="p-6 rounded-2xl border border-rose-500/15 bg-rose-500/5 space-y-4">
                    <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                      <Users className="h-4 w-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Polo Passivo (Réu / Requerido)</span>
                    </div>
                    {editing ? (
                      <Input className="h-10 rounded-xl bg-background border-border" value={editData.requerido} onChange={(e) => setEditData({ ...editData, requerido: e.target.value })} placeholder="Nome do réu..." />
                    ) : (
                      <p className="text-base font-bold text-foreground leading-relaxed">
                        {processo.requerido || <span className="text-muted-foreground/50 italic">Não identificado</span>}
                      </p>
                    )}
                    <Button
                      variant={processo.clienteId && processo.cliente === (processo.requerido || '') ? 'default' : 'outline'}
                      size="sm"
                      className="w-full rounded-xl gap-2 font-black text-[10px] h-9 uppercase tracking-widest"
                      disabled={savingCliente || !(editData.requerido || processo.requerido)}
                      onClick={() => handleSetCliente('reu')}
                    >
                      {savingCliente ? <RotateCw className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                      Este é meu cliente
                    </Button>
                  </div>

                  {editing && (
                    <div className="flex justify-end gap-2 pt-2">
                      <Button variant="ghost" size="sm" onClick={() => setEditing(false)} className="h-9 rounded-xl text-xs gap-1.5">
                        <X className="h-3.5 w-3.5" /> Cancelar
                      </Button>
                      <Button size="sm" onClick={handleSave} disabled={saving} className="h-9 rounded-xl text-xs gap-1.5 shadow-md">
                        <Save className="h-3.5 w-3.5" /> {saving ? 'Salvando...' : 'Salvar'}
                      </Button>
                    </div>
                  )}
                </div>
              </TabsContent>

            </Tabs>
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
};
