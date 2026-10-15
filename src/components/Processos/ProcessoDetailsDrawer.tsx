import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProcessoSubData } from '@/hooks/useProcessoSubData';
import { useProcessoMovimentacoes } from '@/hooks/useProcessoMovimentacoes';
import { assertRowsAffected, getErrorMessage } from '@/lib/errors';
import { planQuotaMessage } from '@/lib/planQuotaError';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Processo } from '@/types/processo';
import {
  User,
  History,
  Info,
  Gavel,
  Users,
  CalendarClock,
  Megaphone,
  ListTodo,
  Timer,
  Share2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useProcessosV2 } from '@/hooks/useProcessosV2';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useOfficeTeams } from '@/hooks/useOfficeTeams';
import { useOfficeUsers } from '@/hooks/useOfficeUsers';
import { usePermissions } from '@/hooks/usePermissions';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import { useAiAdvisor, type ResumoProcesso } from '@/hooks/useAiAdvisor';
import { CompletarDadosDialog } from '@/components/Processos/CompletarDadosDialog';
import { ProcessoShareManager } from '@/components/Processos/ProcessoShareManager';
import type { ProcessoEditData } from './ProcessoDetails/helpers';
import { ProcessoDetailsHeader, type DrawerTab } from './ProcessoDetails/ProcessoDetailsHeader';
import { ResumoTab } from './ProcessoDetails/ResumoTab';
import { HistoricoTab } from './ProcessoDetails/HistoricoTab';
import { PublicacoesTab } from './ProcessoDetails/PublicacoesTab';
import { PrazosTab, AudienciasTab, AtendimentosTab, TarefasTab, TimesheetTab } from './ProcessoDetails/ItensVinculadosTabs';
import { PartesTab } from './ProcessoDetails/PartesTab';
import { AndamentosConfirmDialog, ResumoIADialog } from './ProcessoDetails/ProcessoDetailsDialogs';

// Drawer de detalhes do processo. Este arquivo guarda o estado e os handlers;
// a apresentação de cada aba vive em ./ProcessoDetails/*.

interface ProcessoDetailsDrawerProps {
  processo: Processo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EDIT_DATA_VAZIO: ProcessoEditData = {
  titulo: '',
  numero_processo: '',
  status: 'Em andamento',
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
  team_id: '',
  responsavel_id: '',
  resultado: '',
};

const SUB_TABS = ['publicacoes', 'prazos', 'audiencias', 'atendimentos', 'tarefas', 'timesheet'];

export const ProcessoDetailsDrawer: React.FC<ProcessoDetailsDrawerProps> = ({
  processo,
  open,
  onOpenChange
}) => {
  const { user } = useAuth();
  const { update } = useProcessosV2({ lista: false });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { teams: officeTeams } = useOfficeTeams();
  const { users: officeUsers } = useOfficeUsers();
  const { canManageOffice, canEditProcesses } = usePermissions();

  // ── Contexto de compartilhamento entre escritórios ──
  // Se o processo veio COMPARTILHADO por um parceiro (sharedFrom preenchido pela página),
  // ele não é "meu": o cabeçalho fica só-leitura e as ações seguem a permissão do share.
  const isSharedIn = !!processo?.sharedFrom;
  const canEditShared = processo?.sharePermission === 'editar';
  const isMine = !isSharedIn;
  const canWrite = isMine || canEditShared;           // registrar andamento
  const canManageShares = isMine && canManageOffice;  // dono admin gerencia parceiros
  // Editar capa do processo (título, número, partes...) exige ser dono E ter a permissão
  // granular — antes só checava isMine, então qualquer membro do escritório conseguia
  // editar qualquer processo, mesmo sem canEditProcesses.
  const canEditHeader = isMine && canEditProcesses;

  // Conselheiro IA (resumo do processo) — premium, só no processo próprio (a função escopa por office)
  const { hasIAModule } = usePlanFeatures();
  const advisor = useAiAdvisor();
  const [resumoIA, setResumoIA] = useState<ResumoProcesso | null>(null);
  const [resumoIAOpen, setResumoIAOpen] = useState(false);
  const [resumoIALoading, setResumoIALoading] = useState(false);

  const [completarOpen, setCompletarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("resumo");
  const [editing, setEditing] = useState(false);
  const navigate = useNavigate();
  // Abre um item já criado na sua aba principal (modo edição), fechando o drawer
  const openInTab = useCallback((route: string, id: string) => {
    onOpenChange(false);
    navigate(`${route}?openId=${id}`);
  }, [navigate, onOpenChange]);
  const [saving, setSaving] = useState(false);
  const [savingCliente, setSavingCliente] = useState(false);

  // Sub-tab data + ações (extraído para hooks/useProcessoSubData)
  const sub = useProcessoSubData(processo);
  const { loadingSub, addLoading, setAddLoading, fetchSubData } = sub;

  // Movimentações/andamentos (busca, exclusão, sync com a fonte) — extraído p/ hook.
  const mov = useProcessoMovimentacoes(processo, open);
  const { lastSyncedProcessoId, setLastSyncedProcessoId, fetchMovements, syncFromOrigin } = mov;

  // Add forms
  const [showAddAndamento, setShowAddAndamento] = useState(false);
  const [showAddPrazo, setShowAddPrazo] = useState(false);
  const [showAddAudiencia, setShowAddAudiencia] = useState(false);
  const [showAddTarefa, setShowAddTarefa] = useState(false);
  const [showAddTimesheet, setShowAddTimesheet] = useState(false);
  const [showAddAtendimento, setShowAddAtendimento] = useState(false);

  const [editData, setEditData] = useState<ProcessoEditData>(EDIT_DATA_VAZIO);

  useEffect(() => {
    // SEMPRE zera os dados do processo anterior ao TROCAR de processo ou fechar.
    // (Antes só limpava ao fechar — por isso a confirmação/andamentos de um processo
    //  vazava para o próximo, ex.: andamentos do PH aparecendo na Maria Luiza.)
    setShowAddAndamento(false);
    setShowAddPrazo(false);
    setShowAddAudiencia(false);
    setShowAddTarefa(false);
    setShowAddTimesheet(false);
    setShowAddAtendimento(false);

    if (processo && open) {
      setEditData({
        titulo: processo.titulo || '',
        numero_processo: processo.numeroProcesso || '',
        status: processo.status || 'Em andamento',
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
    if (!processo?.id || !canEditHeader) return;
    if (!editData.titulo.trim()) {
      toast({ title: 'Título obrigatório', description: 'O processo precisa ter um título.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await update(processo.id, {
        titulo: editData.titulo,
        numeroProcesso: editData.numero_processo,
        status: editData.status,
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
    } catch (e: unknown) {
      // Nº CNJ duplicado bate no índice único (office_id, numero_processo) → mensagem amigável.
      const msg = getErrorMessage(e);
      const dup = /duplicate|unique|23505|numero_processo/i.test(msg);
      toast({
        title: dup ? 'Número já cadastrado' : 'Erro ao salvar',
        description: dup ? 'Já existe um processo com esse número neste escritório.' : msg,
        variant: 'destructive',
      });
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
      // Dedup insensível a acento/caixa/espaço: nome de parte do tribunal vem em CAIXA
      // ALTA e às vezes sem acento ("JOSE" vs "José") — o .ilike anterior (acento-sensível)
      // ainda duplicava. Normaliza e compara em JS (mesma norma do ClientSelect). (v12)
      const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').trim();
      const alvo = norm(nomeCliente);
      const { data: candidatos, error: candErr } = await supabase.from('clientes').select('id, nome').eq('office_id', user.office_id).eq('deletado', false);
      // Sem isto, a falha na busca virava "cliente não existe" e criava um duplicado.
      if (candErr) throw candErr;
      const existing = (candidatos || []).find((c: any) => norm(c.nome) === alvo) || null;
      let clienteId: string;
      if (existing) {
        clienteId = existing.id;
      } else {
        const { data: novo, error: createError } = await supabase.from('clientes').insert({ nome: nomeCliente, office_id: user.office_id, user_id: user.id }).select('id').single();
        // Antes: só checava `!novo` e lançava uma mensagem genérica, perdendo o erro
        // real do Postgres (ex.: cota de plano) — o usuário nunca via "Faça upgrade".
        if (createError) throw createError;
        if (!novo) throw new Error('Erro ao criar cliente');
        clienteId = novo.id;
      }
      const { data: upd, error: updateError } = await supabase.from('processos').update({ cliente_id: clienteId }).eq('id', processo.id).select('id');
      assertRowsAffected(upd, updateError, 1);
      queryClient.invalidateQueries({ queryKey: ['processos'] });
      toast({ title: 'Cliente vinculado', description: `${nomeCliente} vinculado como cliente deste processo.` });
    } catch (e: unknown) {
      const quota = planQuotaMessage(e);
      toast(quota ? { ...quota, variant: 'destructive' } : { title: 'Erro', description: getErrorMessage(e), variant: 'destructive' });
    } finally {
      setSavingCliente(false);
    }
  };

  useEffect(() => {
    if (!open || !processo?.id) return;
    if (activeTab === 'timeline') {
      if (lastSyncedProcessoId !== processo.id) {
        setLastSyncedProcessoId(processo.id);
        syncFromOrigin();
      }
    } else if (SUB_TABS.includes(activeTab)) {
      fetchSubData(activeTab);
    }
  }, [open, activeTab, processo?.id]);

  // ── Add handlers — lógica no useProcessoSubData; aqui só fecha o form no sucesso ──
  const handleAddPrazo = async (e: React.FormEvent<HTMLFormElement>) => { if (await sub.addPrazo(e)) setShowAddPrazo(false); };
  const handleAddAudiencia = async (e: React.FormEvent<HTMLFormElement>) => { if (await sub.addAudiencia(e)) setShowAddAudiencia(false); };
  const handleAddTarefa = async (e: React.FormEvent<HTMLFormElement>) => { if (await sub.addTarefa(e)) setShowAddTarefa(false); };
  const handleAddTimesheet = async (e: React.FormEvent<HTMLFormElement>) => { if (await sub.addTimesheet(e)) setShowAddTimesheet(false); };
  const handleAddAtendimento = async (e: React.FormEvent<HTMLFormElement>) => { if (await sub.addAtendimento(e)) setShowAddAtendimento(false); };

  // ── Andamento manual ──
  const handleAddAndamento = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Carimba o andamento no escritório DONO do processo (processo.officeId). Em processo
    // próprio é o meu; em processo compartilhado é o do parceiro — assim os dois lados veem
    // o andamento e o paywall segue ancorado em quem é dono do dado.
    const officeId = processo?.officeId || user?.office_id;
    if (!processo?.id || !officeId) return;
    const processoId = processo.id;
    setAddLoading(true);
    const fd = new FormData(e.currentTarget);
    const descricao = (fd.get('descricao') as string || '').trim();
    const data = fd.get('data') as string;
    if (!descricao || !data) {
      toast({ title: 'Preencha descrição e data', variant: 'destructive' });
      setAddLoading(false); return;
    }
    const { error } = await supabase.from('movimentacoes_processo').insert({
      processo_id: processoId, office_id: officeId,
      data_movimentacao: data, descricao,
      tipo: fd.get('tipo') as string || 'manual',
    });
    if (error) { toast({ title: 'Erro ao registrar andamento', description: error.message, variant: 'destructive' }); }
    else { toast({ title: 'Andamento registrado' }); setShowAddAndamento(false); fetchMovements(); }
    setAddLoading(false);
  };

  const handleResumirIA = async () => {
    if (!processo?.id) return;
    setResumoIAOpen(true);
    setResumoIALoading(true);
    setResumoIA(null);
    try {
      const res = await advisor.resumoProcesso(processo.id);
      setResumoIA(res.data);
    } catch (e: unknown) {
      toast({ title: 'IA indisponível', description: getErrorMessage(e), variant: 'destructive' });
      setResumoIAOpen(false);
    } finally {
      setResumoIALoading(false);
    }
  };

  const tabs: DrawerTab[] = [
    { value: 'resumo', label: 'Resumo', icon: Info },
    { value: 'timeline', label: 'Histórico', icon: History },
    { value: 'publicacoes', label: 'Publicações', icon: Megaphone },
    { value: 'prazos', label: 'Prazos', icon: CalendarClock },
    { value: 'audiencias', label: 'Audiências', icon: Gavel },
    { value: 'atendimentos', label: 'Atendimentos', icon: Users },
    { value: 'tarefas', label: 'Tarefas', icon: ListTodo },
    { value: 'timesheet', label: 'Timesheet', icon: Timer },
    { value: 'partes', label: 'Partes', icon: User },
    ...(canManageShares ? [{ value: 'compartilhar', label: 'Compartilhar', icon: Share2 }] : []),
  ];

  if (!processo) return null;

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="max-w-5xl w-[96vw] h-[92vh] p-0 rounded-3xl border border-border bg-background shadow-2xl flex flex-col overflow-hidden gap-0">

        <ProcessoDetailsHeader
          processo={processo}
          editing={editing}
          setEditing={setEditing}
          editData={editData}
          setEditData={setEditData}
          canEditHeader={canEditHeader}
          isMine={isMine}
          canEditShared={canEditShared}
          saving={saving}
          onSave={handleSave}
          onCompletarDados={() => setCompletarOpen(true)}
          tabs={tabs}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />

        {/* ═══ CONTEÚDO ═══ */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="p-8">

            {isSharedIn && (
              <div className="mb-6 flex items-center gap-3 p-4 rounded-2xl border border-sky-500/20 bg-sky-500/5">
                <div className="p-2 rounded-xl bg-sky-500/10 text-sky-600 shrink-0"><Share2 className="h-4 w-4" /></div>
                <div className="text-sm min-w-0">
                  <span className="font-bold text-foreground">Compartilhado por {processo.sharedFrom}.</span>{' '}
                  <span className="text-muted-foreground">
                    {canEditShared
                      ? 'Você acompanha e pode registrar andamentos. O cabeçalho do processo é editado só pelo escritório dono.'
                      : 'Acesso somente leitura — você acompanha o andamento, mas não edita.'}
                  </span>
                </div>
              </div>
            )}

            {activeTab === 'resumo' && (
              <ResumoTab
                processo={processo}
                editing={editing}
                editData={editData}
                setEditData={setEditData}
                officeTeams={officeTeams}
                officeUsers={officeUsers}
                currentUserId={user?.id}
              />
            )}

            {activeTab === 'timeline' && (
              <HistoricoTab
                mov={mov}
                loadingSub={loadingSub}
                canWrite={canWrite}
                isMine={isMine}
                hasIAModule={hasIAModule}
                resumoIALoading={resumoIALoading}
                onResumirIA={handleResumirIA}
                showAddAndamento={showAddAndamento}
                setShowAddAndamento={setShowAddAndamento}
                addLoading={addLoading}
                onAddAndamento={handleAddAndamento}
              />
            )}

            {activeTab === 'publicacoes' && <PublicacoesTab sub={sub} isMine={isMine} />}

            {activeTab === 'prazos' && (
              <PrazosTab sub={sub} canWrite={canWrite} openInTab={openInTab} showAdd={showAddPrazo} setShowAdd={setShowAddPrazo} onAdd={handleAddPrazo} />
            )}

            {activeTab === 'audiencias' && (
              <AudienciasTab sub={sub} canWrite={canWrite} openInTab={openInTab} showAdd={showAddAudiencia} setShowAdd={setShowAddAudiencia} onAdd={handleAddAudiencia} />
            )}

            {activeTab === 'atendimentos' && (
              <AtendimentosTab sub={sub} isMine={isMine} openInTab={openInTab} showAdd={showAddAtendimento} setShowAdd={setShowAddAtendimento} onAdd={handleAddAtendimento} />
            )}

            {activeTab === 'tarefas' && (
              <TarefasTab sub={sub} canWrite={canWrite} openInTab={openInTab} showAdd={showAddTarefa} setShowAdd={setShowAddTarefa} onAdd={handleAddTarefa} />
            )}

            {activeTab === 'timesheet' && (
              <TimesheetTab sub={sub} isMine={isMine} showAdd={showAddTimesheet} setShowAdd={setShowAddTimesheet} onAdd={handleAddTimesheet} />
            )}

            {activeTab === 'partes' && (
              <PartesTab
                processo={processo}
                editing={editing}
                setEditing={setEditing}
                editData={editData}
                setEditData={setEditData}
                isMine={isMine}
                saving={saving}
                savingCliente={savingCliente}
                onSave={handleSave}
                onSetCliente={handleSetCliente}
              />
            )}

            {/* ── COMPARTILHAR (dono admin) ── */}
            {activeTab === 'compartilhar' && canManageShares && (
              <ProcessoShareManager processoId={processo.id} active={activeTab === 'compartilhar'} />
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

    <AndamentosConfirmDialog mov={mov} />
    <ResumoIADialog open={resumoIAOpen} onOpenChange={setResumoIAOpen} loading={resumoIALoading} resumo={resumoIA} />
    </>
  );
};
