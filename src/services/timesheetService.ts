import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';

export type Timesheet = Tables<'timesheets'> & {
  valor_hora?: number | null;
  faturavel?: boolean | null;
};

interface FetchOpts { userId: string; officeId?: string | null; days?: number; scope?: 'me' | 'office'; }

export const timesheetService = {
  /**
   * Busca registros de timesheet (pessoal ou do escritório) num intervalo.
   */
  async fetchTimesheets(opts: FetchOpts) {
    const { userId, officeId, days = 7, scope = 'me' } = opts;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    let q = supabase
      .from('timesheets')
      .select('*, clientes(nome)')
      .eq('deletado', false)
      .gte('data_inicio', startDate.toISOString())
      .order('data_inicio', { ascending: false });

    if (scope === 'office' && officeId) q = q.eq('office_id', officeId);
    else q = q.eq('user_id', userId);

    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as Timesheet[];
  },

  /** Timer ativo do usuário (sempre pessoal). */
  async getActiveTimer(userId: string) {
    const { data, error } = await supabase
      .from('timesheets')
      .select('*, clientes(nome)')
      .eq('user_id', userId)
      .eq('status', 'ativo')
      .eq('deletado', false)
      .maybeSingle();

    if (error) throw error;
    return data as Timesheet | null;
  },

  async create(newRecord: any) {
    const { data, error } = await supabase
      .from('timesheets')
      .insert({
        ...newRecord,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any)
      .select('*, clientes(nome)')
      .single();

    if (error) throw error;
    return data as Timesheet;
  },

  async update(id: string, userId: string, updates: any) {
    const { data, error } = await supabase
      .from('timesheets')
      .update({ ...updates, updated_at: new Date().toISOString() } as any)
      .eq('id', id)
      .eq('user_id', userId)
      .select('*, clientes(nome)')
      .single();

    if (error) throw error;
    return data as Timesheet;
  },

  /** Soft delete. */
  async remove(id: string, userId: string) {
    const { error } = await supabase
      .from('timesheets')
      .update({ deletado: true, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
    return true;
  },

  /** Pausa: grava o tempo decorrido até agora e marca como pausado. */
  async pauseTimer(id: string, userId: string, dataInicio: string) {
    const elapsedMin = Math.max(0, Math.floor((Date.now() - new Date(dataInicio).getTime()) / 60000));
    const { data, error } = await supabase
      .from('timesheets')
      .update({ status: 'pausado', duracao_minutos: elapsedMin, data_fim: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .select('*, clientes(nome)')
      .single();
    if (error) throw error;
    return data as Timesheet;
  },

  /**
   * Retoma: desloca data_inicio para trás pelo tempo já acumulado, de modo que
   * (agora − data_inicio) continue valendo o total. Sem coluna extra.
   */
  async resumeTimer(id: string, userId: string, duracaoMinutos: number | null) {
    const shifted = new Date(Date.now() - (duracaoMinutos || 0) * 60000).toISOString();
    const { data, error } = await supabase
      .from('timesheets')
      .update({ status: 'ativo', data_inicio: shifted, data_fim: null, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .select('*, clientes(nome)')
      .single();
    if (error) throw error;
    return data as Timesheet;
  },

  /** Finaliza com cálculo de duração (data_inicio já considera retomadas). */
  async stopTimer(id: string, userId: string, dataInicio: string, observacoes?: string) {
    const dataFim = new Date();
    const duracaoMinutos = Math.max(0, Math.floor((dataFim.getTime() - new Date(dataInicio).getTime()) / (1000 * 60)));

    const { data, error } = await supabase
      .from('timesheets')
      .update({
        status: 'finalizado',
        data_fim: dataFim.toISOString(),
        duracao_minutos: duracaoMinutos,
        observacoes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return { data, duracaoMinutos };
  },
};
