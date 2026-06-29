import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Processo } from '@/types/processo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
  FileText,
  CalendarClock,
  Megaphone,
  ListTodo,
  Timer,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { formatCNJ } from '@/utils/formatCNJ';
import { useProcessosV2 } from '@/hooks/useProcessosV2';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useOfficeTeams } from '@/hooks/useOfficeTeams';
import { useOfficeUsers } from '@/hooks/useOfficeUsers';
import { CompletarDadosDialog } from '@/components/Processos/CompletarDadosDialog';

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

const fmtDate = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';
const fmtDateTime = (d: string | null | undefined) => d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const fmtDuration = (min: number | null | undefined) => {
  if (!min) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h${m > 0 ? `${String(m).padStart(2, '0')}min` : ''}` : `${m}min`;
};

// ── Campo da capa (componente ESTÁVEL: definido fora do drawer para o <Input>
//    não remontar a cada tecla — era a causa do travamento ao digitar) ──
const CapaField = React.memo(function CapaField({ label, editing, value, icon, onChange }: {
  label: string; editing: boolean; value: string; icon?: React.ReactNode; onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] text-muted-foreground/60 uppercase font-black tracking-widest">{label}</p>
      {editing ? (
        <Input
          className="h-10 text-sm rounded-xl bg-background border-border focus:ring-2 focus:ring-primary/20"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <div className="flex items-center gap-2 min-h-[40px] px-3 py-2 rounded-xl bg-muted/20 border border-transparent">
          {icon}
          <p className="text-sm font-semibold text-foreground">{value || '—'}</p>
        </div>
      )}
    </div>
  );
});

// ── Wrapper de formulário de adição rápida (também estável) ──
const AddForm = React.memo(function AddForm({ children, onSubmit, onCancel, loading }: {
  children: React.ReactNode; onSubmit: (e: React.FormEvent<HTMLFormElement>) => void; onCancel: () => void; loading?: boolean;
}) {
  return (
    <form onSubmit={onSubmit} className="p-5 rounded-2xl border border-primary/20 bg-primary/5 space-y-4 animate-in fade-in duration-300">
      {children}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} className="rounded-xl text-xs h-8">Cancelar</Button>
        <Button type="submit" size="sm" disabled={loading} className="rounded-xl text-xs h-8 gap-1.5">
          {loading ? <RotateCw className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Salvar
        </Button>
      </div>
    </form>
  );
});

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
  const { teams: officeTeams } = useOfficeTeams();
  const { users: officeUsers } = useOfficeUsers();

  const [movements, setMovements] = useState<Movimentacao[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(false);
  const [confirmDelMov, setConfirmDelMov] = useState<string | null>(null);
  const [delMovLoading, setDelMovLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [completarOpen, setCompletarOpen] = useState(false);
  const [andamentoConfirm, setAndamentoConfirm] = useState<{ all: any[]; novos: any[]; meta: any; processoId: string } | null>(null);
  const [lastSyncedProcessoId, setLastSyncedProcessoId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("resumo");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingCliente, setSavingCliente] = useState(false);

  // Sub-tab data
  const [publicacoes, setPublicacoes] = useState<any[]>([]);
  const [prazos, setPrazos] = useState<any[]>([]);
  const [audiencias, setAudiencias] = useState<any[]>([]);
  const [atendimentos, setAtendimentos] = useState<any[]>([]);
  const [tarefas, setTarefas] = useState<any[]>([]);
  const [timesheets, setTimesheets] = useState<any[]>([]);
  const [loadingSub, setLoadingSub] = useState(false);

  // Add forms
  const [showAddPrazo, setShowAddPrazo] = useState(false);
  const [showAddAudiencia, setShowAddAudiencia] = useState(false);
  const [showAddTarefa, setShowAddTarefa] = useState(false);
  const [showAddTimesheet, setShowAddTimesheet] = useState(false);
  const [showAddAtendimento, setShowAddAtendimento] = useState(false);
  const [addLoading, setAddLoading] = useState(false);

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
    team_id: '' as string,
    responsavel_id: '' as string,
    resultado: '' as string,
  });

  useEffect(() => {
    // SEMPRE zera os dados do processo anterior ao TROCAR de processo ou fechar.
    // (Antes só limpava ao fechar — por isso a confirmação/andamentos de um processo
    //  vazava para o próximo, ex.: andamentos do PH aparecendo na Maria Luiza.)
    setMovements([]);
    setPublicacoes([]);
    setPrazos([]);
    setAudiencias([]);
    setAtendimentos([]);
    setTarefas([]);
    setTimesheets([]);
    setAndamentoConfirm(null);
    setConfirmDelMov(null);
    setExpandedPubId(null);
    setTratandoPubId(null);
    setLastSyncedProcessoId(null);
    setShowAddAndamento(false);
    setShowAddPrazo(false);
    setShowAddAudiencia(false);
    setShowAddTarefa(false);
    setShowAddTimesheet(false);
    setShowAddAtendimento(false);

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
        team_id: (processo as any).team_id || '',
        responsavel_id: (processo as any).responsavel_id || (processo as any).responsavelId || '',
        resultado: (processo as any).resultado || '',
      });
      setEditing(false);
      setActiveTab("resumo");
    }
  }, [processo?.id, open]);

  const handleSave = async () => {
    if (!processo?.id) return;
    if (!editData.titulo.trim()) {
      toast({ title: 'Título obrigatório', description: 'O processo precisa ter um título.', variant: 'destructive' });
      return;
    }
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
        team_id: editData.team_id || null,
        responsavel_id: editData.responsavel_id || null,
        resultado: editData.resultado || null,
      } as any);
      setEditing(false);
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

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
      const { data: existing } = await supabase.from('clientes').select('id').eq('nome', nomeCliente).eq('office_id', user.office_id).maybeSingle();
      let clienteId: string;
      if (existing) {
        clienteId = existing.id;
      } else {
        const { data: novo } = await supabase.from('clientes').insert({ nome: nomeCliente, office_id: user.office_id, user_id: user.id }).select('id').single();
        if (!novo) throw new Error('Erro ao criar cliente');
        clienteId = novo.id;
      }
      const { error: updateError } = await supabase.from('processos').update({ cliente_id: clienteId }).eq('id', processo.id);
      if (updateError) throw updateError;
      queryClient.invalidateQueries({ queryKey: ['processos'] });
      toast({ title: 'Cliente vinculado', description: `${nomeCliente} vinculado como cliente deste processo.` });
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setSavingCliente(false);
    }
  };

  const fetchMovements = useCallback(async () => {
    if (!processo?.id) return;
    setLoadingMovements(true);
    const { data, error } = await supabase
      .from('movimentacoes_processo')
      .select('id, data:data_movimentacao, texto:descricao, tipo, metadata')
      .eq('processo_id', processo.id)
      .order('data_movimentacao', { ascending: false });
    if (!error && data) setMovements(data as any);
    setLoadingMovements(false);
  }, [processo?.id]);

  // Exclui um andamento (movimentação) específico — usado para remover andamentos errados
  const handleDeleteMovement = useCallback(async (id: string) => {
    setDelMovLoading(true);
    const { error } = await supabase.from('movimentacoes_processo').delete().eq('id', id);
    setDelMovLoading(false);
    if (error) { toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' }); return; }
    setMovements(prev => prev.filter(m => (m as any).id !== id));
    setConfirmDelMov(null);
    toast({ title: 'Andamento excluído' });
  }, [toast]);

  const fetchSubData = useCallback(async (tab: string) => {
    if (!processo?.id) return;
    setLoadingSub(true);
    if (tab === 'publicacoes') {
      const numero = (processo.numeroProcesso || '').replace(/\D/g, '');
      const { data } = await supabase.from('publicacoes').select('*').or(`processo_id.eq.${processo.id},numero_processo.eq.${numero}`).order('data_publicacao', { ascending: false });
      setPublicacoes(data || []);
    } else if (tab === 'prazos') {
      const { data } = await supabase.from('prazos').select('*').eq('processo_id', processo.id).order('data_fim_prazo', { ascending: true, nullsFirst: false });
      setPrazos(data || []);
    } else if (tab === 'audiencias') {
      const { data } = await supabase.from('audiencias').select('*').eq('processo_id', processo.id).order('data_audiencia', { ascending: false });
      setAudiencias(data || []);
    } else if (tab === 'atendimentos') {
      const { data } = await supabase.from('atendimentos').select('*').eq('processo_id', processo.id).order('data_atendimento', { ascending: false });
      setAtendimentos(data || []);
    } else if (tab === 'tarefas') {
      const { data } = await supabase.from('tarefas').select('*').eq('processo_id', processo.id).eq('deletado', false).order('created_at', { ascending: false });
      setTarefas(data || []);
    } else if (tab === 'timesheet') {
      const { data } = await supabase.from('timesheets').select('*').eq('processo_id', processo.id).eq('deletado', false).order('data_inicio', { ascending: false });
      setTimesheets(data || []);
    }
    setLoadingSub(false);
  }, [processo?.id, processo?.numeroProcesso]);

  const syncFromOrigin = useCallback(async () => {
    if (!processo?.id || !processo.numeroProcesso || syncing) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-processo', {
        body: { numeroProcesso: processo.numeroProcesso, oab: (profile as any)?.oab, uf: (profile as any)?.oab_uf },
      });
      if (error || !data || data.error) {
        toast({ title: 'Sem dados disponíveis', description: 'Não foi possível buscar andamentos no momento.', variant: 'destructive' });
        return;
      }
      const andamentos = Array.isArray(data.andamentos) ? data.andamentos : [];
      // Detecta apenas os andamentos NOVOS (não pede pra adicionar o que já existe).
      // Busca os existentes direto do banco DESTE processo (não do estado, que é limpo ao trocar).
      const keyOf = (dt: any, tx: any) => `${String(dt || '').slice(0, 10)}|${String(tx || '').toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 60)}`;
      const { data: existingRows } = await supabase
        .from('movimentacoes_processo')
        .select('data_movimentacao, descricao')
        .eq('processo_id', processo.id);
      const existing = new Set((existingRows || []).map((m: any) => keyOf(m.data_movimentacao, m.descricao)));
      const novos = andamentos.filter((a: any) => !existing.has(keyOf(a.data, a.descricao || a.resumo)));
      if (novos.length === 0) {
        toast({ title: 'Já atualizado', description: 'Nenhum andamento novo encontrado.' });
      } else {
        // Não salva automático: abre confirmação com os novos andamentos (amarrada ao processo atual)
        setAndamentoConfirm({ all: andamentos, novos, meta: data, processoId: processo.id });
      }
      await fetchMovements();
    } catch (err) { console.error(err); }
    finally { setSyncing(false); }
  }, [processo?.id, processo?.numeroProcesso, syncing, user?.office_id, profile, toast, fetchMovements]);

  // Confirma e persiste os andamentos novos
  const confirmAndamentos = useCallback(async () => {
    if (!andamentoConfirm || !processo?.id) return;
    // Segurança: só persiste se a confirmação for DESTE processo (evita salvar andamentos de outro)
    if (andamentoConfirm.processoId !== processo.id) { setAndamentoConfirm(null); return; }
    setSyncing(true);
    try {
      const data = andamentoConfirm.meta;
      const inseridos = await persistAndamentos(processo.id, user?.office_id, andamentoConfirm.all, 'datajud');
      const updatePayload: any = { sincronizado_em: new Date().toISOString() };
      if (data.titulo && data.titulo !== 'Processo' && (!processo.titulo || processo.titulo.includes('(Auto)'))) updatePayload.titulo = data.titulo;
      if (data.autor && data.autor !== 'Não identificado' && !processo.parteAutora) updatePayload.parte_autora = data.autor;
      if (data.reu && data.reu !== 'Não identificado' && !processo.requerido) updatePayload.requerido = data.reu;
      await supabase.from('processos').update(updatePayload).eq('id', processo.id);
      queryClient.invalidateQueries({ queryKey: ['processos'] });
      await fetchMovements();
      toast({ title: 'Histórico atualizado', description: `${inseridos} movimentação(ões) adicionada(s).` });
    } finally {
      setSyncing(false);
      setAndamentoConfirm(null);
    }
  }, [andamentoConfirm, processo, user?.office_id, persistAndamentos, queryClient, fetchMovements, toast]);

  useEffect(() => {
    if (!processo?.id || !open) return;
    fetchMovements();
  }, [processo?.id, open, fetchMovements]);

  useEffect(() => {
    if (!open || !processo?.id) return;
    if (activeTab === 'timeline') {
      if (lastSyncedProcessoId !== processo.id) {
        setLastSyncedProcessoId(processo.id);
        syncFromOrigin();
      }
    } else if (['publicacoes', 'prazos', 'audiencias', 'atendimentos', 'tarefas', 'timesheet'].includes(activeTab)) {
      fetchSubData(activeTab);
    }
  }, [open, activeTab, processo?.id]);

  // ── Add handlers ──
  const handleAddPrazo = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!processo?.id || !user) return;
    setAddLoading(true);
    const fd = new FormData(e.currentTarget);
    const titulo = (fd.get('titulo') as string || '').trim();
    const dataVencimento = fd.get('data_vencimento') as string;
    if (!titulo || !dataVencimento) {
      toast({ title: 'Preencha título e data', variant: 'destructive' });
      setAddLoading(false); return;
    }
    const { error } = await supabase.from('prazos').insert({
      user_id: user.id, office_id: user.office_id, processo_id: processo.id,
      titulo, descricao: fd.get('descricao') as string || null,
      data_vencimento: dataVencimento,
      prioridade: fd.get('prioridade') as string || 'media',
      status: 'pendente',
    });
    if (error) { toast({ title: 'Erro ao criar prazo', description: error.message, variant: 'destructive' }); }
    else { toast({ title: 'Prazo criado' }); setShowAddPrazo(false); fetchSubData('prazos'); }
    setAddLoading(false);
  };

  const handleAddAudiencia = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!processo?.id || !user) return;
    setAddLoading(true);
    const fd = new FormData(e.currentTarget);
    const titulo = (fd.get('titulo') as string || '').trim();
    const data = fd.get('data') as string;
    if (!titulo || !data) {
      toast({ title: 'Preencha título e data', variant: 'destructive' });
      setAddLoading(false); return;
    }
    const { error } = await supabase.from('audiencias').insert({
      user_id: user.id, office_id: user.office_id, processo_id: processo.id,
      titulo,
      data_audiencia: new Date(`${data}T${fd.get('horario') || '00:00'}`).toISOString(),
      local: fd.get('local') as string || null,
      tipo: fd.get('tipo') as string || null,
      observacoes: fd.get('observacoes') as string || null,
      status: 'agendado',
    });
    if (error) { toast({ title: 'Erro ao criar audiência', description: error.message, variant: 'destructive' }); }
    else { toast({ title: 'Audiência criada' }); setShowAddAudiencia(false); fetchSubData('audiencias'); }
    setAddLoading(false);
  };

  const handleAddTarefa = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!processo?.id || !user) return;
    setAddLoading(true);
    const fd = new FormData(e.currentTarget);
    const titulo = (fd.get('titulo') as string || '').trim();
    if (!titulo) { toast({ title: 'Título obrigatório', variant: 'destructive' }); setAddLoading(false); return; }
    const { error } = await supabase.from('tarefas').insert({
      user_id: user.id, processo_id: processo.id,
      titulo, descricao: fd.get('descricao') as string || null,
      data_vencimento: fd.get('data_vencimento') as string || null,
      prioridade: fd.get('prioridade') as string || 'media',
      status: 'pendente',
    });
    if (error) { toast({ title: 'Erro ao criar tarefa', description: error.message, variant: 'destructive' }); }
    else { toast({ title: 'Tarefa criada' }); setShowAddTarefa(false); fetchSubData('tarefas'); }
    setAddLoading(false);
  };

  const handleAddTimesheet = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!processo?.id || !user) return;
    setAddLoading(true);
    const fd = new FormData(e.currentTarget);
    const descricao = (fd.get('descricao') as string || '').trim();
    const duracao = Number(fd.get('duracao')) || 0;
    if (!descricao || duracao <= 0) {
      toast({ title: 'Preencha descrição e duração', variant: 'destructive' });
      setAddLoading(false); return;
    }
    const now = new Date();
    const { error } = await supabase.from('timesheets').insert({
      user_id: user.id, office_id: user.office_id, processo_id: processo.id,
      tarefa_descricao: descricao,
      categoria: fd.get('categoria') as string || 'geral',
      data_inicio: new Date(now.getTime() - duracao * 60000).toISOString(),
      data_fim: now.toISOString(),
      duracao_minutos: duracao,
      status: 'finalizado',
    });
    if (error) { toast({ title: 'Erro ao registrar tempo', description: error.message, variant: 'destructive' }); }
    else { toast({ title: 'Tempo registrado' }); setShowAddTimesheet(false); fetchSubData('timesheet'); }
    setAddLoading(false);
  };

  const handleAddAtendimento = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!processo?.id || !user) return;
    setAddLoading(true);
    const fd = new FormData(e.currentTarget);
    const data = fd.get('data') as string;
    if (!data) { toast({ title: 'Data obrigatória', variant: 'destructive' }); setAddLoading(false); return; }
    const { error } = await supabase.from('atendimentos').insert({
      user_id: user.id, office_id: user.office_id, processo_id: processo.id,
      cliente_id: processo.clienteId || null,
      tipo_atendimento: fd.get('tipo') as string || 'reuniao',
      data_atendimento: new Date(`${data}T${fd.get('horario') || '00:00'}`).toISOString(),
      observacoes: fd.get('observacoes') as string || null,
      status: 'agendado',
    });
    if (error) { toast({ title: 'Erro ao criar atendimento', description: error.message, variant: 'destructive' }); }
    else { toast({ title: 'Atendimento criado' }); setShowAddAtendimento(false); fetchSubData('atendimentos'); }
    setAddLoading(false);
  };

  const toggleTarefa = async (t: any) => {
    const newStatus = !t.concluida;
    const { error } = await supabase.from('tarefas').update({ concluida: newStatus, status: newStatus ? 'concluida' : 'pendente' }).eq('id', t.id);
    if (!error) fetchSubData('tarefas');
    else toast({ title: 'Erro ao atualizar tarefa', variant: 'destructive' });
  };

  // ── Publicações actions ──
  const [expandedPubId, setExpandedPubId] = useState<string | null>(null);

  const handlePubStatus = async (id: string, status: string) => {
    await supabase.from('publicacoes').update({ status }).eq('id', id);
    setPublicacoes(prev => prev.map(p => p.id === id ? { ...p, status } : p));
    toast({ title: status === 'lida' ? 'Marcada como lida' : status === 'arquivada' ? 'Arquivada' : 'Atualizada' });
  };

  const handleCopyPub = (conteudo: string) => {
    const clean = conteudo
      .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>|<\/div>/gi, '\n')
      .replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/\n{3,}/g, '\n\n').trim();
    navigator.clipboard.writeText(clean);
    toast({ title: 'Copiado' });
  };

  const handlePubUrgencia = async (id: string, urgencia: string) => {
    await supabase.from('publicacoes').update({ urgencia }).eq('id', id);
    setPublicacoes(prev => prev.map(p => p.id === id ? { ...p, urgencia } : p));
    toast({ title: `Urgência: ${urgencia}` });
  };

  // ── Tratar publicação (criar prazo/tarefa a partir dela) ──
  const [tratandoPubId, setTratandoPubId] = useState<string | null>(null);

  const handleTratarPub = async (e: React.FormEvent<HTMLFormElement>, pub: any) => {
    e.preventDefault();
    if (!processo?.id || !user) return;
    setAddLoading(true);
    const fd = new FormData(e.currentTarget);
    const tipo = fd.get('tipo_tratamento') as string;
    const titulo = (fd.get('titulo') as string || '').trim();
    if (!titulo) { toast({ title: 'Título obrigatório', variant: 'destructive' }); setAddLoading(false); return; }
    let insertError: any = null;
    if (tipo === 'prazo') {
      const { error } = await supabase.from('prazos').insert({
        user_id: user.id, office_id: user.office_id, processo_id: processo.id,
        titulo, descricao: `Originado da publicação de ${fmtDate(pub.data_publicacao)}: ${pub.titulo}`,
        data_vencimento: fd.get('data_vencimento') as string,
        prioridade: fd.get('prioridade') as string || 'alta', status: 'pendente',
      });
      insertError = error;
      if (!error) toast({ title: 'Prazo criado a partir da publicação' });
    } else if (tipo === 'tarefa') {
      const { error } = await supabase.from('tarefas').insert({
        user_id: user.id, processo_id: processo.id,
        titulo, descricao: `Originado da publicação de ${fmtDate(pub.data_publicacao)}: ${pub.titulo}`,
        data_vencimento: fd.get('data_vencimento') as string || null,
        prioridade: fd.get('prioridade') as string || 'media', status: 'pendente',
      });
      insertError = error;
      if (!error) toast({ title: 'Tarefa criada a partir da publicação' });
    } else if (tipo === 'audiencia') {
      const { error } = await supabase.from('audiencias').insert({
        user_id: user.id, office_id: user.office_id, processo_id: processo.id,
        titulo, data_audiencia: new Date(`${fd.get('data_vencimento')}T${fd.get('horario') || '00:00'}`).toISOString(),
        observacoes: `Originado da publicação de ${fmtDate(pub.data_publicacao)}`, status: 'agendado',
      });
      insertError = error;
      if (!error) toast({ title: 'Audiência criada a partir da publicação' });
    }
    if (insertError) {
      toast({ title: 'Erro ao salvar', description: insertError.message, variant: 'destructive' });
    } else {
      await supabase.from('publicacoes').update({ status: 'processada' }).eq('id', pub.id);
      setPublicacoes(prev => prev.map(p => p.id === pub.id ? { ...p, status: 'processada' } : p));
      setTratandoPubId(null);
    }
    setAddLoading(false);
  };

  // ── Andamento manual ──
  const [showAddAndamento, setShowAddAndamento] = useState(false);

  const handleAddAndamento = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!processo?.id || !user) return;
    setAddLoading(true);
    const fd = new FormData(e.currentTarget);
    const descricao = (fd.get('descricao') as string || '').trim();
    const data = fd.get('data') as string;
    if (!descricao || !data) {
      toast({ title: 'Preencha descrição e data', variant: 'destructive' });
      setAddLoading(false); return;
    }
    const { error } = await supabase.from('movimentacoes_processo').insert({
      processo_id: processo.id, office_id: user.office_id,
      data_movimentacao: data, descricao,
      tipo: fd.get('tipo') as string || 'manual', fonte: 'manual',
    });
    if (error) { toast({ title: 'Erro ao registrar andamento', description: error.message, variant: 'destructive' }); }
    else { toast({ title: 'Andamento registrado' }); setShowAddAndamento(false); fetchMovements(); }
    setAddLoading(false);
  };

  // ── Style helpers ──
  const getStatusStyle = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s.includes('andamento') || s === 'ativo') return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
    if (s.includes('concluído') || s.includes('encerrado')) return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
    if (s.includes('suspenso')) return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
    return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20';
  };

  const getPrioridadeStyle = (p: string) => {
    if (p === 'alta' || p === 'urgente') return 'text-rose-600 bg-rose-500/10 border-rose-500/20';
    if (p === 'media') return 'text-amber-600 bg-amber-500/10 border-amber-500/20';
    return 'text-slate-600 bg-slate-500/10 border-slate-500/20';
  };

  // Atalho: liga um campo da capa ao editData (setState funcional evita closure obsoleto)
  const fieldProps = (field: keyof typeof editData) => ({
    editing,
    value: String(editData[field] ?? ''),
    onChange: (v: string) =>
      setEditData((prev) => ({ ...prev, [field]: field === 'valor_causa' ? Number(v) || 0 : v })),
  });

  const EmptySub = ({ icon: Icon, label }: { icon: any; label: string }) => (
    <div className="py-16 flex flex-col items-center justify-center text-center space-y-3 opacity-30">
      <Icon className="h-10 w-10" />
      <p className="font-black uppercase tracking-widest text-xs">Nenhum(a) {label}</p>
    </div>
  );

  const SectionHeader = ({ label, count, onAdd }: { label: string; count: number; onAdd?: () => void }) => (
    <div className="flex items-center justify-between mb-4">
      <p className="text-[10px] text-muted-foreground/60 uppercase font-black tracking-widest">
        {loadingSub ? 'Carregando...' : `${count} ${label}`}
      </p>
      {onAdd && (
        <Button variant="outline" size="sm" onClick={onAdd} className="h-7 rounded-xl text-[10px] gap-1 px-3 font-black uppercase tracking-widest">
          <Plus className="h-3 w-3" /> Novo
        </Button>
      )}
    </div>
  );

  const tabs = [
    { value: 'resumo', label: 'Resumo', icon: Info },
    { value: 'timeline', label: 'Histórico', icon: History },
    { value: 'publicacoes', label: 'Publicações', icon: Megaphone },
    { value: 'prazos', label: 'Prazos', icon: CalendarClock },
    { value: 'audiencias', label: 'Audiências', icon: Gavel },
    { value: 'atendimentos', label: 'Atendimentos', icon: Users },
    { value: 'tarefas', label: 'Tarefas', icon: ListTodo },
    { value: 'timesheet', label: 'Timesheet', icon: Timer },
    { value: 'partes', label: 'Partes', icon: User },
  ];

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="max-w-5xl w-[96vw] h-[92vh] p-0 rounded-3xl border border-border bg-background shadow-2xl flex flex-col overflow-hidden gap-0">

        {/* ═══ HEADER ═══ */}
        <div className="px-8 pt-7 pb-4 space-y-4 border-b border-border shrink-0 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-primary/5 blur-[120px] -mr-40 -mt-40 rounded-full pointer-events-none" />

          <div className="flex items-start justify-between relative">
            <div className="space-y-2.5 flex-1 min-w-0 pr-4">
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
                <Input className="text-2xl font-black rounded-xl bg-background border-border h-14 focus:ring-2 focus:ring-primary/20" value={editData.titulo} onChange={(e) => setEditData({ ...editData, titulo: e.target.value })} />
              ) : (
                <DialogTitle className="text-2xl md:text-3xl font-black text-foreground leading-tight tracking-tight pr-8">
                  {processo.titulo}
                </DialogTitle>
              )}

              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary/50 animate-pulse" />
                <span className="font-mono text-sm font-bold text-primary tracking-tight">{formatCNJ(processo.numeroProcesso)}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {editing ? (
                <>
                  <Button variant="ghost" size="sm" onClick={() => setEditing(false)} className="h-9 rounded-xl text-xs gap-1.5"><X className="h-3.5 w-3.5" /> Cancelar</Button>
                  <Button size="sm" onClick={handleSave} disabled={saving} className="h-9 rounded-xl text-xs gap-1.5 shadow-md"><Save className="h-3.5 w-3.5" /> {saving ? 'Salvando...' : 'Salvar'}</Button>
                </>
              ) : (
                <div className="flex gap-2">
                  {processo.numeroProcesso && (
                    <Button variant="outline" size="sm" onClick={() => setCompletarOpen(true)} className="h-9 rounded-xl text-xs gap-1.5 border-border" title="Buscar dados no tribunal e completar os campos vazios">
                      <Sparkles className="h-3.5 w-3.5 text-primary" /> Completar dados
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="h-9 rounded-xl text-xs gap-1.5 border-border"><Edit className="h-3.5 w-3.5" /> Editar</Button>
                </div>
              )}
            </div>
          </div>

          {/* Tabs - scrollable */}
          <div className="overflow-x-auto -mx-8 px-8 pb-1">
            <div className="flex gap-1 bg-muted/40 p-1 rounded-2xl w-max min-w-full">
              {tabs.map(t => {
                const Icon = t.icon;
                const isActive = activeTab === t.value;
                return (
                  <button
                    key={t.value}
                    onClick={() => setActiveTab(t.value)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all",
                      isActive ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ═══ CONTEÚDO ═══ */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="p-8">

            {/* ── RESUMO ── */}
            {activeTab === 'resumo' && (
              <div className="space-y-8">
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

                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-[.2em]">
                    <Gavel className="h-4 w-4" /><span>Capa Jurídica</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-6 rounded-2xl border border-border bg-muted/20">
                    <CapaField label="Classe" {...fieldProps('classe_judicial')} />
                    <CapaField label="Assunto Principal" {...fieldProps('assunto_principal')} />
                    <CapaField label="Fase Atual" {...fieldProps('fase_processual')} />
                    <CapaField label="Instância" {...fieldProps('instancia')} />
                    <CapaField label="Tribunal" icon={<Building2 className="h-3.5 w-3.5 text-primary/60" />} {...fieldProps('tribunal')} />
                    <CapaField label="Vara" icon={<MapPin className="h-3.5 w-3.5 text-primary/60" />} {...fieldProps('vara')} />
                    <CapaField label="Comarca / UF" {...fieldProps('comarca')} />

                    {officeTeams.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] text-muted-foreground/60 uppercase font-black tracking-widest">Equipe Responsável</p>
                        {editing ? (
                          <Select
                            value={editData.team_id || 'none'}
                            onValueChange={(v) => setEditData({ ...editData, team_id: v === 'none' ? '' : v })}
                          >
                            <SelectTrigger className="h-10 text-sm rounded-xl bg-background border-border">
                              <SelectValue placeholder="Sem equipe específica" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Sem equipe específica</SelectItem>
                              {officeTeams.map(t => (
                                <SelectItem key={t.id} value={t.id}>
                                  <span className="flex items-center gap-2">
                                    <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: t.color }} />
                                    {t.name}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="flex items-center gap-2 min-h-[40px] px-3 py-2 rounded-xl bg-muted/20 border border-transparent">
                            {(() => {
                              const team = officeTeams.find(t => t.id === editData.team_id);
                              return team
                                ? <><span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: team.color }} /><p className="text-sm font-semibold">{team.name}</p></>
                                : <p className="text-sm font-semibold text-foreground/40">—</p>;
                            })()}
                          </div>
                        )}
                      </div>
                    )}

                    {officeUsers.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] text-muted-foreground/60 uppercase font-black tracking-widest">Responsável</p>
                        {editing ? (
                          <Select
                            value={editData.responsavel_id || ''}
                            onValueChange={(v) => setEditData({ ...editData, responsavel_id: v })}
                          >
                            <SelectTrigger className="h-10 text-sm rounded-xl bg-background border-border">
                              <SelectValue placeholder="Selecionar responsável" />
                            </SelectTrigger>
                            <SelectContent>
                              {officeUsers.map(u => (
                                <SelectItem key={u.user_id} value={u.user_id}>
                                  {u.profile?.full_name || u.profile?.email || "Membro"}
                                  {u.user_id === user?.id ? " (você)" : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="flex items-center gap-2 min-h-[40px] px-3 py-2 rounded-xl bg-muted/20 border border-transparent">
                            {(() => {
                              const resp = officeUsers.find(u => u.user_id === editData.responsavel_id);
                              const nome = resp?.profile?.full_name || resp?.profile?.email;
                              return <p className={cn("text-sm font-semibold", !nome && "text-foreground/40")}>{nome || "—"}</p>;
                            })()}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Resultado / Desfecho */}
                    <div className="space-y-1.5">
                      <p className="text-[10px] text-muted-foreground/60 uppercase font-black tracking-widest">Resultado</p>
                      {editing ? (
                        <Select value={editData.resultado || 'none'} onValueChange={(v) => setEditData({ ...editData, resultado: v === 'none' ? '' : v })}>
                          <SelectTrigger className="h-10 text-sm rounded-xl bg-background border-border">
                            <SelectValue placeholder="Sem desfecho" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sem desfecho</SelectItem>
                            <SelectItem value="ganho">Ganho (procedente)</SelectItem>
                            <SelectItem value="parcial">Parcialmente procedente</SelectItem>
                            <SelectItem value="acordo">Acordo</SelectItem>
                            <SelectItem value="perda">Perda (improcedente)</SelectItem>
                            <SelectItem value="extinto">Extinto sem mérito</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="flex items-center gap-2 min-h-[40px] px-3 py-2 rounded-xl bg-muted/20 border border-transparent">
                          {(() => {
                            const labels: Record<string, string> = { ganho: "Ganho", parcial: "Parcialmente procedente", acordo: "Acordo", perda: "Perda", extinto: "Extinto sem mérito" };
                            const v = labels[editData.resultado];
                            return <p className={cn("text-sm font-semibold", !v && "text-foreground/40")}>{v || "—"}</p>;
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {(processo.parteAutora || processo.requerido) && !editing && (
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
                )}
              </div>
            )}

            {/* ── HISTÓRICO ── */}
            {activeTab === 'timeline' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] text-muted-foreground/60 uppercase font-black tracking-widest">
                    {syncing ? 'Sincronizando…' : `${movements.length} movimentação(ões)`}
                  </p>
                  <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" onClick={() => setShowAddAndamento(true)} className="h-7 rounded-xl text-[10px] gap-1 px-3 font-black uppercase tracking-widest">
                      <Plus className="h-3 w-3" /> Andamento Manual
                    </Button>
                    <button onClick={() => syncFromOrigin()} disabled={syncing} className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-black text-primary/70 hover:text-primary disabled:opacity-30 transition-colors">
                      <RotateCw className={cn("h-3 w-3", syncing && "animate-spin")} />
                      {syncing ? 'Atualizando' : 'Atualizar'}
                    </button>
                  </div>
                </div>

                {showAddAndamento && (
                  <AddForm loading={addLoading} onSubmit={handleAddAndamento} onCancel={() => setShowAddAndamento(false)}>
                    <Input name="descricao" placeholder="Descrição do andamento" required className="h-9 rounded-xl text-sm" />
                    <div className="grid grid-cols-2 gap-3">
                      <Input name="data" type="date" required defaultValue={new Date().toISOString().split('T')[0]} className="h-9 rounded-xl text-sm" />
                      <select name="tipo" className="h-9 rounded-xl text-sm border border-border bg-background px-3">
                        <option value="despacho">Despacho</option>
                        <option value="decisão">Decisão</option>
                        <option value="sentença">Sentença</option>
                        <option value="petição">Petição</option>
                        <option value="audiência">Audiência</option>
                        <option value="juntada">Juntada</option>
                        <option value="distribuição">Distribuição</option>
                        <option value="outro">Outro</option>
                      </select>
                    </div>
                  </AddForm>
                )}
                {loadingMovements && movements.length === 0 ? (
                  <div className="py-20 flex flex-col items-center justify-center space-y-4 opacity-40">
                    <Clock className="h-10 w-10 animate-pulse text-primary" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Consultando cronologia...</p>
                  </div>
                ) : movements.length > 0 ? (
                  <div className="relative pl-6 space-y-8 border-l-2 border-border ml-2 pt-2 pb-10">
                    {movements.map((mov) => (
                      <div key={mov.id} className="relative group">
                        <div className="absolute -left-[29px] top-1 h-3.5 w-3.5 rounded-full bg-background border-2 border-primary/40 ring-4 ring-primary/5" />
                        <div className="space-y-1.5 pl-2">
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-[10px] font-black text-primary/80 bg-primary/5 px-2.5 py-0.5 rounded-lg">{fmtDate(mov.data)}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] uppercase tracking-widest text-muted-foreground/40 font-bold">{mov.tipo || 'Andamento'}</span>
                              {confirmDelMov === (mov as any).id ? (
                                <span className="flex items-center gap-1">
                                  <button onClick={() => handleDeleteMovement((mov as any).id)} disabled={delMovLoading}
                                    className="text-[9px] font-black uppercase tracking-widest text-rose-600 hover:text-rose-700 disabled:opacity-40">
                                    {delMovLoading ? '...' : 'Excluir'}
                                  </button>
                                  <span className="text-muted-foreground/30">/</span>
                                  <button onClick={() => setConfirmDelMov(null)} disabled={delMovLoading}
                                    className="text-[9px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground">
                                    Cancelar
                                  </button>
                                </span>
                              ) : (
                                <button onClick={() => setConfirmDelMov((mov as any).id)} title="Excluir andamento"
                                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/40 hover:text-rose-500">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                          <p className="text-sm font-semibold text-foreground/85 leading-relaxed">{mov.texto}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptySub icon={History} label="movimentação" />
                )}
              </div>
            )}

            {/* ── PUBLICAÇÕES ── */}
            {activeTab === 'publicacoes' && (
              <div className="space-y-4">
                <SectionHeader label="publicação(ões)" count={publicacoes.length} />
                {publicacoes.length > 0 ? publicacoes.map(pub => {
                  const isExpanded = expandedPubId === pub.id;
                  const cleanContent = (pub.conteudo || '')
                    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>|<\/div>/gi, '\n')
                    .replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
                    .replace(/&quot;/g, '"').replace(/\n{3,}/g, '\n\n').trim();
                  return (
                    <div key={pub.id} className={cn("rounded-2xl border transition-all", pub.status === 'nova' ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/10')}>
                      {/* Header */}
                      <div className="p-5 space-y-3">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-black text-primary/80 bg-primary/5 px-2.5 py-0.5 rounded-lg">{fmtDate(pub.data_publicacao)}</span>
                            {pub.tipo_documento && <Badge variant="outline" className="text-[9px] font-bold uppercase">{pub.tipo_documento}</Badge>}
                            {/* Urgência clicável */}
                            <button onClick={() => handlePubUrgencia(pub.id, pub.urgencia === 'alta' ? 'media' : pub.urgencia === 'media' ? 'baixa' : 'alta')}>
                              <Badge variant="outline" className={cn("text-[9px] font-bold uppercase cursor-pointer hover:opacity-80", pub.urgencia === 'alta' ? 'border-rose-500/30 text-rose-600 bg-rose-500/10' : pub.urgencia === 'media' ? 'border-amber-500/30 text-amber-600 bg-amber-500/10' : 'border-slate-500/30 text-slate-500')}>
                                {pub.urgencia === 'alta' ? '● Alta' : pub.urgencia === 'media' ? '● Média' : '● Baixa'}
                              </Badge>
                            </button>
                          </div>
                          <Badge variant="outline" className={cn("text-[9px] font-bold uppercase", pub.status === 'nova' ? 'border-blue-500/30 text-blue-600 bg-blue-500/10' : pub.status === 'lida' ? 'border-emerald-500/30 text-emerald-600' : 'border-slate-500/30 text-slate-500')}>
                            {pub.status}
                          </Badge>
                        </div>
                        <h4 className="font-bold text-sm cursor-pointer hover:text-primary transition-colors" onClick={() => setExpandedPubId(isExpanded ? null : pub.id)}>
                          {pub.titulo}
                        </h4>
                        {pub.tribunal && <p className="text-[10px] text-muted-foreground/50">{pub.tribunal}{pub.vara ? ` · ${pub.vara}` : ''}{pub.comarca ? ` · ${pub.comarca}` : ''}</p>}

                        {/* Conteúdo resumido ou expandido */}
                        {isExpanded ? (
                          <div className="bg-muted/20 p-5 rounded-xl border border-border mt-2">
                            <p className="text-sm leading-[1.8] whitespace-pre-wrap text-foreground/90">{cleanContent || 'Conteúdo não disponível.'}</p>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 cursor-pointer" onClick={() => setExpandedPubId(pub.id)}>
                            {cleanContent.slice(0, 200)}{cleanContent.length > 200 ? '...' : ''}
                          </p>
                        )}
                      </div>

                      {/* Ações */}
                      <div className="px-5 pb-4 flex flex-wrap gap-2">
                        <Button variant="ghost" size="sm" className="h-7 rounded-xl text-[10px] gap-1 font-bold uppercase tracking-widest" onClick={() => setExpandedPubId(isExpanded ? null : pub.id)}>
                          <FileText className="h-3 w-3" /> {isExpanded ? 'Recolher' : 'Ler Completo'}
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 rounded-xl text-[10px] gap-1 font-bold uppercase tracking-widest" onClick={() => handleCopyPub(pub.conteudo)}>
                          <Check className="h-3 w-3" /> Copiar
                        </Button>
                        {pub.status === 'nova' && (
                          <Button variant="ghost" size="sm" className="h-7 rounded-xl text-[10px] gap-1 font-bold uppercase tracking-widest text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10" onClick={() => handlePubStatus(pub.id, 'lida')}>
                            <CheckCircle2 className="h-3 w-3" /> Marcar como Lida
                          </Button>
                        )}
                        {pub.status === 'lida' && (
                          <Button variant="ghost" size="sm" className="h-7 rounded-xl text-[10px] gap-1 font-bold uppercase tracking-widest text-blue-600 hover:text-blue-700 hover:bg-blue-500/10" onClick={() => handlePubStatus(pub.id, 'processada')}>
                            <CheckCircle2 className="h-3 w-3" /> Marcar como Processada
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="h-7 rounded-xl text-[10px] gap-1 font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground" onClick={() => handlePubStatus(pub.id, 'arquivada')}>
                          <X className="h-3 w-3" /> Arquivar
                        </Button>
                        {pub.status !== 'processada' && (
                          <Button variant="ghost" size="sm" className="h-7 rounded-xl text-[10px] gap-1 font-bold uppercase tracking-widest text-violet-600 hover:text-violet-700 hover:bg-violet-500/10" onClick={() => setTratandoPubId(tratandoPubId === pub.id ? null : pub.id)}>
                            <CalendarClock className="h-3 w-3" /> Tratar
                          </Button>
                        )}
                      </div>

                      {/* Formulário de tratamento */}
                      {tratandoPubId === pub.id && (
                        <div className="px-5 pb-5">
                          <form onSubmit={(e) => handleTratarPub(e, pub)} className="p-5 rounded-2xl border border-violet-500/20 bg-violet-500/5 space-y-4 animate-in fade-in duration-300">
                            <p className="text-[10px] font-black uppercase tracking-widest text-violet-600">Criar a partir desta publicação</p>
                            <select name="tipo_tratamento" required className="h-9 w-full rounded-xl text-sm border border-border bg-background px-3">
                              <option value="prazo">Prazo</option>
                              <option value="tarefa">Tarefa</option>
                              <option value="audiencia">Audiência</option>
                            </select>
                            <Input name="titulo" placeholder="Título" required defaultValue={pub.titulo?.slice(0, 80)} className="h-9 rounded-xl text-sm" />
                            <div className="grid grid-cols-3 gap-3">
                              <Input name="data_vencimento" type="date" required className="h-9 rounded-xl text-sm" />
                              <Input name="horario" type="time" placeholder="Horário" className="h-9 rounded-xl text-sm" />
                              <select name="prioridade" className="h-9 rounded-xl text-sm border border-border bg-background px-3">
                                <option value="baixa">Baixa</option>
                                <option value="media">Média</option>
                                <option value="alta" selected>Alta</option>
                                <option value="urgente">Urgente</option>
                              </select>
                            </div>
                            <div className="flex justify-end gap-2">
                              <Button type="button" variant="ghost" size="sm" onClick={() => setTratandoPubId(null)} className="rounded-xl text-xs h-8">Cancelar</Button>
                              <Button type="submit" size="sm" disabled={addLoading} className="rounded-xl text-xs h-8 gap-1.5 bg-violet-600 hover:bg-violet-700 text-white">
                                {addLoading ? <RotateCw className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Criar e Processar
                              </Button>
                            </div>
                          </form>
                        </div>
                      )}
                    </div>
                  );
                }) : <EmptySub icon={Megaphone} label="publicação" />}
              </div>
            )}

            {/* ── PRAZOS ── */}
            {activeTab === 'prazos' && (
              <div className="space-y-4">
                <SectionHeader label="prazo(s)" count={prazos.length} onAdd={() => setShowAddPrazo(true)} />
                {showAddPrazo && (
                  <AddForm loading={addLoading} onSubmit={handleAddPrazo} onCancel={() => setShowAddPrazo(false)}>
                    <Input name="titulo" placeholder="Título do prazo" required className="h-9 rounded-xl text-sm" />
                    <Input name="descricao" placeholder="Descrição (opcional)" className="h-9 rounded-xl text-sm" />
                    <div className="grid grid-cols-2 gap-3">
                      <Input name="data_vencimento" type="date" required className="h-9 rounded-xl text-sm" />
                      <select name="prioridade" className="h-9 rounded-xl text-sm border border-border bg-background px-3">
                        <option value="baixa">Baixa</option>
                        <option value="media" selected>Média</option>
                        <option value="alta">Alta</option>
                        <option value="urgente">Urgente</option>
                      </select>
                    </div>
                  </AddForm>
                )}
                {prazos.length > 0 ? prazos.map(p => {
                  const dataFatal = p.data_fim_prazo || p.data_vencimento || null;
                  const vencido = p.status !== 'concluido' && dataFatal && new Date(dataFatal) < new Date();
                  return (
                    <div key={p.id} className={cn("p-4 rounded-2xl border flex items-center gap-4", vencido ? 'border-rose-500/20 bg-rose-500/5' : 'border-border bg-muted/10')}>
                      {vencido ? <AlertTriangle className="h-5 w-5 text-rose-500 shrink-0" /> : p.status === 'concluido' ? <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" /> : <CalendarClock className="h-5 w-5 text-amber-500 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className={cn("font-bold text-sm", p.status === 'concluido' && 'line-through opacity-50')}>{p.titulo}</p>
                        {p.descricao && <p className="text-xs text-muted-foreground mt-0.5">{p.descricao}</p>}
                      </div>
                      <div className="text-right shrink-0 space-y-1">
                        <p className={cn("text-xs font-bold", vencido ? 'text-rose-600' : 'text-muted-foreground')}>{fmtDate(dataFatal)}</p>
                        {p.prioridade && <Badge variant="outline" className={cn("text-[9px] font-bold uppercase", getPrioridadeStyle(p.prioridade))}>{p.prioridade}</Badge>}
                      </div>
                    </div>
                  );
                }) : !showAddPrazo && <EmptySub icon={CalendarClock} label="prazo" />}
              </div>
            )}

            {/* ── AUDIÊNCIAS ── */}
            {activeTab === 'audiencias' && (
              <div className="space-y-4">
                <SectionHeader label="audiência(s)" count={audiencias.length} onAdd={() => setShowAddAudiencia(true)} />
                {showAddAudiencia && (
                  <AddForm loading={addLoading} onSubmit={handleAddAudiencia} onCancel={() => setShowAddAudiencia(false)}>
                    <Input name="titulo" placeholder="Título da audiência" required className="h-9 rounded-xl text-sm" />
                    <div className="grid grid-cols-2 gap-3">
                      <Input name="data" type="date" required className="h-9 rounded-xl text-sm" />
                      <Input name="horario" type="time" required className="h-9 rounded-xl text-sm" />
                    </div>
                    <Input name="local" placeholder="Local (opcional)" className="h-9 rounded-xl text-sm" />
                    <Input name="tipo" placeholder="Tipo (conciliação, instrução...)" className="h-9 rounded-xl text-sm" />
                    <Input name="observacoes" placeholder="Observações (opcional)" className="h-9 rounded-xl text-sm" />
                  </AddForm>
                )}
                {audiencias.length > 0 ? audiencias.map(a => (
                  <div key={a.id} className="p-4 rounded-2xl border border-border bg-muted/10 flex items-center gap-4">
                    <div className="p-2.5 rounded-xl bg-violet-500/10"><Gavel className="h-5 w-5 text-violet-500" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm">{a.titulo}</p>
                      {a.local && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><MapPin className="h-3 w-3" />{a.local}</p>}
                      {a.tipo && <Badge variant="outline" className="text-[9px] font-bold uppercase mt-1">{a.tipo}</Badge>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-primary">{fmtDateTime(a.data_audiencia)}</p>
                      <Badge variant="outline" className="text-[9px] font-bold uppercase mt-1">{a.status}</Badge>
                    </div>
                  </div>
                )) : !showAddAudiencia && <EmptySub icon={Gavel} label="audiência" />}
              </div>
            )}

            {/* ── ATENDIMENTOS ── */}
            {activeTab === 'atendimentos' && (
              <div className="space-y-4">
                <SectionHeader label="atendimento(s)" count={atendimentos.length} onAdd={() => setShowAddAtendimento(true)} />
                {showAddAtendimento && (
                  <AddForm loading={addLoading} onSubmit={handleAddAtendimento} onCancel={() => setShowAddAtendimento(false)}>
                    <Input name="tipo" placeholder="Tipo (reunião, ligação, email...)" required className="h-9 rounded-xl text-sm" />
                    <div className="grid grid-cols-2 gap-3">
                      <Input name="data" type="date" required className="h-9 rounded-xl text-sm" />
                      <Input name="horario" type="time" required className="h-9 rounded-xl text-sm" />
                    </div>
                    <Textarea name="observacoes" placeholder="Observações (opcional)" className="rounded-xl text-sm min-h-[80px]" />
                  </AddForm>
                )}
                {atendimentos.length > 0 ? atendimentos.map(a => (
                  <div key={a.id} className="p-4 rounded-2xl border border-border bg-muted/10 flex items-center gap-4">
                    <div className="p-2.5 rounded-xl bg-sky-500/10"><Users className="h-5 w-5 text-sky-500" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm capitalize">{a.tipo_atendimento}</p>
                      {a.observacoes && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{a.observacoes}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-primary">{fmtDateTime(a.data_atendimento)}</p>
                      {a.duracao && <p className="text-[10px] text-muted-foreground">{a.duracao} min</p>}
                    </div>
                  </div>
                )) : !showAddAtendimento && <EmptySub icon={Users} label="atendimento" />}
              </div>
            )}

            {/* ── TAREFAS ── */}
            {activeTab === 'tarefas' && (
              <div className="space-y-4">
                <SectionHeader label="tarefa(s)" count={tarefas.length} onAdd={() => setShowAddTarefa(true)} />
                {showAddTarefa && (
                  <AddForm loading={addLoading} onSubmit={handleAddTarefa} onCancel={() => setShowAddTarefa(false)}>
                    <Input name="titulo" placeholder="Título da tarefa" required className="h-9 rounded-xl text-sm" />
                    <Input name="descricao" placeholder="Descrição (opcional)" className="h-9 rounded-xl text-sm" />
                    <div className="grid grid-cols-2 gap-3">
                      <Input name="data_vencimento" type="date" className="h-9 rounded-xl text-sm" />
                      <select name="prioridade" className="h-9 rounded-xl text-sm border border-border bg-background px-3">
                        <option value="baixa">Baixa</option>
                        <option value="media" selected>Média</option>
                        <option value="alta">Alta</option>
                      </select>
                    </div>
                  </AddForm>
                )}
                {tarefas.length > 0 ? tarefas.map(t => (
                  <div key={t.id} className="p-4 rounded-2xl border border-border bg-muted/10 flex items-center gap-4">
                    <button onClick={() => toggleTarefa(t)} className="shrink-0">
                      {t.concluida ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <Circle className="h-5 w-5 text-muted-foreground/40 hover:text-primary transition-colors" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={cn("font-bold text-sm", t.concluida && 'line-through opacity-50')}>{t.titulo}</p>
                      {t.descricao && <p className="text-xs text-muted-foreground mt-0.5">{t.descricao}</p>}
                    </div>
                    <div className="text-right shrink-0 space-y-1">
                      {t.data_vencimento && <p className="text-xs text-muted-foreground">{fmtDate(t.data_vencimento)}</p>}
                      {t.prioridade && <Badge variant="outline" className={cn("text-[9px] font-bold uppercase", getPrioridadeStyle(t.prioridade))}>{t.prioridade}</Badge>}
                    </div>
                  </div>
                )) : !showAddTarefa && <EmptySub icon={ListTodo} label="tarefa" />}
              </div>
            )}

            {/* ── TIMESHEET ── */}
            {activeTab === 'timesheet' && (
              <div className="space-y-4">
                <SectionHeader label="registro(s)" count={timesheets.length} onAdd={() => setShowAddTimesheet(true)} />
                {showAddTimesheet && (
                  <AddForm loading={addLoading} onSubmit={handleAddTimesheet} onCancel={() => setShowAddTimesheet(false)}>
                    <Input name="descricao" placeholder="Descrição da atividade" required className="h-9 rounded-xl text-sm" />
                    <div className="grid grid-cols-2 gap-3">
                      <Input name="duracao" type="number" placeholder="Duração (min)" required className="h-9 rounded-xl text-sm" />
                      <select name="categoria" className="h-9 rounded-xl text-sm border border-border bg-background px-3">
                        <option value="geral">Geral</option>
                        <option value="audiencia">Audiência</option>
                        <option value="peticao">Petição</option>
                        <option value="reuniao">Reunião</option>
                        <option value="pesquisa">Pesquisa</option>
                        <option value="administrativo">Administrativo</option>
                      </select>
                    </div>
                  </AddForm>
                )}
                {timesheets.length > 0 ? (
                  <>
                    <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-widest text-primary">Total</span>
                      <span className="font-black text-lg text-primary">{fmtDuration(timesheets.reduce((s, t) => s + (t.duracao_minutos || 0), 0))}</span>
                    </div>
                    {timesheets.map(t => (
                      <div key={t.id} className="p-4 rounded-2xl border border-border bg-muted/10 flex items-center gap-4">
                        <div className="p-2.5 rounded-xl bg-orange-500/10"><Timer className="h-5 w-5 text-orange-500" /></div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm">{t.tarefa_descricao}</p>
                          <p className="text-[10px] text-muted-foreground uppercase mt-0.5">{t.categoria}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-black text-sm text-orange-600 dark:text-orange-400">{fmtDuration(t.duracao_minutos)}</p>
                          <p className="text-[10px] text-muted-foreground">{fmtDate(t.data_inicio)}</p>
                        </div>
                      </div>
                    ))}
                  </>
                ) : !showAddTimesheet && <EmptySub icon={Timer} label="registro" />}
              </div>
            )}

            {/* ── PARTES ── */}
            {activeTab === 'partes' && (
              <div className="space-y-6">
                <div className="p-6 rounded-2xl border border-emerald-500/15 bg-emerald-500/5 space-y-4">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                    <User className="h-4 w-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Polo Ativo (Autor / Requerente)</span>
                  </div>
                  {editing ? (
                    <Input className="h-10 rounded-xl bg-background border-border" value={editData.parte_autora} onChange={(e) => setEditData({ ...editData, parte_autora: e.target.value })} placeholder="Nome do autor..." />
                  ) : (
                    <p className="text-base font-bold text-foreground leading-relaxed">{processo.parteAutora || <span className="text-muted-foreground/50 italic">Não identificado</span>}</p>
                  )}
                  <Button variant={processo.clienteId && processo.cliente === (processo.parteAutora || '') ? 'default' : 'outline'} size="sm" className="w-full rounded-xl gap-2 font-black text-[10px] h-9 uppercase tracking-widest" disabled={savingCliente || !(editData.parte_autora || processo.parteAutora)} onClick={() => handleSetCliente('autor')}>
                    {savingCliente ? <RotateCw className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Este é meu cliente
                  </Button>
                </div>

                <div className="p-6 rounded-2xl border border-rose-500/15 bg-rose-500/5 space-y-4">
                  <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                    <Users className="h-4 w-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Polo Passivo (Réu / Requerido)</span>
                  </div>
                  {editing ? (
                    <Input className="h-10 rounded-xl bg-background border-border" value={editData.requerido} onChange={(e) => setEditData({ ...editData, requerido: e.target.value })} placeholder="Nome do réu..." />
                  ) : (
                    <p className="text-base font-bold text-foreground leading-relaxed">{processo.requerido || <span className="text-muted-foreground/50 italic">Não identificado</span>}</p>
                  )}
                  <Button variant={processo.clienteId && processo.cliente === (processo.requerido || '') ? 'default' : 'outline'} size="sm" className="w-full rounded-xl gap-2 font-black text-[10px] h-9 uppercase tracking-widest" disabled={savingCliente || !(editData.requerido || processo.requerido)} onClick={() => handleSetCliente('reu')}>
                    {savingCliente ? <RotateCw className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Este é meu cliente
                  </Button>
                </div>

                {editing && (
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(false)} className="h-9 rounded-xl text-xs gap-1.5"><X className="h-3.5 w-3.5" /> Cancelar</Button>
                    <Button size="sm" onClick={handleSave} disabled={saving} className="h-9 rounded-xl text-xs gap-1.5 shadow-md"><Save className="h-3.5 w-3.5" /> {saving ? 'Salvando...' : 'Salvar'}</Button>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>

      </DialogContent>
    </Dialog>

    {processo && (
      <CompletarDadosDialog
        open={completarOpen}
        onOpenChange={setCompletarOpen}
        processoId={processo.id}
        numeroProcesso={processo.numeroProcesso || ''}
        onApplied={() => queryClient.invalidateQueries({ queryKey: ['processos'] })}
      />
    )}

    {/* Confirmação de novos andamentos */}
    <Dialog open={!!andamentoConfirm} onOpenChange={(o) => { if (!o) setAndamentoConfirm(null); }}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-lg rounded-[2rem]">
        <DialogTitle className="flex items-center gap-2 text-lg font-black">
          <span className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><History className="h-4 w-4" /></span>
          {andamentoConfirm?.novos.length} novo(s) andamento(s) encontrado(s)
        </DialogTitle>
        <p className="text-xs text-muted-foreground -mt-1">Revise antes de adicionar ao histórico do processo.</p>
        <div className="space-y-2 max-h-[50vh] overflow-y-auto pt-1">
          {andamentoConfirm?.novos.map((a: any, i: number) => (
            <div key={i} className="p-3 rounded-xl border border-black/5 dark:border-border bg-black/[0.01] dark:bg-white/[0.01]">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">
                {a.data ? new Date(a.data).toLocaleDateString('pt-BR') : '—'}
              </p>
              <p className="text-sm font-medium leading-snug mt-0.5">{a.descricao || a.resumo || 'Movimentação'}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-2 pt-1">
          <Button onClick={confirmAndamentos} disabled={syncing} className="flex-1 rounded-xl font-bold">
            {syncing ? <RotateCw className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
            Adicionar {andamentoConfirm?.novos.length} andamento(s)
          </Button>
          <Button variant="outline" onClick={() => setAndamentoConfirm(null)} className="rounded-xl">Agora não</Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
};
