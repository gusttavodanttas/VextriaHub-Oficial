export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      atendimentos: {
        Row: {
          cliente_id: string
          created_at: string
          data_atendimento: string
          deletado: boolean
          deletado_pendente: boolean
          duracao: number | null
          id: string
          observacoes: string | null
          status: string | null
          tipo_atendimento: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          data_atendimento: string
          deletado?: boolean
          deletado_pendente?: boolean
          duracao?: number | null
          id?: string
          observacoes?: string | null
          status?: string | null
          tipo_atendimento: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          data_atendimento?: string
          deletado?: boolean
          deletado_pendente?: boolean
          duracao?: number | null
          id?: string
          observacoes?: string | null
          status?: string | null
          tipo_atendimento?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "atendimentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      audiencias: {
        Row: {
          cliente_id: string | null
          created_at: string
          data_audiencia: string
          deletado: boolean
          deletado_pendente: boolean
          id: string
          local: string | null
          observacoes: string | null
          processo_id: string | null
          status: string | null
          tipo: string | null
          titulo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          data_audiencia: string
          deletado?: boolean
          deletado_pendente?: boolean
          id?: string
          local?: string | null
          observacoes?: string | null
          processo_id?: string | null
          status?: string | null
          tipo?: string | null
          titulo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          data_audiencia?: string
          deletado?: boolean
          deletado_pendente?: boolean
          id?: string
          local?: string | null
          observacoes?: string | null
          processo_id?: string | null
          status?: string | null
          tipo?: string | null
          titulo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audiencias_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audiencias_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          cpf_cnpj: string | null
          created_at: string
          data_aniversario: string | null
          deletado: boolean
          deletado_pendente: boolean
          email: string | null
          endereco: string | null
          id: string
          nome: string
          office_id: string | null
          origem: string | null
          status: string | null
          telefone: string | null
          tipo_pessoa: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cpf_cnpj?: string | null
          created_at?: string
          data_aniversario?: string | null
          deletado?: boolean
          deletado_pendente?: boolean
          email?: string | null
          endereco?: string | null
          id?: string
          nome: string
          office_id?: string | null
          origem?: string | null
          status?: string | null
          telefone?: string | null
          tipo_pessoa?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cpf_cnpj?: string | null
          created_at?: string
          data_aniversario?: string | null
          deletado?: boolean
          deletado_pendente?: boolean
          email?: string | null
          endereco?: string | null
          id?: string
          nome?: string
          office_id?: string | null
          origem?: string | null
          status?: string | null
          telefone?: string | null
          tipo_pessoa?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      exclusoes_pendentes: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          dados_registro: Json
          id: string
          motivo: string | null
          registro_id: string
          solicitado_em: string
          status: string | null
          tabela: string
          user_id: string
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          dados_registro: Json
          id?: string
          motivo?: string | null
          registro_id: string
          solicitado_em?: string
          status?: string | null
          tabela: string
          user_id: string
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          dados_registro?: Json
          id?: string
          motivo?: string | null
          registro_id?: string
          solicitado_em?: string
          status?: string | null
          tabela?: string
          user_id?: string
        }
        Relationships: []
      }
      financeiro: {
        Row: {
          categoria: string | null
          cliente_id: string | null
          created_at: string
          data_pagamento: string | null
          data_vencimento: string
          deletado: boolean
          deletado_pendente: boolean
          descricao: string
          id: string
          processo_id: string | null
          status: string | null
          tipo: string
          updated_at: string
          user_id: string
          valor: number
        }
        Insert: {
          categoria?: string | null
          cliente_id?: string | null
          created_at?: string
          data_pagamento?: string | null
          data_vencimento: string
          deletado?: boolean
          deletado_pendente?: boolean
          descricao: string
          id?: string
          processo_id?: string | null
          status?: string | null
          tipo: string
          updated_at?: string
          user_id: string
          valor: number
        }
        Update: {
          categoria?: string | null
          cliente_id?: string | null
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string
          deletado?: boolean
          deletado_pendente?: boolean
          descricao?: string
          id?: string
          processo_id?: string | null
          status?: string | null
          tipo?: string
          updated_at?: string
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          office_id: string
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["invitation_status"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          office_id: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["invitation_status"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          office_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["invitation_status"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      metas: {
        Row: {
          created_at: string
          data_fim: string
          data_inicio: string
          deletado: boolean
          deletado_pendente: boolean
          id: string
          periodo: string
          status: string | null
          tipo: string
          titulo: string
          updated_at: string
          user_id: string
          valor_atual: number | null
          valor_meta: number | null
        }
        Insert: {
          created_at?: string
          data_fim: string
          data_inicio: string
          deletado?: boolean
          deletado_pendente?: boolean
          id?: string
          periodo: string
          status?: string | null
          tipo: string
          titulo: string
          updated_at?: string
          user_id: string
          valor_atual?: number | null
          valor_meta?: number | null
        }
        Update: {
          created_at?: string
          data_fim?: string
          data_inicio?: string
          deletado?: boolean
          deletado_pendente?: boolean
          id?: string
          periodo?: string
          status?: string | null
          tipo?: string
          titulo?: string
          updated_at?: string
          user_id?: string
          valor_atual?: number | null
          valor_meta?: number | null
        }
        Relationships: []
      }
      office_users: {
        Row: {
          active: boolean
          id: string
          invited_by: string | null
          joined_at: string
          office_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          active?: boolean
          id?: string
          invited_by?: string | null
          joined_at?: string
          office_id: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          active?: boolean
          id?: string
          invited_by?: string | null
          joined_at?: string
          office_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "office_users_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      offices: {
        Row: {
          active: boolean
          address: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          logo_url: string | null
          max_users: number
          name: string
          phone: string | null
          plan: Database["public"]["Enums"]["subscription_plan"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          max_users?: number
          name: string
          phone?: string | null
          plan?: Database["public"]["Enums"]["subscription_plan"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          max_users?: number
          name?: string
          phone?: string | null
          plan?: Database["public"]["Enums"]["subscription_plan"]
          updated_at?: string
        }
        Relationships: []
      }
      plan_configs: {
        Row: {
          created_at: string | null
          features: Json | null
          id: string
          is_active: boolean | null
          plan_name: string
          plan_type: string
          price_cents: number
          trial_days: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          plan_name: string
          plan_type: string
          price_cents: number
          trial_days?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          plan_name?: string
          plan_type?: string
          price_cents?: number
          trial_days?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      prazos: {
        Row: {
          created_at: string
          data_vencimento: string
          deletado: boolean
          deletado_pendente: boolean
          descricao: string | null
          id: string
          prioridade: string | null
          processo_id: string | null
          status: string | null
          titulo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data_vencimento: string
          deletado?: boolean
          deletado_pendente?: boolean
          descricao?: string | null
          id?: string
          prioridade?: string | null
          processo_id?: string | null
          status?: string | null
          titulo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data_vencimento?: string
          deletado?: boolean
          deletado_pendente?: boolean
          descricao?: string | null
          id?: string
          prioridade?: string | null
          processo_id?: string | null
          status?: string | null
          titulo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prazos_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      processos: {
        Row: {
          cliente_id: string | null
          comarca: string | null
          created_at: string
          data_inicio: string | null
          data_ultima_atualizacao: string | null
          deletado: boolean
          deletado_pendente: boolean
          etiquetas: string[] | null
          id: string
          numero_processo: string
          observacoes: string | null
          proximo_prazo: string | null
          sistema_tribunal: string | null
          status: string | null
          tipo_processo: string | null
          titulo: string
          tribunal: string | null
          updated_at: string
          user_id: string
          valor_causa: number | null
          vara: string | null
          fase_processual: string | null
          responsavel_id: string | null
          requerido: string | null
          segredo_justica: boolean
          justica_gratuita: boolean
        }
        Insert: {
          cliente_id?: string | null
          comarca?: string | null
          created_at?: string
          data_inicio?: string | null
          data_ultima_atualizacao?: string | null
          deletado?: boolean
          deletado_pendente?: boolean
          etiquetas?: string[] | null
          id?: string
          numero_processo: string
          observacoes?: string | null
          proximo_prazo?: string | null
          sistema_tribunal?: string | null
          status?: string | null
          tipo_processo?: string | null
          titulo: string
          tribunal?: string | null
          updated_at?: string
          user_id: string
          valor_causa?: number | null
          vara?: string | null
          fase_processual?: string | null
          responsavel_id?: string | null
          requerido?: string | null
          segredo_justica?: boolean
          justica_gratuita?: boolean
        }
        Update: {
          cliente_id?: string | null
          comarca?: string | null
          created_at?: string
          data_inicio?: string | null
          data_ultima_atualizacao?: string | null
          deletado?: boolean
          deletado_pendente?: boolean
          etiquetas?: string[] | null
          id?: string
          numero_processo?: string
          observacoes?: string | null
          proximo_prazo?: string | null
          sistema_tribunal?: string | null
          status?: string | null
          tipo_processo?: string | null
          titulo?: string
          tribunal?: string | null
          updated_at?: string
          user_id?: string
          valor_causa?: number | null
          vara?: string | null
          fase_processual?: string | null
          responsavel_id?: string | null
          requerido?: string | null
          segredo_justica?: boolean
          justica_gratuita?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "processos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          oab: string | null
          oab_uf: string | null
          office_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          oab?: string | null
          oab_uf?: string | null
          office_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          oab?: string | null
          oab_uf?: string | null
          office_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      subscribers: {
        Row: {
          created_at: string
          email: string
          id: string
          stripe_customer_id: string | null
          subscribed: boolean
          subscription_end: string | null
          subscription_tier: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          stripe_customer_id?: string | null
          subscribed?: boolean
          subscription_end?: string | null
          subscription_tier?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          stripe_customer_id?: string | null
          subscribed?: boolean
          subscription_end?: string | null
          subscription_tier?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          access_status: string | null
          billing_cycle: string | null
          checkout_expires_at: string | null
          checkout_url: string | null
          created_at: string
          end_date: string | null
          id: string
          is_trial: boolean | null
          office_id: string
          payment_confirmed: boolean | null
          payment_status: string | null
          plan: Database["public"]["Enums"]["subscription_plan"]
          plan_name: string | null
          plan_type: string | null
          price: number | null
          start_date: string
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_end_date: string | null
          trial_start_date: string | null
          updated_at: string
        }
        Insert: {
          access_status?: string | null
          billing_cycle?: string | null
          checkout_expires_at?: string | null
          checkout_url?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          is_trial?: boolean | null
          office_id: string
          payment_confirmed?: boolean | null
          payment_status?: string | null
          plan: Database["public"]["Enums"]["subscription_plan"]
          plan_name?: string | null
          plan_type?: string | null
          price?: number | null
          start_date?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_end_date?: string | null
          trial_start_date?: string | null
          updated_at?: string
        }
        Update: {
          access_status?: string | null
          billing_cycle?: string | null
          checkout_expires_at?: string | null
          checkout_url?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          is_trial?: boolean | null
          office_id?: string
          payment_confirmed?: boolean | null
          payment_status?: string | null
          plan?: Database["public"]["Enums"]["subscription_plan"]
          plan_name?: string | null
          plan_type?: string | null
          price?: number | null
          start_date?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_end_date?: string | null
          trial_start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      tarefas: {
        Row: {
          cliente_id: string | null
          concluida: boolean | null
          created_at: string
          data_vencimento: string | null
          deletado: boolean
          deletado_pendente: boolean
          descricao: string | null
          id: string
          prioridade: string | null
          processo_id: string | null
          status: string | null
          titulo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cliente_id?: string | null
          concluida?: boolean | null
          created_at?: string
          data_vencimento?: string | null
          deletado?: boolean
          deletado_pendente?: boolean
          descricao?: string | null
          id?: string
          prioridade?: string | null
          processo_id?: string | null
          status?: string | null
          titulo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cliente_id?: string | null
          concluida?: boolean | null
          created_at?: string
          data_vencimento?: string | null
          deletado?: boolean
          deletado_pendente?: boolean
          descricao?: string | null
          id?: string
          prioridade?: string | null
          processo_id?: string | null
          status?: string | null
          titulo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheets: {
        Row: {
          categoria: string
          cliente_id: string | null
          created_at: string | null
          data_fim: string | null
          data_inicio: string
          deletado: boolean | null
          deletado_pendente: boolean | null
          duracao_minutos: number | null
          id: string
          observacoes: string | null
          office_id: string | null
          processo_id: string | null
          status: string | null
          tarefa_descricao: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          categoria?: string
          cliente_id?: string | null
          created_at?: string | null
          data_fim?: string | null
          data_inicio: string
          deletado?: boolean | null
          deletado_pendente?: boolean | null
          duracao_minutos?: number | null
          id?: string
          observacoes?: string | null
          office_id?: string | null
          processo_id?: string | null
          status?: string | null
          tarefa_descricao: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          categoria?: string
          cliente_id?: string | null
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string
          deletado?: boolean | null
          deletado_pendente?: boolean | null
          duracao_minutos?: number | null
          id?: string
          observacoes?: string | null
          office_id?: string | null
          processo_id?: string | null
          status?: string | null
          tarefa_descricao?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "timesheets_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheets_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      checkout_dashboard: {
        Row: {
          checkout_url: string | null
          created_at: string | null
          expires_at: string | null
          id: string | null
          office_id: string | null
          office_name: string | null
          paid_at: string | null
          plan_name: string | null
          plan_price_cents: number | null
          status: string | null
          status_description: string | null
          user_email: string | null
          user_id: string | null
        }
        Relationships: [
          {
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      check_trial_access: {
        Args: { office_uuid: string }
        Returns: {
          has_access: boolean
          is_trial: boolean
          days_remaining: number
          status: string
        }[]
      }
      expire_old_checkouts: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      process_checkout_expired: {
        Args: { p_checkout_id: string }
        Returns: undefined
      }
      process_checkout_webhook: {
        Args: {
          p_checkout_id: string
          p_payment_id: string
          p_status: string
          p_value_cents: number
          p_net_value_cents: number
          p_invoice_url?: string
          p_bank_slip_url?: string
          p_pix_qr_code?: string
          p_pix_qr_code_url?: string
        }
        Returns: undefined
      }
      start_trial: {
        Args: { office_uuid: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "user" | "super_admin" | "admin"
      invitation_status: "pending" | "accepted" | "expired"
      subscription_plan: "trial" | "basico" | "intermediario" | "avancado" | "premium"
      subscription_status:
        | "active"
        | "inactive"
        | "suspended"
        | "cancelled"
        | "trial"
        | "trial_expired"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["user", "super_admin", "admin"],
      invitation_status: ["pending", "accepted", "expired"],
      subscription_plan: ["trial", "basico", "intermediario", "avancado", "premium"],
      subscription_status: [
        "active",
        "inactive",
        "suspended",
        "cancelled",
        "trial",
        "trial_expired",
      ],
    },
  },
} as const
