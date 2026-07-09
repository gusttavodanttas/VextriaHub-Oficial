// Dados e ações das sub-abas do drawer do processo (publicações, prazos,
// audiências, atendimentos, tarefas, timesheet) — extraído de
// ProcessoDetailsDrawer.tsx sem mudança de comportamento.
//
// Contrato dos handlers de criação: retornam `true` em sucesso (o chamador
// fecha o formulário inline) e `false` em erro (o formulário permanece aberto).
import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { fmtDataBR } from "@/lib/dates";
import type { Processo } from "@/types/processo";

const fmtPub = (d: string | null | undefined) => fmtDataBR(d) || "—";

export function useProcessoSubData(processo: Processo | null) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [publicacoes, setPublicacoes] = useState<any[]>([]);
  const [prazos, setPrazos] = useState<any[]>([]);
  const [audiencias, setAudiencias] = useState<any[]>([]);
  const [atendimentos, setAtendimentos] = useState<any[]>([]);
  const [tarefas, setTarefas] = useState<any[]>([]);
  const [timesheets, setTimesheets] = useState<any[]>([]);
  const [loadingSub, setLoadingSub] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [expandedPubId, setExpandedPubId] = useState<string | null>(null);
  const [tratandoPubId, setTratandoPubId] = useState<string | null>(null);

  // Zera tudo ao trocar de processo (evita dados de um processo vazarem no outro)
  useEffect(() => {
    setPublicacoes([]); setPrazos([]); setAudiencias([]);
    setAtendimentos([]); setTarefas([]); setTimesheets([]);
    setExpandedPubId(null); setTratandoPubId(null);
  }, [processo?.id]);

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

  // ── Criação a partir dos formulários inline das sub-abas ──

  const addPrazo = async (e: React.FormEvent<HTMLFormElement>): Promise<boolean> => {
    e.preventDefault();
    if (!processo?.id || !user) return false;
    setAddLoading(true);
    const fd = new FormData(e.currentTarget);
    const titulo = (fd.get('titulo') as string || '').trim();
    const dataVencimento = fd.get('data_vencimento') as string;
    if (!titulo || !dataVencimento) {
      toast({ title: 'Preencha título e data', variant: 'destructive' });
      setAddLoading(false); return false;
    }
    const { error } = await supabase.from('prazos').insert({
      user_id: user.id, office_id: user.office_id, processo_id: processo.id,
      titulo, descricao: fd.get('descricao') as string || null,
      data_vencimento: dataVencimento,
      prioridade: fd.get('prioridade') as string || 'media',
      status: 'pendente',
    });
    setAddLoading(false);
    if (error) { toast({ title: 'Erro ao criar prazo', description: error.message, variant: 'destructive' }); return false; }
    toast({ title: 'Prazo criado' });
    fetchSubData('prazos');
    queryClient.invalidateQueries({ queryKey: ['prazos'] });
    return true;
  };

  const addAudiencia = async (e: React.FormEvent<HTMLFormElement>): Promise<boolean> => {
    e.preventDefault();
    if (!processo?.id || !user) return false;
    setAddLoading(true);
    const fd = new FormData(e.currentTarget);
    const titulo = (fd.get('titulo') as string || '').trim();
    const data = fd.get('data') as string;
    if (!titulo || !data) {
      toast({ title: 'Preencha título e data', variant: 'destructive' });
      setAddLoading(false); return false;
    }
    const { error } = await supabase.from('audiencias').insert({
      user_id: user.id, office_id: user.office_id, processo_id: processo.id,
      titulo,
      data_audiencia: new Date(`${data}T${fd.get('horario') || '00:00'}`).toISOString(),
      local: fd.get('local') as string || null,
      tipo: fd.get('tipo') as string || null,
      observacoes: fd.get('observacoes') as string || null,
      status: 'agendada',
    });
    setAddLoading(false);
    if (error) { toast({ title: 'Erro ao criar audiência', description: error.message, variant: 'destructive' }); return false; }
    toast({ title: 'Audiência criada' });
    fetchSubData('audiencias');
    queryClient.invalidateQueries({ queryKey: ['audiencias'] });
    return true;
  };

  const addTarefa = async (e: React.FormEvent<HTMLFormElement>): Promise<boolean> => {
    e.preventDefault();
    if (!processo?.id || !user) return false;
    setAddLoading(true);
    const fd = new FormData(e.currentTarget);
    const titulo = (fd.get('titulo') as string || '').trim();
    if (!titulo) { toast({ title: 'Título obrigatório', variant: 'destructive' }); setAddLoading(false); return false; }
    const { error } = await supabase.from('tarefas').insert({
      user_id: user.id, office_id: user.office_id, processo_id: processo.id,
      titulo, descricao: fd.get('descricao') as string || null,
      data_vencimento: fd.get('data_vencimento') as string || null,
      prioridade: fd.get('prioridade') as string || 'media',
      status: 'pendente',
    });
    setAddLoading(false);
    if (error) { toast({ title: 'Erro ao criar tarefa', description: error.message, variant: 'destructive' }); return false; }
    toast({ title: 'Tarefa criada' });
    fetchSubData('tarefas');
    queryClient.invalidateQueries({ queryKey: ['tarefas'] });
    return true;
  };

  const addTimesheet = async (e: React.FormEvent<HTMLFormElement>): Promise<boolean> => {
    e.preventDefault();
    if (!processo?.id || !user) return false;
    setAddLoading(true);
    const fd = new FormData(e.currentTarget);
    const descricao = (fd.get('descricao') as string || '').trim();
    const duracao = Number(fd.get('duracao')) || 0;
    if (!descricao || duracao <= 0) {
      toast({ title: 'Preencha descrição e duração', variant: 'destructive' });
      setAddLoading(false); return false;
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
    setAddLoading(false);
    if (error) { toast({ title: 'Erro ao registrar tempo', description: error.message, variant: 'destructive' }); return false; }
    toast({ title: 'Tempo registrado' });
    fetchSubData('timesheet');
    return true;
  };

  const addAtendimento = async (e: React.FormEvent<HTMLFormElement>): Promise<boolean> => {
    e.preventDefault();
    if (!processo?.id || !user) return false;
    setAddLoading(true);
    const fd = new FormData(e.currentTarget);
    const data = fd.get('data') as string;
    if (!data) { toast({ title: 'Data obrigatória', variant: 'destructive' }); setAddLoading(false); return false; }
    const { error } = await supabase.from('atendimentos').insert({
      user_id: user.id, office_id: user.office_id, processo_id: processo.id,
      cliente_id: processo.clienteId || null,
      tipo_atendimento: fd.get('tipo') as string || 'reuniao',
      data_atendimento: new Date(`${data}T${fd.get('horario') || '00:00'}`).toISOString(),
      observacoes: fd.get('observacoes') as string || null,
      status: 'agendado',
    });
    setAddLoading(false);
    if (error) { toast({ title: 'Erro ao criar atendimento', description: error.message, variant: 'destructive' }); return false; }
    toast({ title: 'Atendimento criado' });
    fetchSubData('atendimentos');
    queryClient.invalidateQueries({ queryKey: ['atendimentos'] });
    return true;
  };

  const toggleTarefa = async (t: any) => {
    const newStatus = !t.concluida;
    const { error } = await supabase.from('tarefas').update({ concluida: newStatus, status: newStatus ? 'concluida' : 'pendente' }).eq('id', t.id);
    if (!error) fetchSubData('tarefas');
    else toast({ title: 'Erro ao atualizar tarefa', variant: 'destructive' });
  };

  // ── Publicações ──

  const pubStatus = async (id: string, status: string) => {
    await supabase.from('publicacoes').update({ status }).eq('id', id);
    setPublicacoes(prev => prev.map(p => p.id === id ? { ...p, status } : p));
    toast({ title: status === 'lida' ? 'Marcada como lida' : status === 'arquivada' ? 'Arquivada' : 'Atualizada' });
  };

  const copyPub = (conteudo: string) => {
    const clean = conteudo
      .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>|<\/div>/gi, '\n')
      .replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/\n{3,}/g, '\n\n').trim();
    navigator.clipboard.writeText(clean);
    toast({ title: 'Copiado' });
  };

  const pubUrgencia = async (id: string, urgencia: string) => {
    await supabase.from('publicacoes').update({ urgencia }).eq('id', id);
    setPublicacoes(prev => prev.map(p => p.id === id ? { ...p, urgencia } : p));
    toast({ title: `Urgência: ${urgencia}` });
  };

  // Tratar publicação: criar prazo/tarefa/audiência a partir dela
  const tratarPub = async (e: React.FormEvent<HTMLFormElement>, pub: any) => {
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
        titulo, descricao: `Originado da publicação de ${fmtPub(pub.data_publicacao)}: ${pub.titulo}`,
        data_vencimento: fd.get('data_vencimento') as string,
        prioridade: fd.get('prioridade') as string || 'alta', status: 'pendente',
      });
      insertError = error;
      if (!error) toast({ title: 'Prazo criado a partir da publicação' });
    } else if (tipo === 'tarefa') {
      const { error } = await supabase.from('tarefas').insert({
        user_id: user.id, processo_id: processo.id,
        titulo, descricao: `Originado da publicação de ${fmtPub(pub.data_publicacao)}: ${pub.titulo}`,
        data_vencimento: fd.get('data_vencimento') as string || null,
        prioridade: fd.get('prioridade') as string || 'media', status: 'pendente',
      });
      insertError = error;
      if (!error) toast({ title: 'Tarefa criada a partir da publicação' });
    } else if (tipo === 'audiencia') {
      const { error } = await supabase.from('audiencias').insert({
        user_id: user.id, office_id: user.office_id, processo_id: processo.id,
        titulo, data_audiencia: new Date(`${fd.get('data_vencimento')}T${fd.get('horario') || '00:00'}`).toISOString(),
        observacoes: `Originado da publicação de ${fmtPub(pub.data_publicacao)}`, status: 'agendada',
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

  return {
    publicacoes, prazos, audiencias, atendimentos, tarefas, timesheets,
    loadingSub, addLoading, setAddLoading,
    expandedPubId, setExpandedPubId, tratandoPubId, setTratandoPubId,
    fetchSubData,
    addPrazo, addAudiencia, addTarefa, addTimesheet, addAtendimento,
    toggleTarefa,
    pubStatus, copyPub, pubUrgencia, tratarPub,
  };
}
