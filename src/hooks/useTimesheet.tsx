import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
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
  const [data, setData] = useState<Timesheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTimer, setActiveTimer] = useState<Timesheet | null>(null);
  const [periodDays, setPeriodDays] = useState(7);
  const [scope, setScope] = useState<TimesheetScope>('me');
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    if (!user) { setData([]); setLoading(false); return; }
    try {
      setLoading(true);
      const result = await timesheetService.fetchTimesheets({ userId: user.id, officeId: user.office_id, days: periodDays, scope });
      setData(result);
      setError(null);
      const active = await timesheetService.getActiveTimer(user.id);
      setActiveTimer(active || null);
    } catch (err) {
      console.error('useTimesheet: fetchData error:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.office_id, periodDays, scope]);

  useEffect(() => {
    if (user) fetchData();
    else { setData([]); setLoading(false); setActiveTimer(null); }
  }, [user?.id, periodDays, scope, fetchData]);

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
      setActiveTimer(result);
      setData(prev => [result, ...prev]);
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
      setActiveTimer(null);
      await fetchData();
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
      const result = await timesheetService.resumeTimer(id, user.id, rec?.duracao_minutos ?? 0);
      setActiveTimer(result);
      await fetchData();
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
      setActiveTimer(null);
      await fetchData();
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
      await fetchData();
      toast({ title: 'Lançamento registrado' });
      return true;
    } catch {
      toast({ title: 'Erro ao lançar', variant: 'destructive' });
      return false;
    }
  };

  const update = async (id: string, updates: any): Promise<boolean> => {
    if (!user) return false;
    try {
      await timesheetService.update(id, user.id, updates);
      await fetchData();
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
      setData(prev => prev.filter(item => item.id !== id));
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
    data, loading, error, activeTimer,
    periodDays, setPeriodDays, scope, setScope,
    fetchData, startTimer, pauseTimer, resumeTimer, stopTimer,
    addManual, update, remove,
    getActiveTimer: () => timesheetService.getActiveTimer(user?.id || ''),
    getTodayStats, getWeekStats,
  };
}
