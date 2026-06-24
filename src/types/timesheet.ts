import { TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export const TIMESHEET_CATEGORIAS = [
  'atendimento',
  'processo', 
  'reuniao',
  'administrativa',
  'audiencia',
  'peticao',
  'consulta',
  'pesquisa'
] as const;

export type TimesheetCategoria = typeof TIMESHEET_CATEGORIAS[number];

export type NovoTimesheet = TablesInsert<'timesheets'> & {
  categoria: TimesheetCategoria;
};

export type AtualizarTimesheet = TablesUpdate<'timesheets'>;
