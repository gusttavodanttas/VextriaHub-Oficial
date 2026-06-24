import { Tables } from '@/integrations/supabase/types';

// Tipos das tabelas do banco
export type Cliente = Tables<'clientes'>;
export interface ClienteComProcessos extends Cliente {
  processos?: { count: number }[];
}
export type Processo = Tables<'processos'>;
export type Audiencia = Tables<'audiencias'>;
export type Prazo = Tables<'prazos'>;
export type Tarefa = Tables<'tarefas'>;
export type Atendimento = Tables<'atendimentos'>;
export type Meta = Tables<'metas'>;
export type Financeiro = Tables<'financeiro'>;
export type ExclusaoPendente = Tables<'exclusoes_pendentes'>;

// Novos tipos para multi-tenancy
export type Office = Tables<'offices'>;
export type OfficeUser = Tables<'office_users'>;
export type Invitation = Tables<'invitations'>;
export type Subscription = Tables<'subscriptions'>;
export type Profile = Tables<'profiles'>;

// Tipos para criação de registros (sem campos automáticos)
export type NovoCliente = Omit<Cliente, 'id' | 'user_id' | 'deletado' | 'deletado_pendente' | 'created_at' | 'updated_at'>;
export type NovoProcesso = Omit<Processo, 'id' | 'user_id' | 'deletado' | 'deletado_pendente' | 'created_at' | 'updated_at'>;
export type NovaAudiencia = Omit<Audiencia, 'id' | 'user_id' | 'deletado' | 'deletado_pendente' | 'created_at' | 'updated_at'>;
export type NovoPrazo = Omit<Prazo, 'id' | 'user_id' | 'deletado' | 'deletado_pendente' | 'created_at' | 'updated_at'>;
export type NovaTarefa = Omit<Tarefa, 'id' | 'user_id' | 'deletado' | 'deletado_pendente' | 'created_at' | 'updated_at'>;
export type NovoAtendimento = Omit<Atendimento, 'id' | 'user_id' | 'deletado' | 'deletado_pendente' | 'created_at' | 'updated_at'>;
export type NovaMeta = Omit<Meta, 'id' | 'user_id' | 'deletado' | 'deletado_pendente' | 'created_at' | 'updated_at'>;
export type NovoFinanceiro = Omit<Financeiro, 'id' | 'user_id' | 'deletado' | 'deletado_pendente' | 'created_at' | 'updated_at'>;

// Novos tipos para criação de registros multi-tenancy
export type NovoOffice = Omit<Office, 'id' | 'created_at' | 'updated_at' | 'created_by'>;
export type NovoOfficeUser = Omit<OfficeUser, 'id' | 'joined_at'>;
export type NovaInvitation = Omit<Invitation, 'id' | 'created_at' | 'token' | 'status' | 'accepted_at' | 'office_id' | 'invited_by'>;
export type NovaSubscription = Omit<Subscription, 'id' | 'created_at' | 'updated_at'>;

// Interface para hooks de database
export interface DatabaseHookResult<T, CreateT> {
  data: T[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  create: (newRecord: CreateT) => Promise<T | null>;
  update: (id: string, updates: Partial<T>) => Promise<T | null>;
  requestDelete: (id: string, motivo?: string) => Promise<boolean>;
  requestMultipleDelete: (ids: string[], motivo?: string) => Promise<boolean>;
  isEmpty: boolean;
}