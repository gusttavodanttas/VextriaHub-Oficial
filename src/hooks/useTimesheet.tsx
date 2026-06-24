import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { timesheetService, Timesheet } from '@/services/timesheetService';
import { TimesheetCategoria, TIMESHEET_CATEGORIAS } from '@/types/timesheet';
import { NovoTimesheet, AtualizarTimesheet } from '@/types/timesheet';

export interface TimesheetHookResult {
  data: Timesheet[];
  loading: boolean;
  error: string | null;
  activeTimer: Timesheet | null;
  fetchData: () => Promise<void>;
  create: (newRecord: NovoTimesheet) => Promise<Timesheet | null>;
  update: (id: string, updates: AtualizarTimesheet) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
  startTimer: (tarefa_descricao: string, categoria: TimesheetCategoria, cliente_id?: string, processo_id?: string) => Promise<Timesheet | null>;
  pauseTimer: (id: string) => Promise<boolean>;
  stopTimer: (id: string, observacoes?: string) => Promise<boolean>;
  getActiveTimer: () => Promise<Timesheet | null>;
  getTodayStats: () => { totalMinutos: number; totalRegistros: number };
  getWeekStats: () => { totalMinutos: number; totalRegistros: number };
}

export function useTimesheet(): TimesheetHookResult {
  const [data, setData] = useState<Timesheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTimer, setActiveTimer] = useState<Timesheet | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    if (!user) {
      setData([]);
      setLoading(false);
      setHasInitialized(true);
      return;
    }

    try {
      setLoading(true);
      const result = await timesheetService.fetchTimesheets(user.id);
      setData(result);
      setError(null);

      const active = await timesheetService.getActiveTimer(user.id);
      setActiveTimer(active || null);
    } catch (err) {
      console.error('useTimesheet: fetchData error:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
      setHasInitialized(true);
    }
  }, [user?.id]);

  const create = async (newRecord: NovoTimesheet): Promise<Timesheet | null> => {
    if (!user) return null;
    try {
      const result = await timesheetService.create({ ...newRecord, user_id: user.id });
      setData(prev => [result, ...prev]);
      toast({ title: 'Registro criado', description: 'Registro de tempo criado com sucesso.' });
      return result;
    } catch (err) {
      toast({ title: 'Erro ao criar', description: 'Não foi possível criar o registro.', variant: 'destructive' });
      return null;
    }
  };

  const update = async (id: string, updates: AtualizarTimesheet): Promise<boolean> => {
    if (!user) return false;
    try {
      const result = await timesheetService.update(id, user.id, updates);
      setData(prev => prev.map(item => item.id === id ? result : item));
      toast({ title: 'Registro atualizado', description: 'O registro foi atualizado com sucesso.' });
      return true;
    } catch (err) {
      toast({ title: 'Erro ao atualizar', description: 'Não foi possível atualizar o registro.', variant: 'destructive' });
      return false;
    }
  };

  const remove = async (id: string): Promise<boolean> => {
    if (!user) return false;
    try {
      await timesheetService.remove(id, user.id);
      setData(prev => prev.filter(item => item.id !== id));
      toast({ title: 'Registro removido', description: 'O registro foi removido com sucesso.' });
      return true;
    } catch (err) {
      toast({ title: 'Erro ao remover', description: 'Não foi possível remover o registro.', variant: 'destructive' });
      return false;
    }
  };

  const startTimer = async (
    tarefa_descricao: string,
    categoria: TimesheetCategoria,
    cliente_id?: string,
    processo_id?: string
  ): Promise<Timesheet | null> => {
    if (!user) return null;

    try {
      const currentActive = await timesheetService.getActiveTimer(user.id);
      if (currentActive) {
        toast({ title: 'Timer já ativo', description: 'Pare o atual antes de iniciar um novo.', variant: 'destructive' });
        return null;
      }

      const result = await timesheetService.create({
        user_id: user.id,
        tarefa_descricao,
        categoria,
        cliente_id: cliente_id || null,
        processo_id: processo_id || null,
        data_inicio: new Date().toISOString(),
        status: 'ativo'
      });

      setActiveTimer(result);
      setData(prev => [result, ...prev]);
      toast({ title: 'Timer iniciado', description: `Iniciado para: ${tarefa_descricao}` });
      return result;
    } catch (err) {
      toast({ title: 'Erro ao iniciar', description: 'Não foi possível iniciar o timer.', variant: 'destructive' });
      return null;
    }
  };

  const pauseTimer = async (id: string): Promise<boolean> => {
    if (!user) return false;
    try {
      await timesheetService.update(id, user.id, { status: 'pausado' });
      setActiveTimer(null);
      await fetchData();
      toast({ title: 'Timer pausado', description: 'O timer foi pausado com sucesso.' });
      return true;
    } catch (err) {
      toast({ title: 'Erro ao pausar', description: 'Não foi possível pausar o timer.', variant: 'destructive' });
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

      toast({ 
        title: 'Timer finalizado', 
        description: `Duração: ${Math.floor(duracaoMinutos / 60)}h ${duracaoMinutos % 60}m` 
      });
      return true;
    } catch (err) {
      toast({ title: 'Erro ao parar timer', description: 'Não foi possível finalizar o timer.', variant: 'destructive' });
      return false;
    }
  };

  const getTodayStats = () => {
    const today = new Date().toDateString();
    const todayRecords = data.filter(r => new Date(r.data_inicio).toDateString() === today && r.status === 'finalizado');
    return {
      totalMinutos: todayRecords.reduce((sum, r) => sum + (r.duracao_minutos || 0), 0),
      totalRegistros: todayRecords.length
    };
  };

  const getWeekStats = () => {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const weekRecords = data.filter(r => new Date(r.data_inicio) >= oneWeekAgo && r.status === 'finalizado');
    return {
      totalMinutos: weekRecords.reduce((sum, r) => sum + (r.duracao_minutos || 0), 0),
      totalRegistros: weekRecords.length
    };
  };

  useEffect(() => {
    if (user) {
      if (!hasInitialized) {
        fetchData();
      }
    } else {
      setData([]);
      setLoading(false);
      setHasInitialized(false);
      setActiveTimer(null);
    }
  }, [user?.id, hasInitialized, fetchData]);

  return {
    data,
    loading,
    error,
    activeTimer,
    fetchData,
    create,
    update,
    remove,
    startTimer,
    pauseTimer,
    stopTimer,
    getActiveTimer: () => timesheetService.getActiveTimer(user?.id || ''),
    getTodayStats,
    getWeekStats
  };
}