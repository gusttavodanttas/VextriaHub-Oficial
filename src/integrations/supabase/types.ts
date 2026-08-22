export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      atendimentos: {
        Row: {
          avisos_dias: number[] | null
          cliente_id: string
          created_at: string
          data_atendimento: string
          deletado: boolean
          deletado_pendente: boolean
          duracao: number | null
          id: string
          observacoes: string | null
          office_id: string
          processo_id: string | null
          recorrencia_grupo: string | null
          recorrencia_regra: string | null
          recorrencia_restantes: number | null
          responsavel_id: string | null
          resultado: string | null
          status: string | null
          tipo_atendimento: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avisos_dias?: number[] | null
          cliente_id: string
          created_at?: string
          data_atendimento: string
          deletado?: boolean
          deletado_pendente?: boolean
          duracao?: number | null
          id?: string
          observacoes?: string | null
          office_id: string
          processo_id?: string | null
          recorrencia_grupo?: string | null
          recorrencia_regra?: string | null
          recorrencia_restantes?: number | null
          responsavel_id?: string | null
          resultado?: string | null
          status?: string | null
          tipo_atendimento: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avisos_dias?: number[] | null
          cliente_id?: string
          created_at?: string
          data_atendimento?: string
          deletado?: boolean
          deletado_pendente?: boolean
          duracao?: number | null
          id?: string
          observacoes?: string | null
          office_id?: string
          processo_id?: string | null
          recorrencia_grupo?: string | null
          recorrencia_regra?: string | null
          recorrencia_restantes?: number | null
          responsavel_id?: string | null
          resultado?: string | null
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
          {
            foreignKeyName: "atendimentos_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atendimentos_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      audiencia_tipos: {
        Row: {
          created_at: string
          id: string
          nome: string
          office_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          office_id: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          office_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audiencia_tipos_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      audiencias: {
        Row: {
          aviso_dias: number | null
          avisos_dias: number[] | null
          cliente_id: string | null
          created_at: string
          data_audiencia: string
          deletado: boolean
          deletado_pendente: boolean
          id: string
          local: string | null
          observacoes: string | null
          office_id: string
          processo_id: string | null
          responsavel_id: string | null
          status: string | null
          tipo: string | null
          titulo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          aviso_dias?: number | null
          avisos_dias?: number[] | null
          cliente_id?: string | null
          created_at?: string
          data_audiencia: string
          deletado?: boolean
          deletado_pendente?: boolean
          id?: string
          local?: string | null
          observacoes?: string | null
          office_id: string
          processo_id?: string | null
          responsavel_id?: string | null
          status?: string | null
          tipo?: string | null
          titulo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          aviso_dias?: number | null
          avisos_dias?: number[] | null
          cliente_id?: string | null
          created_at?: string
          data_audiencia?: string
          deletado?: boolean
          deletado_pendente?: boolean
          id?: string
          local?: string | null
          observacoes?: string | null
          office_id?: string
          processo_id?: string | null
          responsavel_id?: string | null
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
            foreignKeyName: "audiencias_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
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
      billing_events: {
        Row: {
          asaas_payment_id: string | null
          asaas_subscription_id: string | null
          created_at: string
          due_date: string | null
          event: string | null
          id: string
          invoice_url: string | null
          office_id: string | null
          raw: Json | null
          status: string | null
          value: number | null
        }
        Insert: {
          asaas_payment_id?: string | null
          asaas_subscription_id?: string | null
          created_at?: string
          due_date?: string | null
          event?: string | null
          id?: string
          invoice_url?: string | null
          office_id?: string | null
          raw?: Json | null
          status?: string | null
          value?: number | null
        }
        Update: {
          asaas_payment_id?: string | null
          asaas_subscription_id?: string | null
          created_at?: string
          due_date?: string | null
          event?: string | null
          id?: string
          invoice_url?: string | null
          office_id?: string | null
          raw?: Json | null
          status?: string | null
          value?: number | null
        }
        Relationships: []
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
          observacoes: string | null
          office_id: string
          origem: string | null
          proximo_contato: string | null
          status: string | null
          team_id: string | null
          telefone: string | null
          tipo_pessoa: string | null
          updated_at: string
          user_id: string
          valor_estimado: number | null
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
          observacoes?: string | null
          office_id: string
          origem?: string | null
          proximo_contato?: string | null
          status?: string | null
          team_id?: string | null
          telefone?: string | null
          tipo_pessoa?: string | null
          updated_at?: string
          user_id: string
          valor_estimado?: number | null
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
          observacoes?: string | null
          office_id?: string
          origem?: string | null
          proximo_contato?: string | null
          status?: string | null
          team_id?: string | null
          telefone?: string | null
          tipo_pessoa?: string | null
          updated_at?: string
          user_id?: string
          valor_estimado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "office_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      consultivo_categorias: {
        Row: {
          cor: string | null
          created_at: string | null
          icone: string | null
          id: string
          label: string
          office_id: string | null
          ordem: number | null
          valor: string
        }
        Insert: {
          cor?: string | null
          created_at?: string | null
          icone?: string | null
          id?: string
          label: string
          office_id?: string | null
          ordem?: number | null
          valor: string
        }
        Update: {
          cor?: string | null
          created_at?: string | null
          icone?: string | null
          id?: string
          label?: string
          office_id?: string | null
          ordem?: number | null
          valor?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultivo_categorias_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      consultivos: {
        Row: {
          categoria: string
          cliente_id: string | null
          created_at: string | null
          deletado: boolean | null
          deletado_pendente: boolean | null
          descricao: string | null
          id: string
          observacoes: string | null
          office_id: string
          prazo: string | null
          prioridade: string | null
          responsavel_id: string | null
          status: string | null
          tags: string[] | null
          titulo: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          categoria?: string
          cliente_id?: string | null
          created_at?: string | null
          deletado?: boolean | null
          deletado_pendente?: boolean | null
          descricao?: string | null
          id?: string
          observacoes?: string | null
          office_id: string
          prazo?: string | null
          prioridade?: string | null
          responsavel_id?: string | null
          status?: string | null
          tags?: string[] | null
          titulo: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          categoria?: string
          cliente_id?: string | null
          created_at?: string | null
          deletado?: boolean | null
          deletado_pendente?: boolean | null
          descricao?: string | null
          id?: string
          observacoes?: string | null
          office_id?: string
          prazo?: string | null
          prioridade?: string | null
          responsavel_id?: string | null
          status?: string | null
          tags?: string[] | null
          titulo?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultivos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultivos_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      email_digest_log: {
        Row: {
          ref_date: string
          sent_at: string
          user_id: string
        }
        Insert: {
          ref_date: string
          sent_at?: string
          user_id: string
        }
        Update: {
          ref_date?: string
          sent_at?: string
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
          office_id: string | null
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
          office_id?: string | null
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
          office_id?: string | null
          registro_id?: string
          solicitado_em?: string
          status?: string | null
          tabela?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exclusoes_pendentes_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
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
          grupo_id: string | null
          id: string
          office_id: string
          parcela_numero: number | null
          parcela_total: number | null
          processo_id: string | null
          recorrencia: string | null
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
          grupo_id?: string | null
          id?: string
          office_id: string
          parcela_numero?: number | null
          parcela_total?: number | null
          processo_id?: string | null
          recorrencia?: string | null
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
          grupo_id?: string | null
          id?: string
          office_id?: string
          parcela_numero?: number | null
          parcela_total?: number | null
          processo_id?: string | null
          recorrencia?: string | null
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
            foreignKeyName: "financeiro_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
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
          office_id: string
          periodo: string
          status: string | null
          team_id: string | null
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
          office_id: string
          periodo: string
          status?: string | null
          team_id?: string | null
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
          office_id?: string
          periodo?: string
          status?: string | null
          team_id?: string | null
          tipo?: string
          titulo?: string
          updated_at?: string
          user_id?: string
          valor_atual?: number | null
          valor_meta?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "metas_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metas_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "office_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      monitoramento_termos: {
        Row: {
          ativo: boolean | null
          created_at: string
          id: string
          office_id: string
          seccional: string | null
          termo: string
          tipo: string
          ultima_busca: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string
          id?: string
          office_id: string
          seccional?: string | null
          termo: string
          tipo?: string
          ultima_busca?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string
          id?: string
          office_id?: string
          seccional?: string | null
          termo?: string
          tipo?: string
          ultima_busca?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "monitoramento_termos_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      monitored_oabs: {
        Row: {
          added_by: string | null
          created_at: string
          id: string
          label: string | null
          oab: string
          office_id: string
          uf: string
          user_id: string | null
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          id?: string
          label?: string | null
          oab: string
          office_id: string
          uf: string
          user_id?: string | null
        }
        Update: {
          added_by?: string | null
          created_at?: string
          id?: string
          label?: string | null
          oab?: string
          office_id?: string
          uf?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "monitored_oabs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      movimentacoes_processo: {
        Row: {
          created_at: string | null
          data_movimentacao: string
          descricao: string
          id: string
          metadata: Json | null
          office_id: string
          processo_id: string
          tipo: string | null
        }
        Insert: {
          created_at?: string | null
          data_movimentacao?: string
          descricao: string
          id?: string
          metadata?: Json | null
          office_id: string
          processo_id: string
          tipo?: string | null
        }
        Update: {
          created_at?: string | null
          data_movimentacao?: string
          descricao?: string
          id?: string
          metadata?: Json | null
          office_id?: string
          processo_id?: string
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movimentacoes_processo_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          data: Json | null
          id: string
          message: string | null
          office_id: string | null
          read: boolean | null
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          id?: string
          message?: string | null
          office_id?: string | null
          read?: boolean | null
          title: string
          type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          id?: string
          message?: string | null
          office_id?: string | null
          read?: boolean | null
          title?: string
          type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      office_access_changes: {
        Row: {
          action: string
          changed_by: string
          created_at: string
          details: Json | null
          id: string
          office_id: string
        }
        Insert: {
          action: string
          changed_by: string
          created_at?: string
          details?: Json | null
          id?: string
          office_id: string
        }
        Update: {
          action?: string
          changed_by?: string
          created_at?: string
          details?: Json | null
          id?: string
          office_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "office_access_changes_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      office_subscriptions: {
        Row: {
          asaas_customer_id: string | null
          asaas_subscription_id: string | null
          base_value: number | null
          billing_type: string
          created_at: string
          cycle: string
          is_lifetime: boolean
          last_invoice_url: string | null
          manual_discount_percent: number
          next_due_date: string | null
          office_id: string
          plan_claimed: boolean
          plan_name: string | null
          status: string
          trial_ends_at: string | null
          updated_at: string
          value: number
        }
        Insert: {
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          base_value?: number | null
          billing_type?: string
          created_at?: string
          cycle?: string
          is_lifetime?: boolean
          last_invoice_url?: string | null
          manual_discount_percent?: number
          next_due_date?: string | null
          office_id: string
          plan_claimed?: boolean
          plan_name?: string | null
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
          value?: number
        }
        Update: {
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          base_value?: number | null
          billing_type?: string
          created_at?: string
          cycle?: string
          is_lifetime?: boolean
          last_invoice_url?: string | null
          manual_discount_percent?: number
          next_due_date?: string | null
          office_id?: string
          plan_claimed?: boolean
          plan_name?: string | null
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "office_subscriptions_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: true
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      office_team_members: {
        Row: {
          created_at: string | null
          id: string
          office_id: string
          role: string
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          office_id: string
          role?: string
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          office_id?: string
          role?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "office_team_members_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "office_team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "office_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      office_teams: {
        Row: {
          color: string
          created_at: string | null
          description: string | null
          id: string
          name: string
          office_id: string
        }
        Insert: {
          color?: string
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          office_id: string
        }
        Update: {
          color?: string
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          office_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "office_teams_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
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
          access_granted_at: string | null
          access_granted_by: string | null
          access_note: string | null
          access_type: Database["public"]["Enums"]["access_type"]
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
          plan: string
          settings: Json | null
          updated_at: string
        }
        Insert: {
          access_granted_at?: string | null
          access_granted_by?: string | null
          access_note?: string | null
          access_type?: Database["public"]["Enums"]["access_type"]
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
          plan?: string
          settings?: Json | null
          updated_at?: string
        }
        Update: {
          access_granted_at?: string | null
          access_granted_by?: string | null
          access_note?: string | null
          access_type?: Database["public"]["Enums"]["access_type"]
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
          plan?: string
          settings?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      plan_configs: {
        Row: {
          created_at: string
          cycle: string
          features: Json | null
          id: string
          is_active: boolean | null
          max_oabs: number
          plan_name: string
          plan_type: string
          price_cents: number
          signup_only: boolean
          trial_days: number | null
        }
        Insert: {
          created_at?: string
          cycle?: string
          features?: Json | null
          id?: string
          is_active?: boolean | null
          max_oabs?: number
          plan_name: string
          plan_type: string
          price_cents?: number
          signup_only?: boolean
          trial_days?: number | null
        }
        Update: {
          created_at?: string
          cycle?: string
          features?: Json | null
          id?: string
          is_active?: boolean | null
          max_oabs?: number
          plan_name?: string
          plan_type?: string
          price_cents?: number
          signup_only?: boolean
          trial_days?: number | null
        }
        Relationships: []
      }
      prazos: {
        Row: {
          audiencia_data_sugerida: string | null
          audiencia_hora_sugerida: string | null
          audiencia_tipo_sugerido: string | null
          aviso_dias: number | null
          avisos_dias: number[] | null
          base_legal: string | null
          calculado_em: string
          concluido_em: string | null
          concluido_por: string | null
          confirmado_em: string | null
          confirmado_por: string | null
          created_at: string
          data_disponibilizacao: string | null
          data_fim_prazo: string | null
          data_intimacao: string | null
          data_prazo_interno: string | null
          data_publicacao: string | null
          data_vencimento: string | null
          deletado: boolean
          descricao: string | null
          dias_corridos: boolean
          dias_uteis: number | null
          eh_juizado: boolean
          id: string
          numero_processo: string | null
          office_id: string
          possivel_audiencia: boolean
          prioridade: string | null
          processo_id: string | null
          publicacao_id: string | null
          responsavel_id: string | null
          status: string
          tipo_prazo: string
          titular: string
          titulo: string | null
          user_id: string | null
        }
        Insert: {
          audiencia_data_sugerida?: string | null
          audiencia_hora_sugerida?: string | null
          audiencia_tipo_sugerido?: string | null
          aviso_dias?: number | null
          avisos_dias?: number[] | null
          base_legal?: string | null
          calculado_em?: string
          concluido_em?: string | null
          concluido_por?: string | null
          confirmado_em?: string | null
          confirmado_por?: string | null
          created_at?: string
          data_disponibilizacao?: string | null
          data_fim_prazo?: string | null
          data_intimacao?: string | null
          data_prazo_interno?: string | null
          data_publicacao?: string | null
          data_vencimento?: string | null
          deletado?: boolean
          descricao?: string | null
          dias_corridos?: boolean
          dias_uteis?: number | null
          eh_juizado?: boolean
          id?: string
          numero_processo?: string | null
          office_id: string
          possivel_audiencia?: boolean
          prioridade?: string | null
          processo_id?: string | null
          publicacao_id?: string | null
          responsavel_id?: string | null
          status?: string
          tipo_prazo?: string
          titular?: string
          titulo?: string | null
          user_id?: string | null
        }
        Update: {
          audiencia_data_sugerida?: string | null
          audiencia_hora_sugerida?: string | null
          audiencia_tipo_sugerido?: string | null
          aviso_dias?: number | null
          avisos_dias?: number[] | null
          base_legal?: string | null
          calculado_em?: string
          concluido_em?: string | null
          concluido_por?: string | null
          confirmado_em?: string | null
          confirmado_por?: string | null
          created_at?: string
          data_disponibilizacao?: string | null
          data_fim_prazo?: string | null
          data_intimacao?: string | null
          data_prazo_interno?: string | null
          data_publicacao?: string | null
          data_vencimento?: string | null
          deletado?: boolean
          descricao?: string | null
          dias_corridos?: boolean
          dias_uteis?: number | null
          eh_juizado?: boolean
          id?: string
          numero_processo?: string | null
          office_id?: string
          possivel_audiencia?: boolean
          prioridade?: string | null
          processo_id?: string | null
          publicacao_id?: string | null
          responsavel_id?: string | null
          status?: string
          tipo_prazo?: string
          titular?: string
          titulo?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prazos_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prazos_publicacao_id_fkey"
            columns: ["publicacao_id"]
            isOneToOne: true
            referencedRelation: "publicacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      process_search_log: {
        Row: {
          created_at: string
          id: string
          office_id: string | null
          user_id: string
          weight: number
        }
        Insert: {
          created_at?: string
          id?: string
          office_id?: string | null
          user_id: string
          weight?: number
        }
        Update: {
          created_at?: string
          id?: string
          office_id?: string | null
          user_id?: string
          weight?: number
        }
        Relationships: []
      }
      processos: {
        Row: {
          assunto_principal: string | null
          classe_judicial: string | null
          cliente_id: string | null
          comarca: string | null
          created_at: string
          data_ajuizamento: string | null
          data_distribuicao: string | null
          data_encerramento: string | null
          data_inicio: string | null
          data_ultima_atualizacao: string | null
          deletado: boolean
          deletado_pendente: boolean
          etiquetas: string[] | null
          fase_processual: string | null
          fonte_sincronizacao: string | null
          id: string
          instancia: string | null
          juiz: string | null
          justica_gratuita: boolean | null
          natureza: string | null
          nivel_sigilo: number | null
          numero_processo: string
          observacoes: string | null
          office_id: string
          orgao_julgador_codigo: string | null
          parte_autora: string | null
          proximo_prazo: string | null
          requerido: string | null
          responsavel_id: string | null
          resultado: string | null
          segredo_justica: boolean | null
          sincronizado_em: string | null
          sistema_tribunal: string | null
          status: string | null
          team_id: string | null
          tipo_processo: string | null
          titulo: string
          tribunal: string | null
          updated_at: string
          user_id: string
          valor_causa: number | null
          vara: string | null
        }
        Insert: {
          assunto_principal?: string | null
          classe_judicial?: string | null
          cliente_id?: string | null
          comarca?: string | null
          created_at?: string
          data_ajuizamento?: string | null
          data_distribuicao?: string | null
          data_encerramento?: string | null
          data_inicio?: string | null
          data_ultima_atualizacao?: string | null
          deletado?: boolean
          deletado_pendente?: boolean
          etiquetas?: string[] | null
          fase_processual?: string | null
          fonte_sincronizacao?: string | null
          id?: string
          instancia?: string | null
          juiz?: string | null
          justica_gratuita?: boolean | null
          natureza?: string | null
          nivel_sigilo?: number | null
          numero_processo: string
          observacoes?: string | null
          office_id: string
          orgao_julgador_codigo?: string | null
          parte_autora?: string | null
          proximo_prazo?: string | null
          requerido?: string | null
          responsavel_id?: string | null
          resultado?: string | null
          segredo_justica?: boolean | null
          sincronizado_em?: string | null
          sistema_tribunal?: string | null
          status?: string | null
          team_id?: string | null
          tipo_processo?: string | null
          titulo: string
          tribunal?: string | null
          updated_at?: string
          user_id: string
          valor_causa?: number | null
          vara?: string | null
        }
        Update: {
          assunto_principal?: string | null
          classe_judicial?: string | null
          cliente_id?: string | null
          comarca?: string | null
          created_at?: string
          data_ajuizamento?: string | null
          data_distribuicao?: string | null
          data_encerramento?: string | null
          data_inicio?: string | null
          data_ultima_atualizacao?: string | null
          deletado?: boolean
          deletado_pendente?: boolean
          etiquetas?: string[] | null
          fase_processual?: string | null
          fonte_sincronizacao?: string | null
          id?: string
          instancia?: string | null
          juiz?: string | null
          justica_gratuita?: boolean | null
          natureza?: string | null
          nivel_sigilo?: number | null
          numero_processo?: string
          observacoes?: string | null
          office_id?: string
          orgao_julgador_codigo?: string | null
          parte_autora?: string | null
          proximo_prazo?: string | null
          requerido?: string | null
          responsavel_id?: string | null
          resultado?: string | null
          segredo_justica?: boolean | null
          sincronizado_em?: string | null
          sistema_tribunal?: string | null
          status?: string | null
          team_id?: string | null
          tipo_processo?: string | null
          titulo?: string
          tribunal?: string | null
          updated_at?: string
          user_id?: string
          valor_causa?: number | null
          vara?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "processos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processos_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processos_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "office_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      processos_descartados: {
        Row: {
          created_at: string | null
          dados_originais: Json | null
          id: string
          motivo: string | null
          numero_processo: string
          office_id: string
          titulo: string | null
          tribunal: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          dados_originais?: Json | null
          id?: string
          motivo?: string | null
          numero_processo: string
          office_id: string
          titulo?: string | null
          tribunal?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          dados_originais?: Json | null
          id?: string
          motivo?: string | null
          numero_processo?: string
          office_id?: string
          titulo?: string | null
          tribunal?: string | null
          user_id?: string
        }
        Relationships: []
      }
      processos_encontrados: {
        Row: {
          autor: string | null
          created_at: string
          encontrado_por: string | null
          fonte: string | null
          id: string
          numero_processo: string
          office_id: string
          payload: Json | null
          reu: string | null
          titulo: string | null
          tribunal: string | null
        }
        Insert: {
          autor?: string | null
          created_at?: string
          encontrado_por?: string | null
          fonte?: string | null
          id?: string
          numero_processo: string
          office_id: string
          payload?: Json | null
          reu?: string | null
          titulo?: string | null
          tribunal?: string | null
        }
        Update: {
          autor?: string | null
          created_at?: string
          encontrado_por?: string | null
          fonte?: string | null
          id?: string
          numero_processo?: string
          office_id?: string
          payload?: Json | null
          reu?: string | null
          titulo?: string | null
          tribunal?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          cpf_cnpj: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          oab: string | null
          oab_uf: string | null
          office_id: string | null
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          oab?: string | null
          oab_uf?: string | null
          office_id?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          oab?: string | null
          oab_uf?: string | null
          office_id?: string | null
          phone?: string | null
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
      publicacoes: {
        Row: {
          cliente_id: string | null
          comarca: string | null
          conteudo: string
          created_at: string
          data_publicacao: string
          id: string
          instancia: string | null
          juiz: string | null
          metadata: Json | null
          natureza: string | null
          nome_orgao: string | null
          numero_processo: string
          office_id: string
          processo_id: string | null
          status: string
          tags: string[] | null
          tipo_acao: string | null
          tipo_documento: string | null
          titulo: string
          tribunal: string | null
          updated_at: string
          urgencia: string
          user_id: string | null
          vara: string | null
        }
        Insert: {
          cliente_id?: string | null
          comarca?: string | null
          conteudo: string
          created_at?: string
          data_publicacao: string
          id?: string
          instancia?: string | null
          juiz?: string | null
          metadata?: Json | null
          natureza?: string | null
          nome_orgao?: string | null
          numero_processo: string
          office_id: string
          processo_id?: string | null
          status?: string
          tags?: string[] | null
          tipo_acao?: string | null
          tipo_documento?: string | null
          titulo: string
          tribunal?: string | null
          updated_at?: string
          urgencia?: string
          user_id?: string | null
          vara?: string | null
        }
        Update: {
          cliente_id?: string | null
          comarca?: string | null
          conteudo?: string
          created_at?: string
          data_publicacao?: string
          id?: string
          instancia?: string | null
          juiz?: string | null
          metadata?: Json | null
          natureza?: string | null
          nome_orgao?: string | null
          numero_processo?: string
          office_id?: string
          processo_id?: string | null
          status?: string
          tags?: string[] | null
          tipo_acao?: string | null
          tipo_documento?: string | null
          titulo?: string
          tribunal?: string | null
          updated_at?: string
          urgencia?: string
          user_id?: string | null
          vara?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "publicacoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publicacoes_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publicacoes_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      tarefa_comentarios: {
        Row: {
          created_at: string
          deletado: boolean
          id: string
          office_id: string
          tarefa_id: string
          texto: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deletado?: boolean
          id?: string
          office_id: string
          tarefa_id: string
          texto: string
          user_id: string
        }
        Update: {
          created_at?: string
          deletado?: boolean
          id?: string
          office_id?: string
          tarefa_id?: string
          texto?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefa_comentarios_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefa_comentarios_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      tarefa_subtarefas: {
        Row: {
          concluida: boolean
          created_at: string
          deletado: boolean
          id: string
          office_id: string
          ordem: number
          tarefa_id: string
          titulo: string
        }
        Insert: {
          concluida?: boolean
          created_at?: string
          deletado?: boolean
          id?: string
          office_id: string
          ordem?: number
          tarefa_id: string
          titulo: string
        }
        Update: {
          concluida?: boolean
          created_at?: string
          deletado?: boolean
          id?: string
          office_id?: string
          ordem?: number
          tarefa_id?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefa_subtarefas_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefa_subtarefas_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      tarefas: {
        Row: {
          atendimento_id: string | null
          aviso_dias: number | null
          avisos_dias: number[] | null
          cliente_id: string | null
          concluida: boolean | null
          concluida_em: string | null
          concluida_por: string | null
          created_at: string
          data_vencimento: string | null
          deletado: boolean
          deletado_pendente: boolean
          descricao: string | null
          id: string
          office_id: string
          prioridade: string | null
          processo_id: string | null
          recorrencia_grupo: string | null
          recorrencia_regra: string | null
          recorrencia_restantes: number | null
          responsavel_id: string | null
          status: string | null
          titulo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          atendimento_id?: string | null
          aviso_dias?: number | null
          avisos_dias?: number[] | null
          cliente_id?: string | null
          concluida?: boolean | null
          concluida_em?: string | null
          concluida_por?: string | null
          created_at?: string
          data_vencimento?: string | null
          deletado?: boolean
          deletado_pendente?: boolean
          descricao?: string | null
          id?: string
          office_id: string
          prioridade?: string | null
          processo_id?: string | null
          recorrencia_grupo?: string | null
          recorrencia_regra?: string | null
          recorrencia_restantes?: number | null
          responsavel_id?: string | null
          status?: string | null
          titulo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          atendimento_id?: string | null
          aviso_dias?: number | null
          avisos_dias?: number[] | null
          cliente_id?: string | null
          concluida?: boolean | null
          concluida_em?: string | null
          concluida_por?: string | null
          created_at?: string
          data_vencimento?: string | null
          deletado?: boolean
          deletado_pendente?: boolean
          descricao?: string | null
          id?: string
          office_id?: string
          prioridade?: string | null
          processo_id?: string | null
          recorrencia_grupo?: string | null
          recorrencia_regra?: string | null
          recorrencia_restantes?: number | null
          responsavel_id?: string | null
          status?: string | null
          titulo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefas_atendimento_id_fkey"
            columns: ["atendimento_id"]
            isOneToOne: false
            referencedRelation: "atendimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
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
          faturado: boolean
          faturado_em: string | null
          faturavel: boolean
          financeiro_id: string | null
          id: string
          observacoes: string | null
          office_id: string
          processo_id: string | null
          referencia_id: string | null
          referencia_label: string | null
          referencia_tipo: string | null
          status: string | null
          tarefa_descricao: string
          updated_at: string | null
          user_id: string
          valor_hora: number | null
        }
        Insert: {
          categoria?: string
          cliente_id?: string | null
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string
          deletado?: boolean | null
          deletado_pendente?: boolean | null
          duracao_minutos?: number | null
          faturado?: boolean
          faturado_em?: string | null
          faturavel?: boolean
          financeiro_id?: string | null
          id?: string
          observacoes?: string | null
          office_id: string
          processo_id?: string | null
          referencia_id?: string | null
          referencia_label?: string | null
          referencia_tipo?: string | null
          status?: string | null
          tarefa_descricao: string
          updated_at?: string | null
          user_id: string
          valor_hora?: number | null
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
          faturado?: boolean
          faturado_em?: string | null
          faturavel?: boolean
          financeiro_id?: string | null
          id?: string
          observacoes?: string | null
          office_id?: string
          processo_id?: string | null
          referencia_id?: string | null
          referencia_label?: string | null
          referencia_tipo?: string | null
          status?: string | null
          tarefa_descricao?: string
          updated_at?: string | null
          user_id?: string
          valor_hora?: number | null
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
            foreignKeyName: "timesheets_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
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
      tipos_ato_prazo: {
        Row: {
          corridos: boolean
          created_at: string | null
          dias_uteis: number
          id: string
          label: string
          margem: number
          office_id: string
          ordem: number
          value: string
        }
        Insert: {
          corridos?: boolean
          created_at?: string | null
          dias_uteis?: number
          id?: string
          label: string
          margem?: number
          office_id: string
          ordem?: number
          value: string
        }
        Update: {
          corridos?: boolean
          created_at?: string | null
          dias_uteis?: number
          id?: string
          label?: string
          margem?: number
          office_id?: string
          ordem?: number
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "tipos_ato_prazo_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      trial_reminder_log: {
        Row: {
          id: string
          kind: string
          office_id: string
          sent_at: string
          trial_ends_at: string
        }
        Insert: {
          id?: string
          kind: string
          office_id: string
          sent_at?: string
          trial_ends_at: string
        }
        Update: {
          id?: string
          kind?: string
          office_id?: string
          sent_at?: string
          trial_ends_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trial_reminder_log_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notification_prefs: {
        Row: {
          lead_dias: number
          prefs: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          lead_dias?: number
          prefs?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          lead_dias?: number
          prefs?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          created_at: string | null
          granted: boolean
          id: string
          office_id: string | null
          permission_key: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          granted?: boolean
          id?: string
          office_id?: string | null
          permission_key: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          granted?: boolean
          id?: string
          office_id?: string | null
          permission_key?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_signup_plan: { Args: { p_plan_type: string }; Returns: string }
      authorize_process_search: {
        Args: {
          p_oab: string
          p_uf: string
          p_user_id: string
          p_weight?: number
        }
        Returns: Json
      }
      can_manage_member: {
        Args: { p_member: string; p_office_id: string }
        Returns: boolean
      }
      confirm_invited_user: {
        Args: { p_email: string; p_token: string }
        Returns: boolean
      }
      coordinated_team_ids: { Args: { p_office_id: string }; Returns: string[] }
      delete_office: {
        Args: { p_confirm_name: string; p_office_id: string }
        Returns: Json
      }
      ensure_office_for_user: { Args: never; Returns: string }
      get_user_office_ids: { Args: never; Returns: string[] }
      is_office_admin: { Args: { p_office_id: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      my_oab_quota: { Args: never; Returns: Json }
      office_has_access: { Args: { p_office: string }; Returns: boolean }
      office_oab_limit: { Args: { p_office: string }; Returns: number }
      team_visible_user_ids: {
        Args: { p_office_id: string }
        Returns: string[]
      }
      user_belongs_to_office: {
        Args: { p_office_id: string }
        Returns: boolean
      }
    }
    Enums: {
      access_type: "trial" | "stripe_paid" | "lifetime" | "courtesy"
      app_role: "user" | "admin" | "super_admin"
      invitation_status: "pending" | "accepted" | "expired"
      subscription_plan: "free" | "basic" | "professional" | "enterprise"
      subscription_status: "active" | "inactive" | "suspended" | "cancelled"
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
      access_type: ["trial", "stripe_paid", "lifetime", "courtesy"],
      app_role: ["user", "admin", "super_admin"],
      invitation_status: ["pending", "accepted", "expired"],
      subscription_plan: ["free", "basic", "professional", "enterprise"],
      subscription_status: ["active", "inactive", "suspended", "cancelled"],
    },
  },
} as const
