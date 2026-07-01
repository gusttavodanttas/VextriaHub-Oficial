import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { timesheetService, Timesheet } from '@/services/timesheetService';
import { TimesheetCategoria } from '@/types/timesheet';

export type TimesheetScope = 'me' | 'office';

export interface ManualEntry {
  tarefa_descricao: string;
  categoria: TimesheetCategoria;
  cliente_id?: string | null;
  data_inicio: string;     // ISO
  data_fim?: string | null;
  duracao_minutos: number;
  faturavel?: boolean;
  valor_hora?: number | null;
  observacoes?: string | null;
  referencia_tipo?: string | null;
  referencia_id?: string | null;
  referencia_label?: string | null;
}

export function useTimesheet() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [periodDays, setPeriodDays] = useState(7);
  const [scope, setScope] = useState<TimesheetScope>('me');

  // Cache compartilhado entre instâncias (página + atalho do dashboard)
  const dataQuery = useQuery({
    queryKey: ['timesheets', user?.id, periodDays, scope],
    enabled: !!user?.id,
    queryFn: () => timesheetService.fetchTimesheets({ userId: user!.id, officeId: user!.office_id, days: periodDays, scope }),
  });
  const activeQuery = useQuery({
    queryKey: ['timesheet-active', user?.id],
    enabled: !!user?.id,
    queryFn: () => timesheetService.getActiveTimer(user!.id),
  });

  const data: Timesheet[] = dataQuery.data ?? [];
  const activeTimer = activeQuery.data ?? null;
  const loading = dataQuery.isLoading;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['timesheets'] });
    queryClient.invalidateQueries({ queryKey: ['timesheet-active'] });
  };
  const fetchData = async () => { await Promise.all([dataQuery.refetch(), activeQuery.refetch()]); };

  const startTimer = async (
    tarefa_descricao: string,
    categoria: TimesheetCategoria,
    cliente_id?: string,
    processo_id?: string,
    referencia_tipo?: string,
    referencia_id?: string,
    referencia_label?: string,
    opts?: { faturavel?: boolean; valor_hora?: number | null },
  ): Promise<Timesheet | null> => {
    if (!user) return null;
    try {
      const currentActive = await timesheetService.getActiveTimer(user.id);
      if (currentActive) {
        toast({ title: 'Timer já ativo', description: 'Pare o atual antes de iniciar um novo.', variant: 'destructive' });
        return null;
      }
      // Campos de faturamento só são enviados quando usados (resiliente antes do SQL)
      const billing: any = {};
      if (opts?.valor_hora != null) billing.valor_hora = opts.valor_hora;
      if (opts?.faturavel === false) billing.faturavel = false;

      const result = await timesheetService.create({
        user_id: user.id,
        office_id: user.office_id,
        tarefa_descricao,
        categoria,
        cliente_id: cliente_id || null,
        processo_id: processo_id || null,
        referencia_tipo: referencia_tipo || null,
        referencia_id: referencia_id || null,
        referencia_label: referencia_label || null,
        ...billing,
        data_inicio: new Date().toISOString(),
        status: 'ativo',
      });
      invalidate();
      toast({ title: 'Timer iniciado', description: `Iniciado para: ${tarefa_descricao}` });
      return result;
    } catch {
      toast({ title: 'Erro ao iniciar', description: 'Não foi possível iniciar o timer.', variant: 'destructive' });
      return null;
    }
  };

  const pauseTimer = async (id: string): Promise<boolean> => {
    if (!user) return false;
    try {
      const rec = activeTimer && activeTimer.id === id ? activeTimer : data.find(t => t.id === id);
      await timesheetService.pauseTimer(id, user.id, rec?.data_inicio || new Date().toISOString());
      invalidate();
      toast({ title: 'Timer pausado' });
      return true;
    } catch {
      toast({ title: 'Erro ao pausar', variant: 'destructive' });
      return false;
    }
  };

  const resumeTimer = async (id: string): Promise<boolean> => {
    if (!user) return false;
    try {
      const current = await timesheetService.getActiveTimer(user.id);
      if (current) { toast({ title: 'Timer já ativo', description: 'Finalize ou pause o atual antes de retomar outro.', variant: 'destructive' }); return false; }
      const rec = data.find(t => t.id === id);
      await timesheetService.resumeTimer(id, user.id, rec?.duracao_minutos ?? 0);
      invalidate();
      toast({ title: 'Timer retomado' });
      return true;
    } catch {
      toast({ title: 'Erro ao retomar', variant: 'destructive' });
      return false;
    }
  };

  const stopTimer = async (id: string, observacoes?: string): Promise<boolean> => {
    if (!user) return false;
    try {
      const timerRecord = data.find(t => t.id === id) || activeTimer;
      if (!timerRecord) return false;
      const { duracaoMinutos } = await timesheetService.stopTimer(id, user.id, timerRecord.data_inicio, observacoes);
      invalidate();
      toast({ title: 'Timer finalizado', description: `Duração: ${Math.floor(duracaoMinutos / 60)}h ${duracaoMinutos % 60}m` });
      return true;
    } catch {
      toast({ title: 'Erro ao parar timer', variant: 'destructive' });
      return false;
    }
  };

  const addManual = async (entry: ManualEntry): Promise<boolean> => {
    if (!user) return false;
    try {
      const { faturavel, valor_hora, ...rest } = entry;
      const billing: any = {};
      if (valor_hora != null) billing.valor_hora = valor_hora;
      if (faturavel === false) billing.faturavel = false;
      await timesheetService.create({
        ...rest,
        user_id: user.id,
        office_id: user.office_id,
        status: 'finalizado',
        cliente_id: entry.cliente_id || null,
        ...billing,
      });
      invalidate();
      toast({ title: 'Lançamento registrado' });
      return true;
    } catch {
      toast({ title: 'Erro ao lançar', variant: 'destructive' });
      return false;
    }
  };

  const marcarFaturado = async (ids: string[], faturado: boolean, financeiroId?: string | null): Promise<boolean> => {
    if (!user || ids.length === 0) return false;
    try {
      const patch: any = { faturado, faturado_em: faturado ? new Date().toISOString() : null, updated_at: new Date().toISOString() };
      if (financeiroId !== undefined) patch.financeiro_id = financeiroId;
      const { error } = await supabase.from('timesheets').update(patch).in('id', ids);
      if (error) throw error;
      invalidate();
      return true;
    } catch {
      toast({ title: 'Erro ao atualizar faturamento', variant: 'destructive' });
      return false;
    }
  };

  /** Estorna uma cobrança: remove a receita gerada e reabre os timesheets ligados a ela. */
  const estornarCobranca = async (financeiroId: string): Promise<boolean> => {
    if (!user) return false;
    try {
      await supabase.from('financeiro').update({ deletado: true }).eq('id', financeiroId);
      const { error } = await supabase.from('timesheets')
        .update({ faturado: false, faturado_em: null, financeiro_id: null, updated_at: new Date().toISOString() })
        .eq('financeiro_id', financeiroId);
      if (error) throw error;
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['financeiro'] });
      toast({ title: 'Cobrança estornada', description: 'Receita removida e registros reabertos.' });
      return true;
    } catch {
      toast({ title: 'Erro ao estornar', variant: 'destructive' });
      return false;
    }
  };

  const update = async (id: string, updates: any): Promise<boolean> => {
    if (!user) return false;
    try {
      await timesheetService.update(id, user.id, updates);
      invalidate();
      toast({ title: 'Registro atualizado' });
      return true;
    } catch {
      toast({ title: 'Erro ao atualizar', variant: 'destructive' });
      return false;
    }
  };

  const remove = async (id: string): Promise<boolean> => {
    if (!user) return false;
    try {
      await timesheetService.remove(id, user.id);
      invalidate();
      toast({ title: 'Registro removido' });
      return true;
    } catch {
      toast({ title: 'Erro ao remover', variant: 'destructive' });
      return false;
    }
  };

  const getTodayStats = () => {
    const today = new Date().toDateString();
    const todayRecords = data.filter(r => new Date(r.data_inicio).toDateString() === today && r.status === 'finalizado');
    return {
      totalMinutos: todayRecords.reduce((sum, r) => sum + (r.duracao_minutos || 0), 0),
      totalRegistros: todayRecords.length,
    };
  };

  const getWeekStats = () => {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const weekRecords = data.filter(r => new Date(r.data_inicio) >= oneWeekAgo && r.status === 'finalizado');
    return {
      totalMinutos: weekRecords.reduce((sum, r) => sum + (r.duracao_minutos || 0), 0),
      totalRegistros: weekRecords.length,
    };
  };

  return {
    data, loading, error: dataQuery.error ? (dataQuery.error as Error).message : null, activeTimer,
    periodDays, setPeriodDays, scope, setScope,
    fetchData, startTimer, pauseTimer, resumeTimer, stopTimer,
    addManual, update, remove, marcarFaturado, estornarCobranca,
    getActiveTimer: () => timesheetService.getActiveTimer(user?.id || ''),
    getTodayStats, getWeekStats,
  };
}
