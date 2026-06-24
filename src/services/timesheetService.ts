import { supabase } from '@/integrations/supabase/client';
import { TablesInsert, TablesUpdate, Tables } from '@/integrations/supabase/types';

export type Timesheet = Tables<'timesheets'>;

export const timesheetService = {
  /**
   * Busca registros de timesheet de um usuário em um intervalo de tempo
   */
  async fetchTimesheets(userId: string, daysAgo: number = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);

    const { data, error } = await supabase
      .from('timesheets')
      .select('*')
      .eq('user_id', userId)
      .eq('deletado', false)
      .gte('data_inicio', startDate.toISOString())
      .order('data_inicio', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Busca o timer ativo de um usuário
   */
  async getActiveTimer(userId: string) {
    const { data, error } = await supabase
      .from('timesheets')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'ativo')
      .eq('deletado', false)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  /**
   * Cria um novo registro
   */
  async create(newRecord: TablesInsert<'timesheets'>) {
    const { data, error } = await supabase
      .from('timesheets')
      .insert({
        ...newRecord,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Atualiza um registro existente
   */
  async update(id: string, userId: string, updates: TablesUpdate<'timesheets'>) {
    const { data, error } = await supabase
      .from('timesheets')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Remove um registro (soft delete)
   */
  async remove(id: string, userId: string) {
    const { error } = await supabase
      .from('timesheets')
      .update({ 
        deletado: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
    return true;
  },

  /**
   * Lógica para finalizar um timer com cálculo de duração
   */
  async stopTimer(id: string, userId: string, dataInicio: string, observacoes?: string) {
    const dataFim = new Date();
    const start = new Date(dataInicio);
    const duracaoMinutos = Math.floor((dataFim.getTime() - start.getTime()) / (1000 * 60));

    const { data, error } = await supabase
      .from('timesheets')
      .update({
        status: 'finalizado',
        data_fim: dataFim.toISOString(),
        duracao_minutos: duracaoMinutos,
        observacoes: observacoes,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return { data, duracaoMinutos };
  }
};
