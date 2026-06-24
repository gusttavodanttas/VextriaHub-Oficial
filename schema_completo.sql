-- SCHEMA CONSOLIDADO VEXTRIA UB
-- Gerado em: 2026-06-24
-- Cole este script no SQL Editor do Supabase Dashboard

-- ============================================================
-- MIGRATION: 20240419_access_architecture.sql
-- ============================================================
-- MIGRATION: Arquitetura de Acesso v2.0
-- RODE ESTE SCRIPT NO SQL EDITOR DO SUPABASE PARA ATIVAR OS CENÁRIOS A E B

-- 1. Criar tipo de acesso
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'access_type') THEN
        CREATE TYPE public.access_type AS ENUM ('trial', 'stripe_paid', 'lifetime', 'courtesy');
    END IF;
END $$;

-- 2. Adicionar campos em OFFICES (Controle de Entitlement)
ALTER TABLE public.offices 
  ADD COLUMN IF NOT EXISTS access_type public.access_type NOT NULL DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS access_granted_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS access_granted_at timestamptz,
  ADD COLUMN IF NOT EXISTS access_note text;

-- 3. Adicionar campos em SUBSCRIPTIONS (Controle de Desconto Manual)
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS manual_discount_percent numeric(5,2),
  ADD COLUMN IF NOT EXISTS stripe_coupon_id text;

-- 4. Criar Tabela de Auditoria de Acessos
CREATE TABLE IF NOT EXISTS public.office_access_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  changed_by uuid NOT NULL REFERENCES auth.users(id),
  action text NOT NULL, -- 'apply_discount', 'grant_lifetime', etc
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Habilitar RLS na tabela de auditoria
ALTER TABLE public.office_access_changes ENABLE ROW LEVEL SECURITY;

-- 6. Garantir constraint ÚNICA em subscriptions.office_id (Prevenção 42P10)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_office_id_key') THEN
        ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_office_id_key UNIQUE (office_id);
    END IF;
END $$;


-- ============================================================
-- MIGRATION: 20250709061622-9476383c-df6e-4b8e-a53d-7a164169da47.sql
-- ============================================================
-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('user', 'super_admin');

-- Create profiles table for additional user information
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for profiles
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create function to automatically create profile and set super admin role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    NEW.email,
    CASE 
      WHEN NEW.email = 'contato@vextriahub.com.br' THEN 'super_admin'::app_role
      ELSE 'user'::app_role
    END
  );
  RETURN NEW;
END;
$$;

-- Create trigger to automatically create profile when user signs up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- MIGRATION: 20250709123659-909b2670-1328-425b-a9c0-c091ec857f8f.sql
-- ============================================================
-- Criação das tabelas principais do sistema jurídico com controle de usuário e exclusão pendente

-- Tabela de clientes
CREATE TABLE public.clientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  cpf_cnpj TEXT,
  tipo_pessoa TEXT CHECK (tipo_pessoa IN ('fisica', 'juridica')) DEFAULT 'fisica',
  endereco TEXT,
  origem TEXT,
  data_aniversario DATE,
  status TEXT DEFAULT 'ativo',
  deletado BOOLEAN NOT NULL DEFAULT false,
  deletado_pendente BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de processos
CREATE TABLE public.processos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  numero_processo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  status TEXT DEFAULT 'ativo',
  tipo_processo TEXT,
  tribunal TEXT,
  comarca TEXT,
  sistema_tribunal TEXT,
  vara TEXT,
  valor_causa DECIMAL(15,2),
  data_inicio DATE DEFAULT CURRENT_DATE,
  data_ultima_atualizacao DATE DEFAULT CURRENT_DATE,
  proximo_prazo DATE,
  etiquetas TEXT[],
  observacoes TEXT,
  deletado BOOLEAN NOT NULL DEFAULT false,
  deletado_pendente BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de audiências
CREATE TABLE public.audiencias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  processo_id UUID REFERENCES public.processos(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  tipo TEXT,
  data_audiencia TIMESTAMP WITH TIME ZONE NOT NULL,
  local TEXT,
  observacoes TEXT,
  status TEXT DEFAULT 'agendada',
  deletado BOOLEAN NOT NULL DEFAULT false,
  deletado_pendente BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de prazos
CREATE TABLE public.prazos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  processo_id UUID REFERENCES public.processos(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  data_vencimento DATE NOT NULL,
  prioridade TEXT CHECK (prioridade IN ('baixa', 'media', 'alta')) DEFAULT 'media',
  status TEXT DEFAULT 'pendente',
  deletado BOOLEAN NOT NULL DEFAULT false,
  deletado_pendente BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de tarefas
CREATE TABLE public.tarefas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  processo_id UUID REFERENCES public.processos(id) ON DELETE SET NULL,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  prioridade TEXT CHECK (prioridade IN ('baixa', 'media', 'alta')) DEFAULT 'media',
  status TEXT DEFAULT 'pendente',
  data_vencimento DATE,
  concluida BOOLEAN DEFAULT false,
  deletado BOOLEAN NOT NULL DEFAULT false,
  deletado_pendente BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de atendimentos
CREATE TABLE public.atendimentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  tipo_atendimento TEXT NOT NULL,
  data_atendimento TIMESTAMP WITH TIME ZONE NOT NULL,
  duracao INTEGER, -- em minutos
  observacoes TEXT,
  status TEXT DEFAULT 'agendado',
  deletado BOOLEAN NOT NULL DEFAULT false,
  deletado_pendente BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de metas
CREATE TABLE public.metas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  tipo TEXT NOT NULL, -- 'processos', 'clientes', 'receita', etc.
  valor_meta DECIMAL(15,2),
  valor_atual DECIMAL(15,2) DEFAULT 0,
  periodo TEXT NOT NULL, -- 'mensal', 'trimestral', 'anual'
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  status TEXT DEFAULT 'ativa',
  deletado BOOLEAN NOT NULL DEFAULT false,
  deletado_pendente BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de dados financeiros
CREATE TABLE public.financeiro (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  processo_id UUID REFERENCES public.processos(id) ON DELETE SET NULL,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  tipo TEXT CHECK (tipo IN ('receita', 'despesa')) NOT NULL,
  descricao TEXT NOT NULL,
  valor DECIMAL(15,2) NOT NULL,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  status TEXT DEFAULT 'pendente',
  categoria TEXT,
  deletado BOOLEAN NOT NULL DEFAULT false,
  deletado_pendente BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para gerenciar exclusões pendentes (para o painel do administrador)
CREATE TABLE public.exclusoes_pendentes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tabela TEXT NOT NULL,
  registro_id UUID NOT NULL,
  dados_registro JSONB NOT NULL,
  motivo TEXT,
  solicitado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  aprovado_por UUID REFERENCES auth.users(id),
  aprovado_em TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'rejeitado'))
);

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audiencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prazos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tarefas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atendimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exclusoes_pendentes ENABLE ROW LEVEL SECURITY;

-- Políticas para clientes
CREATE POLICY "Usuários podem ver seus próprios clientes" 
ON public.clientes FOR SELECT 
USING (auth.uid() = user_id AND deletado = false);

CREATE POLICY "Usuários podem criar seus próprios clientes" 
ON public.clientes FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seus próprios clientes" 
ON public.clientes FOR UPDATE 
USING (auth.uid() = user_id);

-- Políticas para processos
CREATE POLICY "Usuários podem ver seus próprios processos" 
ON public.processos FOR SELECT 
USING (auth.uid() = user_id AND deletado = false);

CREATE POLICY "Usuários podem criar seus próprios processos" 
ON public.processos FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seus próprios processos" 
ON public.processos FOR UPDATE 
USING (auth.uid() = user_id);

-- Políticas para audiências
CREATE POLICY "Usuários podem ver suas próprias audiências" 
ON public.audiencias FOR SELECT 
USING (auth.uid() = user_id AND deletado = false);

CREATE POLICY "Usuários podem criar suas próprias audiências" 
ON public.audiencias FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas próprias audiências" 
ON public.audiencias FOR UPDATE 
USING (auth.uid() = user_id);

-- Políticas para prazos
CREATE POLICY "Usuários podem ver seus próprios prazos" 
ON public.prazos FOR SELECT 
USING (auth.uid() = user_id AND deletado = false);

CREATE POLICY "Usuários podem criar seus próprios prazos" 
ON public.prazos FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seus próprios prazos" 
ON public.prazos FOR UPDATE 
USING (auth.uid() = user_id);

-- Políticas para tarefas
CREATE POLICY "Usuários podem ver suas próprias tarefas" 
ON public.tarefas FOR SELECT 
USING (auth.uid() = user_id AND deletado = false);

CREATE POLICY "Usuários podem criar suas próprias tarefas" 
ON public.tarefas FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas próprias tarefas" 
ON public.tarefas FOR UPDATE 
USING (auth.uid() = user_id);

-- Políticas para atendimentos
CREATE POLICY "Usuários podem ver seus próprios atendimentos" 
ON public.atendimentos FOR SELECT 
USING (auth.uid() = user_id AND deletado = false);

CREATE POLICY "Usuários podem criar seus próprios atendimentos" 
ON public.atendimentos FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seus próprios atendimentos" 
ON public.atendimentos FOR UPDATE 
USING (auth.uid() = user_id);

-- Políticas para metas
CREATE POLICY "Usuários podem ver suas próprias metas" 
ON public.metas FOR SELECT 
USING (auth.uid() = user_id AND deletado = false);

CREATE POLICY "Usuários podem criar suas próprias metas" 
ON public.metas FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas próprias metas" 
ON public.metas FOR UPDATE 
USING (auth.uid() = user_id);

-- Políticas para financeiro
CREATE POLICY "Usuários podem ver seus próprios dados financeiros" 
ON public.financeiro FOR SELECT 
USING (auth.uid() = user_id AND deletado = false);

CREATE POLICY "Usuários podem criar seus próprios dados financeiros" 
ON public.financeiro FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seus próprios dados financeiros" 
ON public.financeiro FOR UPDATE 
USING (auth.uid() = user_id);

-- Políticas para exclusões pendentes
CREATE POLICY "Usuários podem ver suas próprias solicitações de exclusão" 
ON public.exclusoes_pendentes FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar solicitações de exclusão" 
ON public.exclusoes_pendentes FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Super admins podem ver todas as exclusões pendentes" 
ON public.exclusoes_pendentes FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role = 'super_admin'
  )
);

CREATE POLICY "Super admins podem atualizar exclusões pendentes" 
ON public.exclusoes_pendentes FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role = 'super_admin'
  )
);

-- Criar triggers para atualizar timestamps
CREATE TRIGGER update_clientes_updated_at
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_processos_updated_at
  BEFORE UPDATE ON public.processos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_audiencias_updated_at
  BEFORE UPDATE ON public.audiencias
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_prazos_updated_at
  BEFORE UPDATE ON public.prazos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tarefas_updated_at
  BEFORE UPDATE ON public.tarefas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_atendimentos_updated_at
  BEFORE UPDATE ON public.atendimentos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_metas_updated_at
  BEFORE UPDATE ON public.metas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_financeiro_updated_at
  BEFORE UPDATE ON public.financeiro
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para melhor performance
CREATE INDEX idx_clientes_user_id ON public.clientes(user_id);
CREATE INDEX idx_clientes_deletado ON public.clientes(deletado);
CREATE INDEX idx_processos_user_id ON public.processos(user_id);
CREATE INDEX idx_processos_deletado ON public.processos(deletado);
CREATE INDEX idx_audiencias_user_id ON public.audiencias(user_id);
CREATE INDEX idx_audiencias_deletado ON public.audiencias(deletado);
CREATE INDEX idx_prazos_user_id ON public.prazos(user_id);
CREATE INDEX idx_prazos_deletado ON public.prazos(deletado);
CREATE INDEX idx_tarefas_user_id ON public.tarefas(user_id);
CREATE INDEX idx_tarefas_deletado ON public.tarefas(deletado);
CREATE INDEX idx_atendimentos_user_id ON public.atendimentos(user_id);
CREATE INDEX idx_atendimentos_deletado ON public.atendimentos(deletado);
CREATE INDEX idx_metas_user_id ON public.metas(user_id);
CREATE INDEX idx_metas_deletado ON public.metas(deletado);
CREATE INDEX idx_financeiro_user_id ON public.financeiro(user_id);
CREATE INDEX idx_financeiro_deletado ON public.financeiro(deletado);

-- ============================================================
-- MIGRATION: 20250711181606-c85df7cd-47a8-4d7b-8560-d663a61767da.sql
-- ============================================================
-- Criar enum para tipos de planos de assinatura
CREATE TYPE subscription_plan AS ENUM ('free', 'basic', 'professional', 'enterprise');

-- Criar enum para status de assinatura
CREATE TYPE subscription_status AS ENUM ('active', 'inactive', 'suspended', 'cancelled');

-- Criar enum para status de convites
CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'expired');

-- Tabela de escritórios/organizações
CREATE TABLE public.offices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  logo_url TEXT,
  plan subscription_plan NOT NULL DEFAULT 'free',
  max_users INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  active BOOLEAN NOT NULL DEFAULT true
);

-- Tabela de assinaturas
CREATE TABLE public.subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  plan subscription_plan NOT NULL,
  status subscription_status NOT NULL DEFAULT 'active',
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  price NUMERIC(10,2),
  billing_cycle TEXT DEFAULT 'monthly',
  stripe_subscription_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de relação usuário-escritório com roles específicos
CREATE TABLE public.office_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  invited_by UUID REFERENCES auth.users(id),
  active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(office_id, user_id)
);

-- Tabela de convites
CREATE TABLE public.invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  token UUID NOT NULL DEFAULT gen_random_uuid(),
  status invitation_status NOT NULL DEFAULT 'pending',
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Adicionar office_id à tabela profiles existente
ALTER TABLE public.profiles 
ADD COLUMN office_id UUID REFERENCES public.offices(id);

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.offices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para offices
CREATE POLICY "Super admins podem ver todos os escritórios" 
ON public.offices 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'super_admin'
));

CREATE POLICY "Office admins podem ver seu próprio escritório" 
ON public.offices 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.office_users 
  WHERE office_users.office_id = offices.id 
  AND office_users.user_id = auth.uid() 
  AND office_users.role IN ('admin', 'super_admin')
));

CREATE POLICY "Super admins podem criar escritórios" 
ON public.offices 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'super_admin'
));

CREATE POLICY "Super admins podem atualizar escritórios" 
ON public.offices 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'super_admin'
));

-- Políticas RLS para subscriptions
CREATE POLICY "Super admins podem ver todas as assinaturas" 
ON public.subscriptions 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'super_admin'
));

CREATE POLICY "Office admins podem ver assinaturas do seu escritório" 
ON public.subscriptions 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.office_users 
  WHERE office_users.office_id = subscriptions.office_id 
  AND office_users.user_id = auth.uid() 
  AND office_users.role IN ('admin', 'super_admin')
));

CREATE POLICY "Super admins podem gerenciar assinaturas" 
ON public.subscriptions 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'super_admin'
));

-- Políticas RLS para office_users
CREATE POLICY "Usuários podem ver membros do seu escritório" 
ON public.office_users 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.office_users ou 
  WHERE ou.office_id = office_users.office_id 
  AND ou.user_id = auth.uid()
) OR EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'super_admin'
));

CREATE POLICY "Office admins podem gerenciar usuários do escritório" 
ON public.office_users 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.office_users 
  WHERE office_users.office_id = office_users.office_id 
  AND office_users.user_id = auth.uid() 
  AND office_users.role IN ('admin', 'super_admin')
) OR EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'super_admin'
));

-- Políticas RLS para invitations
CREATE POLICY "Office admins podem ver convites do escritório" 
ON public.invitations 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.office_users 
  WHERE office_users.office_id = invitations.office_id 
  AND office_users.user_id = auth.uid() 
  AND office_users.role IN ('admin', 'super_admin')
) OR EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'super_admin'
));

CREATE POLICY "Office admins podem criar convites" 
ON public.invitations 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.office_users 
  WHERE office_users.office_id = invitations.office_id 
  AND office_users.user_id = auth.uid() 
  AND office_users.role IN ('admin', 'super_admin')
) OR EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'super_admin'
));

CREATE POLICY "Office admins podem atualizar convites do escritório" 
ON public.invitations 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.office_users 
  WHERE office_users.office_id = invitations.office_id 
  AND office_users.user_id = auth.uid() 
  AND office_users.role IN ('admin', 'super_admin')
) OR EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'super_admin'
));

-- Triggers para updated_at
CREATE TRIGGER update_offices_updated_at
BEFORE UPDATE ON public.offices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_offices_created_by ON public.offices(created_by);
CREATE INDEX idx_subscriptions_office_id ON public.subscriptions(office_id);
CREATE INDEX idx_office_users_office_id ON public.office_users(office_id);
CREATE INDEX idx_office_users_user_id ON public.office_users(user_id);
CREATE INDEX idx_invitations_office_id ON public.invitations(office_id);
CREATE INDEX idx_invitations_email ON public.invitations(email);
CREATE INDEX idx_invitations_token ON public.invitations(token);
CREATE INDEX idx_profiles_office_id ON public.profiles(office_id);

-- ============================================================
-- MIGRATION: 20250711183354-cbe4534b-2c5a-4c1c-8f4d-145b77da6677.sql
-- ============================================================
-- Adicionar 'admin' ao enum app_role existente
ALTER TYPE app_role ADD VALUE 'admin';

-- Criar enum para tipos de planos de assinatura
CREATE TYPE subscription_plan AS ENUM ('free', 'basic', 'professional', 'enterprise');

-- Criar enum para status de assinatura
CREATE TYPE subscription_status AS ENUM ('active', 'inactive', 'suspended', 'cancelled');

-- Criar enum para status de convites
CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'expired');

-- Tabela de escritórios/organizações
CREATE TABLE public.offices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  logo_url TEXT,
  plan subscription_plan NOT NULL DEFAULT 'free',
  max_users INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  active BOOLEAN NOT NULL DEFAULT true
);

-- Tabela de assinaturas
CREATE TABLE public.subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  plan subscription_plan NOT NULL,
  status subscription_status NOT NULL DEFAULT 'active',
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  price NUMERIC(10,2),
  billing_cycle TEXT DEFAULT 'monthly',
  stripe_subscription_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de relação usuário-escritório com roles específicos
CREATE TABLE public.office_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  invited_by UUID REFERENCES auth.users(id),
  active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(office_id, user_id)
);

-- Tabela de convites
CREATE TABLE public.invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  token UUID NOT NULL DEFAULT gen_random_uuid(),
  status invitation_status NOT NULL DEFAULT 'pending',
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Adicionar office_id à tabela profiles existente
ALTER TABLE public.profiles 
ADD COLUMN office_id UUID REFERENCES public.offices(id);

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.offices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para offices
CREATE POLICY "Super admins podem ver todos os escritórios" 
ON public.offices 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'super_admin'
));

CREATE POLICY "Office admins podem ver seu próprio escritório" 
ON public.offices 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.office_users 
  WHERE office_users.office_id = offices.id 
  AND office_users.user_id = auth.uid() 
  AND office_users.role IN ('admin', 'super_admin')
));

CREATE POLICY "Super admins podem criar escritórios" 
ON public.offices 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'super_admin'
));

CREATE POLICY "Super admins podem atualizar escritórios" 
ON public.offices 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'super_admin'
));

-- Políticas RLS para subscriptions
CREATE POLICY "Super admins podem ver todas as assinaturas" 
ON public.subscriptions 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'super_admin'
));

CREATE POLICY "Office admins podem ver assinaturas do seu escritório" 
ON public.subscriptions 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.office_users 
  WHERE office_users.office_id = subscriptions.office_id 
  AND office_users.user_id = auth.uid() 
  AND office_users.role IN ('admin', 'super_admin')
));

CREATE POLICY "Super admins podem gerenciar assinaturas" 
ON public.subscriptions 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'super_admin'
));

-- Políticas RLS para office_users
CREATE POLICY "Usuários podem ver membros do seu escritório" 
ON public.office_users 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.office_users ou 
  WHERE ou.office_id = office_users.office_id 
  AND ou.user_id = auth.uid()
) OR EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'super_admin'
));

CREATE POLICY "Office admins podem gerenciar usuários do escritório" 
ON public.office_users 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.office_users 
  WHERE office_users.office_id = office_users.office_id 
  AND office_users.user_id = auth.uid() 
  AND office_users.role IN ('admin', 'super_admin')
) OR EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'super_admin'
));

-- Políticas RLS para invitations
CREATE POLICY "Office admins podem ver convites do escritório" 
ON public.invitations 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.office_users 
  WHERE office_users.office_id = invitations.office_id 
  AND office_users.user_id = auth.uid() 
  AND office_users.role IN ('admin', 'super_admin')
) OR EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'super_admin'
));

CREATE POLICY "Office admins podem criar convites" 
ON public.invitations 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.office_users 
  WHERE office_users.office_id = invitations.office_id 
  AND office_users.user_id = auth.uid() 
  AND office_users.role IN ('admin', 'super_admin')
) OR EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'super_admin'
));

CREATE POLICY "Office admins podem atualizar convites do escritório" 
ON public.invitations 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.office_users 
  WHERE office_users.office_id = invitations.office_id 
  AND office_users.user_id = auth.uid() 
  AND office_users.role IN ('admin', 'super_admin')
) OR EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'super_admin'
));

-- Triggers para updated_at
CREATE TRIGGER update_offices_updated_at
BEFORE UPDATE ON public.offices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_offices_created_by ON public.offices(created_by);
CREATE INDEX idx_subscriptions_office_id ON public.subscriptions(office_id);
CREATE INDEX idx_office_users_office_id ON public.office_users(office_id);
CREATE INDEX idx_office_users_user_id ON public.office_users(user_id);
CREATE INDEX idx_invitations_office_id ON public.invitations(office_id);
CREATE INDEX idx_invitations_email ON public.invitations(email);
CREATE INDEX idx_invitations_token ON public.invitations(token);
CREATE INDEX idx_profiles_office_id ON public.profiles(office_id);

-- ============================================================
-- MIGRATION: 20250711183417-e1842868-1c03-4f1d-8698-3647b26078c3.sql
-- ============================================================
-- Adicionar 'admin' ao enum app_role existente
ALTER TYPE app_role ADD VALUE 'admin';

-- ============================================================
-- MIGRATION: 20250711183516-5bb1a114-ab17-4b35-b9c0-2682cc8a78ca.sql
-- ============================================================
-- Criar enum para tipos de planos de assinatura
CREATE TYPE subscription_plan AS ENUM ('free', 'basic', 'professional', 'enterprise');

-- Criar enum para status de assinatura
CREATE TYPE subscription_status AS ENUM ('active', 'inactive', 'suspended', 'cancelled');

-- Criar enum para status de convites
CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'expired');

-- Tabela de escritórios/organizações
CREATE TABLE public.offices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  logo_url TEXT,
  plan subscription_plan NOT NULL DEFAULT 'free',
  max_users INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  active BOOLEAN NOT NULL DEFAULT true
);

-- Tabela de assinaturas
CREATE TABLE public.subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  plan subscription_plan NOT NULL,
  status subscription_status NOT NULL DEFAULT 'active',
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  price NUMERIC(10,2),
  billing_cycle TEXT DEFAULT 'monthly',
  stripe_subscription_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de relação usuário-escritório com roles específicos
CREATE TABLE public.office_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  invited_by UUID REFERENCES auth.users(id),
  active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(office_id, user_id)
);

-- Tabela de convites
CREATE TABLE public.invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  office_id UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  token UUID NOT NULL DEFAULT gen_random_uuid(),
  status invitation_status NOT NULL DEFAULT 'pending',
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Adicionar office_id à tabela profiles existente
ALTER TABLE public.profiles 
ADD COLUMN office_id UUID REFERENCES public.offices(id);

-- Triggers para updated_at
CREATE TRIGGER update_offices_updated_at
BEFORE UPDATE ON public.offices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_offices_created_by ON public.offices(created_by);
CREATE INDEX idx_subscriptions_office_id ON public.subscriptions(office_id);
CREATE INDEX idx_office_users_office_id ON public.office_users(office_id);
CREATE INDEX idx_office_users_user_id ON public.office_users(user_id);
CREATE INDEX idx_invitations_office_id ON public.invitations(office_id);
CREATE INDEX idx_invitations_email ON public.invitations(email);
CREATE INDEX idx_invitations_token ON public.invitations(token);
CREATE INDEX idx_profiles_office_id ON public.profiles(office_id);

-- ============================================================
-- MIGRATION: 20250711183608-39c34383-3cc5-4ea8-909a-7dce00c368cd.sql
-- ============================================================
-- Habilitar RLS em todas as tabelas
ALTER TABLE public.offices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para offices
CREATE POLICY "Super admins podem ver todos os escritórios" 
ON public.offices 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'super_admin'
));

CREATE POLICY "Office admins podem ver seu próprio escritório" 
ON public.offices 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.office_users 
  WHERE office_users.office_id = offices.id 
  AND office_users.user_id = auth.uid() 
  AND office_users.role IN ('admin', 'super_admin')
));

CREATE POLICY "Super admins podem criar escritórios" 
ON public.offices 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'super_admin'
));

CREATE POLICY "Super admins podem atualizar escritórios" 
ON public.offices 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'super_admin'
));

-- Políticas RLS para subscriptions
CREATE POLICY "Super admins podem ver todas as assinaturas" 
ON public.subscriptions 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'super_admin'
));

CREATE POLICY "Office admins podem ver assinaturas do seu escritório" 
ON public.subscriptions 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.office_users 
  WHERE office_users.office_id = subscriptions.office_id 
  AND office_users.user_id = auth.uid() 
  AND office_users.role IN ('admin', 'super_admin')
));

CREATE POLICY "Super admins podem gerenciar assinaturas" 
ON public.subscriptions 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'super_admin'
));

-- Políticas RLS para office_users
CREATE POLICY "Usuários podem ver membros do seu escritório" 
ON public.office_users 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.office_users ou 
  WHERE ou.office_id = office_users.office_id 
  AND ou.user_id = auth.uid()
) OR EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'super_admin'
));

CREATE POLICY "Office admins podem gerenciar usuários do escritório" 
ON public.office_users 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.office_users existing_user
  WHERE existing_user.office_id = office_users.office_id 
  AND existing_user.user_id = auth.uid() 
  AND existing_user.role IN ('admin', 'super_admin')
) OR EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'super_admin'
));

-- Políticas RLS para invitations
CREATE POLICY "Office admins podem ver convites do escritório" 
ON public.invitations 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.office_users 
  WHERE office_users.office_id = invitations.office_id 
  AND office_users.user_id = auth.uid() 
  AND office_users.role IN ('admin', 'super_admin')
) OR EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'super_admin'
));

CREATE POLICY "Office admins podem criar convites" 
ON public.invitations 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.office_users 
  WHERE office_users.office_id = invitations.office_id 
  AND office_users.user_id = auth.uid() 
  AND office_users.role IN ('admin', 'super_admin')
) OR EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'super_admin'
));

CREATE POLICY "Office admins podem atualizar convites do escritório" 
ON public.invitations 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.office_users 
  WHERE office_users.office_id = invitations.office_id 
  AND office_users.user_id = auth.uid() 
  AND office_users.role IN ('admin', 'super_admin')
) OR EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'super_admin'
));

-- ============================================================
-- MIGRATION: 20250711203932-7179de67-e8e2-4313-89eb-04596c02c4d9.sql
-- ============================================================

-- Recriar o trigger para criação automática de perfil (caso não exista)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Recriar a função handle_new_user se necessário
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    NEW.email,
    CASE 
      WHEN NEW.email = 'contato@vextriahub.com.br' THEN 'super_admin'::app_role
      ELSE 'user'::app_role
    END
  );
  RETURN NEW;
END;
$$;

-- Recriar o trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- MIGRATION: 20250722025235-cc65bb42-69b5-4ca8-946b-0e3657d5fafb.sql
-- ============================================================

-- Primeiro, vamos inserir um escritório principal se não existir
INSERT INTO public.offices (name, email, phone, address, plan, max_users, created_by)
SELECT 
  'VextriaHub - Escritório Principal',
  'contato@vextriahub.com.br',
  '(11) 99999-9999',
  'São Paulo, SP',
  'professional'::subscription_plan,
  50,
  (SELECT id FROM auth.users WHERE email = 'contato@vextriahub.com.br' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM public.offices LIMIT 1);

-- Associar o super admin ao escritório principal
INSERT INTO public.office_users (office_id, user_id, role, invited_by)
SELECT 
  o.id,
  p.user_id,
  'super_admin'::app_role,
  p.user_id
FROM public.offices o
CROSS JOIN public.profiles p
WHERE p.role = 'super_admin'::app_role
AND NOT EXISTS (
  SELECT 1 FROM public.office_users ou 
  WHERE ou.office_id = o.id AND ou.user_id = p.user_id
);

-- Atualizar o office_id no perfil do super admin
UPDATE public.profiles 
SET office_id = (SELECT id FROM public.offices LIMIT 1)
WHERE role = 'super_admin'::app_role AND office_id IS NULL;

-- Criar uma assinatura ativa para o escritório principal
INSERT INTO public.subscriptions (office_id, plan, status, start_date, price)
SELECT 
  o.id,
  'professional'::subscription_plan,
  'active'::subscription_status,
  CURRENT_DATE,
  99.90
FROM public.offices o
WHERE NOT EXISTS (SELECT 1 FROM public.subscriptions WHERE office_id = o.id);

-- Corrigir funções com search_path adequado
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    NEW.email,
    CASE 
      WHEN NEW.email = 'contato@vextriahub.com.br' THEN 'super_admin'::app_role
      ELSE 'user'::app_role
    END
  );
  RETURN NEW;
END;
$$;

-- Atualizar função de timestamp com search_path correto
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Adicionar alguns dados de exemplo para demonstração
-- Clientes de exemplo
INSERT INTO public.clientes (user_id, nome, email, telefone, cpf_cnpj, tipo_pessoa, endereco, origem, status)
SELECT 
  p.user_id,
  'João Silva Santos',
  'joao.silva@email.com',
  '(11) 99999-1234',
  '123.456.789-00',
  'fisica',
  'Rua das Flores, 123 - São Paulo, SP',
  'Indicação',
  'ativo'
FROM public.profiles p
WHERE p.role = 'super_admin'::app_role
AND NOT EXISTS (SELECT 1 FROM public.clientes WHERE nome = 'João Silva Santos');

INSERT INTO public.clientes (user_id, nome, email, telefone, cpf_cnpj, tipo_pessoa, endereco, origem, status)
SELECT 
  p.user_id,
  'Maria Oliveira Ltda',
  'contato@mariaoliveira.com.br',
  '(11) 88888-5678',
  '12.345.678/0001-90',
  'juridica',
  'Av. Paulista, 1000 - São Paulo, SP',
  'Site',
  'ativo'
FROM public.profiles p
WHERE p.role = 'super_admin'::app_role
AND NOT EXISTS (SELECT 1 FROM public.clientes WHERE nome = 'Maria Oliveira Ltda');

-- Processos de exemplo
INSERT INTO public.processos (user_id, numero_processo, titulo, cliente_id, status, tipo_processo, valor_causa, tribunal, comarca, vara)
SELECT 
  p.user_id,
  '0001234-56.2025.8.26.0100',
  'Ação de Cobrança - João Silva Santos',
  c.id,
  'ativo',
  'Cível',
  50000.00,
  'TJSP',
  'São Paulo',
  '1ª Vara Cível'
FROM public.profiles p
CROSS JOIN public.clientes c
WHERE p.role = 'super_admin'::app_role
AND c.nome = 'João Silva Santos'
AND NOT EXISTS (SELECT 1 FROM public.processos WHERE numero_processo = '0001234-56.2025.8.26.0100');

-- Tarefas de exemplo
INSERT INTO public.tarefas (user_id, titulo, descricao, status, prioridade, data_vencimento, cliente_id)
SELECT 
  p.user_id,
  'Elaborar petição inicial',
  'Preparar petição inicial para ação de cobrança',
  'pendente',
  'alta',
  CURRENT_DATE + INTERVAL '3 days',
  c.id
FROM public.profiles p
CROSS JOIN public.clientes c
WHERE p.role = 'super_admin'::app_role
AND c.nome = 'João Silva Santos'
AND NOT EXISTS (SELECT 1 FROM public.tarefas WHERE titulo = 'Elaborar petição inicial');

-- Prazos de exemplo
INSERT INTO public.prazos (user_id, titulo, descricao, data_vencimento, prioridade, status)
SELECT 
  p.user_id,
  'Prazo para contestação',
  'Prazo de 15 dias para apresentar contestação',
  CURRENT_DATE + INTERVAL '10 days',
  'alta',
  'pendente'
FROM public.profiles p
WHERE p.role = 'super_admin'::app_role
AND NOT EXISTS (SELECT 1 FROM public.prazos WHERE titulo = 'Prazo para contestação');

-- Audiências de exemplo
INSERT INTO public.audiencias (user_id, titulo, data_audiencia, tipo, local, status, cliente_id)
SELECT 
  p.user_id,
  'Audiência de Conciliação',
  CURRENT_DATE + INTERVAL '20 days' + TIME '14:00',
  'Conciliação',
  'Fórum Central - Sala 15',
  'agendada',
  c.id
FROM public.profiles p
CROSS JOIN public.clientes c
WHERE p.role = 'super_admin'::app_role
AND c.nome = 'João Silva Santos'
AND NOT EXISTS (SELECT 1 FROM public.audiencias WHERE titulo = 'Audiência de Conciliação');

-- Dados financeiros de exemplo
INSERT INTO public.financeiro (user_id, descricao, tipo, valor, data_vencimento, categoria, status, cliente_id)
SELECT 
  p.user_id,
  'Honorários advocatícios - João Silva',
  'receita',
  2500.00,
  CURRENT_DATE + INTERVAL '30 days',
  'Honorários',
  'pendente',
  c.id
FROM public.profiles p
CROSS JOIN public.clientes c
WHERE p.role = 'super_admin'::app_role
AND c.nome = 'João Silva Santos'
AND NOT EXISTS (SELECT 1 FROM public.financeiro WHERE descricao = 'Honorários advocatícios - João Silva');

-- Metas de exemplo
INSERT INTO public.metas (user_id, titulo, tipo, periodo, data_inicio, data_fim, valor_meta, valor_atual, status)
SELECT 
  p.user_id,
  'Meta de Receita Mensal',
  'receita',
  'mensal',
  DATE_TRUNC('month', CURRENT_DATE),
  DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day',
  15000.00,
  2500.00,
  'ativa'
FROM public.profiles p
WHERE p.role = 'super_admin'::app_role
AND NOT EXISTS (SELECT 1 FROM public.metas WHERE titulo = 'Meta de Receita Mensal');


-- ============================================================
-- MIGRATION: 20250729174314-5b69dc97-8a75-4133-858a-9bdc8ba01be8.sql
-- ============================================================
-- Atualizar tabela plan_configs para corresponder aos planos da landing
-- Deletar planos existentes e inserir os corretos
DELETE FROM plan_configs;

-- Inserir planos corretos da landing page
INSERT INTO plan_configs (plan_name, plan_type, price_cents, features, trial_days, is_active) VALUES
('Básico', 'BASIC', 4700, 
 '["Painel de processos", "Gestão de prazos", "Cadastro de clientes", "Suporte padrão", "1 usuário", "até 30 processos"]'::jsonb, 
 7, true),
('Intermediário', 'INTERMEDIATE', 9700, 
 '["Tudo do Básico", "Múltiplos usuários", "Relatórios básicos", "Suporte padrão", "até 3 usuários", "até 100 processos"]'::jsonb, 
 7, true),
('Avançado', 'ADVANCED', 19700, 
 '["Tudo do Intermediário", "Módulo financeiro completo", "Relatórios avançados", "Suporte prioritário", "até 5 usuários", "até 300 processos"]'::jsonb, 
 7, true),
('Premium', 'PREMIUM', 39700, 
 '["Tudo do Avançado", "Módulo de metas", "IA (quando ativada)", "Suporte VIP dedicado", "até 10 usuários", "processos ilimitados"]'::jsonb, 
 7, true);

-- ============================================================
-- MIGRATION: 20250729174520-1a938528-5e91-4d2e-baea-4e1416dec9c7.sql
-- ============================================================
-- Atualizar tabela plan_configs para corresponder aos planos da landing
-- Deletar planos existentes e inserir os corretos
DELETE FROM plan_configs;

-- Inserir planos corretos da landing page com tipos válidos
INSERT INTO plan_configs (plan_name, plan_type, price_cents, features, trial_days, is_active) VALUES
('Básico', 'BASIC', 4700, 
 '["Painel de processos", "Gestão de prazos", "Cadastro de clientes", "Suporte padrão", "1 usuário", "até 30 processos"]'::jsonb, 
 7, true),
('Intermediário', 'PRO', 9700, 
 '["Tudo do Básico", "Múltiplos usuários", "Relatórios básicos", "Suporte padrão", "até 3 usuários", "até 100 processos"]'::jsonb, 
 7, true),
('Avançado', 'ENTERPRISE', 19700, 
 '["Tudo do Intermediário", "Módulo financeiro completo", "Relatórios avançados", "Suporte prioritário", "até 5 usuários", "até 300 processos"]'::jsonb, 
 7, true),
('Premium', 'ENTERPRISE', 39700, 
 '["Tudo do Avançado", "Módulo de metas", "IA (quando ativada)", "Suporte VIP dedicado", "até 10 usuários", "processos ilimitados"]'::jsonb, 
 7, true);

-- ============================================================
-- MIGRATION: 20250729174623-19691aa3-f62c-465e-8021-4482e2cd58f8.sql
-- ============================================================
-- Habilitar RLS na tabela plan_configs
ALTER TABLE plan_configs ENABLE ROW LEVEL SECURITY;

-- Criar políticas para plan_configs (leitura pública, modificação apenas por super admins)
CREATE POLICY "Anyone can view active plans" 
ON plan_configs 
FOR SELECT 
USING (is_active = true);

CREATE POLICY "Only super admins can manage plans" 
ON plan_configs 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'super_admin'::app_role
));

-- ============================================================
-- MIGRATION: 20250729230409-14c77e13-7fea-4598-b93e-f65641c6069a.sql
-- ============================================================
-- Criar tabela de subscribers para rastrear assinaturas do Stripe
CREATE TABLE public.subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  stripe_customer_id TEXT,
  subscribed BOOLEAN NOT NULL DEFAULT false,
  subscription_tier TEXT,
  subscription_end TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar Row Level Security
ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY;

-- Política para usuários verem suas próprias assinaturas
CREATE POLICY "select_own_subscription" ON public.subscribers
FOR SELECT
USING (user_id = auth.uid() OR email = auth.email());

-- Política para edge functions atualizarem assinaturas
CREATE POLICY "update_own_subscription" ON public.subscribers
FOR UPDATE
USING (true);

-- Política para edge functions inserirem assinaturas
CREATE POLICY "insert_subscription" ON public.subscribers
FOR INSERT
WITH CHECK (true);

-- Adicionar campos do Stripe na tabela subscriptions existente
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS access_status TEXT DEFAULT 'trial';

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.update_subscribers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para updated_at na tabela subscribers
CREATE TRIGGER update_subscribers_updated_at
  BEFORE UPDATE ON public.subscribers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_subscribers_updated_at();

-- ============================================================
-- MIGRATION: 20251219000000-add-stripe-customer-id.sql
-- ============================================================
-- Adicionar campo stripe_customer_id à tabela profiles para integração com Stripe
-- Data: 19/01/2025
-- Descrição: Campo para armazenar o ID do cliente no sistema Stripe para controle de pagamentos

-- Adicionar coluna stripe_customer_id à tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Adicionar comentário para documentação
COMMENT ON COLUMN public.profiles.stripe_customer_id IS 'ID do cliente no sistema Stripe para controle de pagamentos e cobranças';

-- Criar índice para otimizar consultas por stripe_customer_id
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id 
ON public.profiles(stripe_customer_id) 
WHERE stripe_customer_id IS NOT NULL;

-- Adicionar constraint para garantir que stripe_customer_id seja único quando não for null
ALTER TABLE public.profiles 
ADD CONSTRAINT unique_stripe_customer_id 
UNIQUE (stripe_customer_id);

-- ============================================================
-- MIGRATION: 20251222000000-create-subscription-tables.sql
-- ============================================================
-- Criação das tabelas para controle de assinaturas e integração Stripe
-- Data: 22/01/2025
-- Descrição: Tabelas para gerenciar pagamentos, status de acesso e logs de auditoria

-- Tabela principal para controle de assinaturas e pagamentos
CREATE TABLE subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  office_id UUID REFERENCES offices(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  stripe_payment_intent_id TEXT,
  payment_status TEXT CHECK (payment_status IN ('paid', 'pending', 'overdue', 'canceled', 'unknown')) DEFAULT 'unknown',
  access_status TEXT CHECK (access_status IN ('active', 'suspended', 'blocked')) DEFAULT 'active',
  plan_type TEXT CHECK (plan_type IN ('basic', 'premium', 'enterprise')) DEFAULT 'basic',
  monthly_fee DECIMAL(10,2) DEFAULT 0.00,
  due_date DATE,
  paid_date DATE,
  days_overdue INTEGER DEFAULT 0,
  manual_override BOOLEAN DEFAULT FALSE,
  override_reason TEXT,
  override_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela para logs de auditoria de todas as ações
CREATE TABLE payment_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_payment_id UUID REFERENCES subscription_payments(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL, -- 'webhook_received', 'manual_override', 'status_change', 'payment_confirmed', etc.
  old_status TEXT,
  new_status TEXT,
  old_access_status TEXT,
  new_access_status TEXT,
  stripe_event_data JSONB,
  manual_reason TEXT,
  performed_by UUID REFERENCES profiles(id), -- NULL para webhooks automáticos
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_subscription_payments_user_id ON subscription_payments(user_id);
CREATE INDEX idx_subscription_payments_office_id ON subscription_payments(office_id);
CREATE INDEX idx_subscription_payments_stripe_customer_id ON subscription_payments(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX idx_subscription_payments_payment_status ON subscription_payments(payment_status);
CREATE INDEX idx_subscription_payments_access_status ON subscription_payments(access_status);
CREATE INDEX idx_subscription_payments_due_date ON subscription_payments(due_date);
CREATE INDEX idx_payment_logs_subscription_id ON payment_logs(subscription_payment_id);
CREATE INDEX idx_payment_logs_action_type ON payment_logs(action_type);
CREATE INDEX idx_payment_logs_created_at ON payment_logs(created_at DESC);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para atualizar updated_at na tabela subscription_payments
CREATE TRIGGER update_subscription_payments_updated_at 
    BEFORE UPDATE ON subscription_payments 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security) para subscription_payments
ALTER TABLE subscription_payments ENABLE ROW LEVEL SECURITY;

-- Policy: Super admins podem ver tudo
CREATE POLICY "Super admins can manage all subscription payments" ON subscription_payments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'super_admin'
        )
    );

-- Policy: Usuários podem ver apenas suas próprias assinaturas
CREATE POLICY "Users can view own subscription payments" ON subscription_payments
    FOR SELECT USING (user_id = auth.uid());

-- RLS para payment_logs
ALTER TABLE payment_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Super admins podem ver todos os logs
CREATE POLICY "Super admins can view all payment logs" ON payment_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'super_admin'
        )
    );

-- Inserir registros iniciais para usuários existentes (se houver)
INSERT INTO subscription_payments (user_id, office_id, plan_type, monthly_fee, due_date, payment_status, access_status)
SELECT 
    p.id as user_id,
    ou.office_id,
    'basic' as plan_type,
    29.90 as monthly_fee,
    CURRENT_DATE + INTERVAL '7 days' as due_date,
    'pending' as payment_status,
    'active' as access_status
FROM profiles p
JOIN office_users ou ON p.id = ou.user_id
WHERE p.role != 'super_admin'
ON CONFLICT DO NOTHING;

-- Comentários para documentação
COMMENT ON TABLE subscription_payments IS 'Tabela principal para controle de assinaturas, pagamentos e status de acesso dos usuários';
COMMENT ON TABLE payment_logs IS 'Tabela de auditoria para registrar todas as alterações de status e ações relacionadas a pagamentos';
COMMENT ON COLUMN subscription_payments.stripe_customer_id IS 'ID do cliente no sistema Stripe para integração de pagamentos';
COMMENT ON COLUMN subscription_payments.stripe_subscription_id IS 'ID da assinatura no sistema Stripe';
COMMENT ON COLUMN subscription_payments.stripe_payment_intent_id IS 'ID do pagamento específico no sistema Stripe';
COMMENT ON COLUMN subscription_payments.manual_override IS 'Indica se o status foi alterado manualmente pelo super admin';
COMMENT ON COLUMN payment_logs.stripe_event_data IS 'Dados JSON completos recebidos do webhook do Stripe';

-- ============================================================
-- MIGRATION: 20251223000000-update-trial-period.sql
-- ============================================================
-- Atualização do período de trial de 30 para 7 dias
-- Data: 23/01/2025
-- Descrição: Reduz o período de teste gratuito para 7 dias

-- Atualizar registros existentes que ainda estão no período de trial
UPDATE subscription_payments 
SET due_date = CURRENT_DATE + INTERVAL '7 days'
WHERE payment_status = 'pending' 
AND access_status = 'active'
AND due_date > CURRENT_DATE + INTERVAL '7 days';

-- Comentário para documentação
COMMENT ON COLUMN subscription_payments.due_date IS 'Data de vencimento da assinatura - período de trial de 7 dias para novos usuários';

-- ============================================================
-- MIGRATION: 20260417000000_create_notifications.sql
-- ============================================================

-- Criar tabela de notificações
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('info', 'success', 'warning', 'error')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN DEFAULT FALSE,
    action_url TEXT,
    action_label TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Política: Usuários só veem suas próprias notificações
CREATE POLICY "Users can view their own notifications" ON public.notifications
    FOR SELECT USING (auth.uid() = user_id);

-- Política: Usuários podem marcar suas notificações como lidas (update)
CREATE POLICY "Users can update their own notifications" ON public.notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- Política: Sistema pode inserir notificações (para simplificar, permitindo insert autenticado por enquanto)
CREATE POLICY "Enable insert for authenticated users only" ON public.notifications
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Índice para busca rápida de notificações não lidas
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id) WHERE (read = false);


-- ============================================================
-- MIGRATION: 20260417000001_fix_multi_tenancy.sql
-- ============================================================

-- Migração: Adicionar office_id às tabelas core e corrigir RLS para multi-tenancy

-- 1. Adicionar coluna office_id às tabelas que faltam
DO $$ 
BEGIN 
    -- Tabela: clientes
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clientes' AND column_name='office_id') THEN
        ALTER TABLE public.clientes ADD COLUMN office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE;
    END IF;

    -- Tabela: processos
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='processos' AND column_name='office_id') THEN
        ALTER TABLE public.processos ADD COLUMN office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE;
    END IF;

    -- Tabela: audiencias
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audiencias' AND column_name='office_id') THEN
        ALTER TABLE public.audiencias ADD COLUMN office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE;
    END IF;

    -- Tabela: prazos
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='prazos' AND column_name='office_id') THEN
        ALTER TABLE public.prazos ADD COLUMN office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE;
    END IF;

    -- Tabela: tarefas
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tarefas' AND column_name='office_id') THEN
        ALTER TABLE public.tarefas ADD COLUMN office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE;
    END IF;

    -- Tabela: atendimentos
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='atendimentos' AND column_name='office_id') THEN
        ALTER TABLE public.atendimentos ADD COLUMN office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE;
    END IF;

    -- Tabela: metas
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='metas' AND column_name='office_id') THEN
        ALTER TABLE public.metas ADD COLUMN office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE;
    END IF;

    -- Tabela: financeiro
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='financeiro' AND column_name='office_id') THEN
        ALTER TABLE public.financeiro ADD COLUMN office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 2. Atualizar RLS para usar office_id
-- Removemos as políticas antigas baseadas apenas em user_id (opcional, mas recomendado para clareza)
DROP POLICY IF EXISTS "Usuários podem ver seus próprios clientes" ON public.clientes;
DROP POLICY IF EXISTS "Usuários podem ver seus próprios processos" ON public.processos;
DROP POLICY IF EXISTS "Usuários podem ver suas próprias audiências" ON public.audiencias;
DROP POLICY IF EXISTS "Usuários podem ver seus próprios prazos" ON public.prazos;

-- Novas políticas baseadas em office_id
-- SELECT: Ver dados do escritório se for membro ativo
CREATE POLICY "Membros do escritório podem ver clientes" ON public.clientes
    FOR SELECT USING (EXISTS (SELECT 1 FROM office_users WHERE office_id = public.clientes.office_id AND user_id = auth.uid() AND active = true));

CREATE POLICY "Membros do escritório podem ver processos" ON public.processos
    FOR SELECT USING (EXISTS (SELECT 1 FROM office_users WHERE office_id = public.processos.office_id AND user_id = auth.uid() AND active = true));

CREATE POLICY "Membros do escritório podem ver audiencias" ON public.audiencias
    FOR SELECT USING (EXISTS (SELECT 1 FROM office_users WHERE office_id = public.audiencias.office_id AND user_id = auth.uid() AND active = true));

CREATE POLICY "Membros do escritório podem ver prazos" ON public.prazos
    FOR SELECT USING (EXISTS (SELECT 1 FROM office_users WHERE office_id = public.prazos.office_id AND user_id = auth.uid() AND active = true));

-- INSERT: Garantir que o office_id inserido é o do usuário
CREATE POLICY "Membros do escritório podem inserir clientes" ON public.clientes
    FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM office_users WHERE office_id = public.clientes.office_id AND user_id = auth.uid() AND active = true));

-- Repetir para as outras tabelas conforme necessário...
-- Nota: Para um MVP, podemos simplificar os UPDATE/DELETE também.


-- ============================================================
-- MIGRATION: 20260417000002_notification_triggers.sql
-- ============================================================

-- Trigger para criar notificação quando um novo prazo é inserido
CREATE OR REPLACE FUNCTION public.notify_new_prazo()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.notifications (user_id, office_id, type, title, message, action_url, action_label)
    VALUES (
        NEW.user_id,
        NEW.office_id,
        'warning',
        'Novo Prazo Cadastrado',
        'Um novo prazo "' || NEW.titulo || '" foi cadastrado para o dia ' || to_char(NEW.data_vencimento, 'DD/MM/YYYY') || '.',
        '/agenda',
        'Ver Agenda'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_notify_new_prazo
AFTER INSERT ON public.prazos
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_prazo();

-- Trigger para notificações de Audiências
CREATE OR REPLACE FUNCTION public.notify_new_audiencia()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.notifications (user_id, office_id, type, title, message, action_url, action_label)
    VALUES (
        NEW.user_id,
        NEW.office_id,
        'info',
        'Nova Audiência Agendada',
        'Audiência "' || NEW.titulo || '" marcada para ' || to_char(NEW.data_audiencia AT TIME ZONE 'UTC', 'DD/MM/YYYY HH24:MI') || '.',
        '/agenda',
        'Ver Agenda'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_notify_new_audiencia
AFTER INSERT ON public.audiencias
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_audiencia();


-- ============================================================
-- MIGRATION: 20260418_plan_normalization.sql
-- ============================================================
BEGIN;

-- 1) Criar o novo enum alinhado com a landing page
CREATE TYPE subscription_plan_new AS ENUM (
  'trial','basico','intermediario','avancado','premium'
);

-- 2) Adicionar colunas de limites em plan_configs para centralizar a lógica
ALTER TABLE plan_configs 
  ADD COLUMN IF NOT EXISTS max_users INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS max_processes INT DEFAULT 30,
  ADD COLUMN IF NOT EXISTS has_financial BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_goals BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_ai BOOLEAN DEFAULT FALSE;

-- 3) Migrar offices.plan — ambos os offices existentes são vitalícios = premium
ALTER TABLE offices
  ALTER COLUMN plan DROP DEFAULT;

ALTER TABLE offices
  ALTER COLUMN plan TYPE subscription_plan_new
  USING 'premium'::subscription_plan_new;

-- 4) Migrar subscriptions.plan
ALTER TABLE subscriptions
  ALTER COLUMN plan TYPE subscription_plan_new
  USING 'premium'::subscription_plan_new;

-- 5) Substituir o enum antigo pelo novo
DROP TYPE subscription_plan CASCADE;
ALTER TYPE subscription_plan_new RENAME TO subscription_plan;

-- 6) Restaurar default razoável para novos cadastros (trial de 7 dias)
ALTER TABLE offices
  ALTER COLUMN plan SET DEFAULT 'trial'::subscription_plan;

-- 7) Alinhar plan_configs.plan_type e configurar limites
UPDATE plan_configs SET 
  plan_type = 'basico',
  max_users = 1,
  max_processes = 30,
  has_financial = FALSE,
  has_goals = FALSE,
  has_ai = FALSE
WHERE plan_name = 'Básico';

UPDATE plan_configs SET 
  plan_type = 'intermediario',
  max_users = 3,
  max_processes = 100,
  has_financial = FALSE,
  has_goals = FALSE,
  has_ai = FALSE
WHERE plan_name = 'Intermediário';

UPDATE plan_configs SET 
  plan_type = 'avancado',
  max_users = 5,
  max_processes = 300,
  has_financial = TRUE,
  has_goals = FALSE,
  has_ai = FALSE
WHERE plan_name = 'Avançado';

UPDATE plan_configs SET 
  plan_type = 'premium',
  max_users = 10,
  max_processes = 999999, -- Ilimitado
  has_financial = TRUE,
  has_goals = TRUE,
  has_ai = TRUE
WHERE plan_name = 'Premium';

-- 8) Garantir unicidade
ALTER TABLE plan_configs
  ADD CONSTRAINT plan_configs_plan_name_unique UNIQUE (plan_name);
ALTER TABLE plan_configs
  ADD CONSTRAINT plan_configs_plan_type_unique UNIQUE (plan_type);

COMMIT;


-- ============================================================
-- MIGRATION: 20260418_security_hardening.sql
-- ============================================================

-- VextriaHub: Migration de Hardening de Segurança (Versão Corrigida)
-- Este script habilita RLS, isolamento por office_id e remove vulnerabilidades de acesso.

BEGIN;

-- 1. Garantir que as tabelas "órfãs" existam antes de aplicar RLS
-- (Algumas tabelas estão no código mas podem não ter sido criadas no DB)

CREATE TABLE IF NOT EXISTS public.timesheets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  processo_id UUID REFERENCES public.processos(id) ON DELETE SET NULL,
  tarefa_descricao TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'Geral',
  data_inicio TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  data_fim TIMESTAMP WITH TIME ZONE,
  duracao_minutos INTEGER,
  status TEXT DEFAULT 'ativo',
  observacoes TEXT,
  deletado BOOLEAN DEFAULT false,
  deletado_pendente BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.plan_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_name TEXT NOT NULL,
  plan_type TEXT NOT NULL, -- 'mensal', 'anual'
  price_cents INTEGER NOT NULL,
  features JSONB,
  trial_days INTEGER DEFAULT 7,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Garantir que a coluna office_id existe nas tabelas principais
DO $$ 
DECLARE
  t text;
  tables_to_check text[] := ARRAY['atendimentos', 'audiencias', 'clientes', 'financeiro', 'metas', 'prazos', 'processos', 'tarefas', 'timesheets', 'notifications'];
BEGIN
  FOREACH t IN ARRAY tables_to_check LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t AND column_name = 'office_id') THEN
        EXECUTE format('ALTER TABLE public.%I ADD COLUMN office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE', t);
      END IF;
    END IF;
  END LOOP;
END $$;

-- 3. Habilitar RLS em massa
ALTER TABLE public.atendimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audiencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prazos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tarefas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timesheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exclusoes_pendentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_configs ENABLE ROW LEVEL SECURITY;

-- 4. Função Helper para verificar vínculo de usuário com escritório
CREATE OR REPLACE FUNCTION public.user_belongs_to_office(target_office_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.office_users 
    WHERE user_id = auth.uid() 
    AND office_id = target_office_id 
    AND active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Aplicar Políticas de Isolamento (Multi-tenant por office_id)
-- Nota: Super Admins ignoram RLS por padrão no Postgres se forem donos da tabela,
-- mas aqui definimos acesso explícito para garantir.

DO $$ 
DECLARE
  t text;
  tables_to_protect text[] := ARRAY['atendimentos', 'audiencias', 'clientes', 'financeiro', 'metas', 'prazos', 'processos', 'tarefas', 'timesheets', 'notifications'];
BEGIN
  FOREACH t IN ARRAY tables_to_protect LOOP
    -- Dropar políticas antigas se existirem para evitar conflitos
    EXECUTE format('DROP POLICY IF EXISTS "Isolamento por escritório" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Admin do escritório gerencia tudo" ON public.%I', t);
    
    -- Política de Seleção/Acesso: Membros do mesmo escritório vêem os dados
    EXECUTE format('CREATE POLICY "Isolamento por escritório" ON public.%I FOR ALL USING (public.user_belongs_to_office(office_id))', t);
    
    -- Política para Super Admin do Sistema
    EXECUTE format('CREATE POLICY "SuperAdmin acesso total" ON public.%I FOR ALL TO authenticated USING (
      EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = ''super_admin'')
    )', t);
  END LOOP;
END $$;

-- 6. Políticas específicas para tabelas auxiliares
DROP POLICY IF EXISTS "Leitura pública plan_configs" ON public.plan_configs;
CREATE POLICY "Leitura pública plan_configs" ON public.plan_configs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins gerenciam exclusoes" ON public.exclusoes_pendentes;
CREATE POLICY "Admins gerenciam exclusoes" ON public.exclusoes_pendentes FOR ALL USING (
  public.user_belongs_to_office((dados_registro->>'office_id')::uuid)
);

COMMIT;


-- ============================================================
-- MIGRATION: 20260419_ensure_profile_policies.sql
-- ============================================================
-- VextriaHub: Garantir Políticas de RLS para a tabela Profiles
-- Este script assegura que usuários autenticados possam ler e atualizar seus próprios dados de perfil.

BEGIN;

-- 1. Habilitar RLS se não estiver habilitado
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Política de Leitura (SELECT): Usuário vê seu próprio perfil
DROP POLICY IF EXISTS "Usuários podem ver seu próprio perfil" ON public.profiles;
CREATE POLICY "Usuários podem ver seu próprio perfil" 
ON public.profiles 
FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- 3. Política de Atualização (UPDATE): Usuário atualiza seu próprio perfil
DROP POLICY IF EXISTS "Usuários podem atualizar seu próprio perfil" ON public.profiles;
CREATE POLICY "Usuários podem atualizar seu próprio perfil" 
ON public.profiles 
FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 4. Política de Inserção (INSERT): Usuário pode criar seu perfil inicial
-- (Caso o gatilho falhe ou precise de criação via código)
DROP POLICY IF EXISTS "Usuários podem criar seu próprio perfil" ON public.profiles;
CREATE POLICY "Usuários podem criar seu próprio perfil" 
ON public.profiles 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- 5. Política para Super Admin (Acesso total via profiles)
DROP POLICY IF EXISTS "SuperAdmin total access profiles" ON public.profiles;
CREATE POLICY "SuperAdmin total access profiles"
ON public.profiles
FOR ALL
TO authenticated
USING (
  (SELECT role FROM public.profiles WHERE user_id = auth.uid()) = 'super_admin'
);

COMMIT;


-- ============================================================
-- MIGRATION: 20260419_public_rls_plans.sql
-- ============================================================
BEGIN;

-- Garante que os preços e capacidades dos planos possam ser lidos ativamente na Landing Page
-- por visitantes (anônimos) e usuários recém-cadastrados

ALTER TABLE "public"."plan_configs" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view plan configs" ON "public"."plan_configs";

CREATE POLICY "Public can view plan configs" 
  ON "public"."plan_configs" 
  FOR SELECT 
  USING (true);

COMMIT;


-- ============================================================
-- MIGRATION: 20260422124800_create_publicacoes.sql
-- ============================================================

-- Create publicacoes table
CREATE TABLE IF NOT EXISTS public.publicacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE NOT NULL,
    numero_processo TEXT NOT NULL,
    titulo TEXT NOT NULL,
    conteudo TEXT NOT NULL,
    data_publicacao DATE NOT NULL,
    status TEXT DEFAULT 'nova' CHECK (status IN ('nova', 'lida', 'arquivada', 'processada')),
    urgencia TEXT DEFAULT 'media' CHECK (urgencia IN ('baixa', 'media', 'alta')),
    tags TEXT[] DEFAULT '{}',
    cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
    processo_id UUID REFERENCES public.processos(id) ON DELETE SET NULL,
    tribunal TEXT,
    vara TEXT,
    comarca TEXT,
    instancia TEXT,
    juiz TEXT,
    tipo_acao TEXT,
    natureza TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create monitoramento_termos table
CREATE TABLE IF NOT EXISTS public.monitoramento_termos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE NOT NULL,
    termo TEXT NOT NULL,
    tipo TEXT DEFAULT 'oab' CHECK (tipo IN ('oab', 'nome', 'processo', 'cpf_cnpj')),
    seccional TEXT, -- For OAB
    ativo BOOLEAN DEFAULT true,
    ultima_busca TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.publicacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitoramento_termos ENABLE ROW LEVEL SECURITY;

-- Policies for publicacoes
CREATE POLICY "Offices can view their own publicacoes"
    ON public.publicacoes FOR SELECT
    USING (office_id IN (SELECT id FROM public.offices));

CREATE POLICY "Offices can insert their own publicacoes"
    ON public.publicacoes FOR INSERT
    WITH CHECK (office_id IN (SELECT id FROM public.offices));

CREATE POLICY "Offices can update their own publicacoes"
    ON public.publicacoes FOR UPDATE
    USING (office_id IN (SELECT id FROM public.offices));

CREATE POLICY "Offices can delete their own publicacoes"
    ON public.publicacoes FOR DELETE
    USING (office_id IN (SELECT id FROM public.offices));

-- Policies for monitoramento_termos
CREATE POLICY "Offices can view their own monitoramento_termos"
    ON public.monitoramento_termos FOR SELECT
    USING (office_id IN (SELECT id FROM public.offices));

CREATE POLICY "Offices can manage their own monitoramento_termos"
    ON public.monitoramento_termos FOR ALL
    USING (office_id IN (SELECT id FROM public.offices));

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_publicacoes_office_id ON public.publicacoes(office_id);
CREATE INDEX IF NOT EXISTS idx_publicacoes_numero_processo ON public.publicacoes(numero_processo);
CREATE INDEX IF NOT EXISTS idx_monitoramento_termos_office_id ON public.monitoramento_termos(office_id);


-- ============================================================
-- MIGRATION: 20260422150000_profile_oab_fields.sql
-- ============================================================
-- Add OAB fields to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS oab TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS oab_uf TEXT;

-- Index for performance in lookups
CREATE INDEX IF NOT EXISTS idx_profiles_oab ON profiles(oab, oab_uf);

-- Comment for documentation
COMMENT ON COLUMN profiles.oab IS 'Número da OAB do advogado para busca automática de publicações.';
COMMENT ON COLUMN profiles.oab_uf IS 'Seccional (UF) da OAB do advogado.';


-- ============================================================
-- MIGRATION: 20260423000000_ensure_oab_fields_v2.sql
-- ============================================================
-- ENSURE OAB FIELDS EXIST IN PROFILES
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'oab') THEN
        ALTER TABLE profiles ADD COLUMN oab TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'oab_uf') THEN
        ALTER TABLE profiles ADD COLUMN oab_uf TEXT;
    END IF;
END $$;

-- Update comments
COMMENT ON COLUMN profiles.oab IS 'Número da OAB para busca de publicações';
COMMENT ON COLUMN profiles.oab_uf IS 'UF da OAB';

-- Ensure Index
DROP INDEX IF EXISTS idx_profiles_oab;
CREATE INDEX idx_profiles_oab ON profiles(oab, oab_uf);


-- ============================================================
-- MIGRATION: 20260423000001_ensure_publicacoes_table.sql
-- ============================================================
-- ENSURE PUBLICACOES TABLE EXISTS
-- This is a copy of 20260422124800_create_publicacoes.sql but with IF NOT EXISTS everywhere

CREATE TABLE IF NOT EXISTS public.publicacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE NOT NULL,
    numero_processo TEXT NOT NULL,
    titulo TEXT NOT NULL,
    conteudo TEXT NOT NULL,
    data_publicacao DATE NOT NULL,
    status TEXT DEFAULT 'nova' CHECK (status IN ('nova', 'lida', 'arquivada', 'processada')),
    urgencia TEXT DEFAULT 'media' CHECK (urgencia IN ('baixa', 'media', 'alta')),
    tags TEXT[] DEFAULT '{}',
    cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
    processo_id UUID REFERENCES public.processos(id) ON DELETE SET NULL,
    tribunal TEXT,
    vara TEXT,
    comarca TEXT,
    instancia TEXT,
    juiz TEXT,
    tipo_acao TEXT,
    natureza TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.monitoramento_termos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE NOT NULL,
    termo TEXT NOT NULL,
    tipo TEXT DEFAULT 'oab' CHECK (tipo IN ('oab', 'nome', 'processo', 'cpf_cnpj')),
    seccional TEXT,
    ativo BOOLEAN DEFAULT true,
    ultima_busca TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.publicacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitoramento_termos ENABLE ROW LEVEL SECURITY;

-- Policies (using DO block to avoid error if they exist)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Offices can view their own publicacoes') THEN
        CREATE POLICY "Offices can view their own publicacoes" ON public.publicacoes FOR SELECT USING (office_id IN (SELECT id FROM public.offices));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Offices can insert their own publicacoes') THEN
        CREATE POLICY "Offices can insert their own publicacoes" ON public.publicacoes FOR INSERT WITH CHECK (office_id IN (SELECT id FROM public.offices));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Offices can view their own monitoramento_termos') THEN
        CREATE POLICY "Offices can view their own monitoramento_termos" ON public.monitoramento_termos FOR SELECT USING (office_id IN (SELECT id FROM public.offices));
    END IF;
END $$;


-- ============================================================
-- MIGRATION: 20260423000002_enhance_processos_capa.sql
-- ============================================================

-- Add missing columns to processos table for a better Capa
ALTER TABLE public.processos 
ADD COLUMN IF NOT EXISTS requerido TEXT,
ADD COLUMN IF NOT EXISTS segredo_justica BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS justica_gratuita BOOLEAN DEFAULT false;

-- Create a table for process movements (Timeline)
CREATE TABLE IF NOT EXISTS public.movimentacoes_processo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE,
    processo_id UUID REFERENCES public.processos(id) ON DELETE CASCADE NOT NULL,
    data_movimentacao TIMESTAMP WITH TIME ZONE NOT NULL,
    descricao TEXT NOT NULL,
    detalhes TEXT,
    tipo TEXT, -- 'andamento', 'publicacao', 'decisao', etc.
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.movimentacoes_processo ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view movements of their processes"
    ON public.movimentacoes_processo FOR SELECT
    USING (
        processo_id IN (
            SELECT id FROM public.processos 
            WHERE office_id = public.movimentacoes_processo.office_id 
               OR user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert movements for their processes"
    ON public.movimentacoes_processo FOR INSERT
    WITH CHECK (
        processo_id IN (
            SELECT id FROM public.processos 
            WHERE office_id = public.movimentacoes_processo.office_id 
               OR user_id = auth.uid()
        )
    );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_movimentacoes_processo_id ON public.movimentacoes_processo(processo_id);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_data ON public.movimentacoes_processo(data_movimentacao DESC);


-- ============================================================
-- MIGRATION: 20260424000003_processos_dedup_and_constraints.sql
-- ============================================================
-- Migration: De-duplication and Data Hardening for Processos
-- Version: 20260424000003

-- 1. Marcar duplicatas como deletadas
-- Mantém apenas o registro mais antigo por processo dentro de cada escritório
WITH Duplicates AS (
    SELECT id, 
           ROW_NUMBER() OVER (
               PARTITION BY office_id, numero_processo 
               ORDER BY created_at ASC
           ) as row_num
    FROM public.processos
    WHERE deletado = false OR deletado IS NULL
)
UPDATE public.processos
SET deletado = true,
    updated_at = NOW()
WHERE id IN (
    SELECT id FROM Duplicates WHERE row_num > 1
);

-- 2. Adicionar restrição de unicidade (Índice parcial)
-- Garante que um escritório não possa ter dois processos ativos com o mesmo número
CREATE UNIQUE INDEX IF NOT EXISTS idx_processos_unique_numero_office 
ON public.processos (office_id, numero_processo) 
WHERE (deletado = false OR deletado IS NULL);

-- 3. Sanitização de títulos corrompidos
-- Corrige títulos que vieram com lixo do parser (muito longos ou com padrões de erro)
UPDATE public.processos
SET titulo = SUBSTRING(numero_processo FROM 1 FOR 7) || '-' || 
             SUBSTRING(numero_processo FROM 8 FOR 2) || '.' || 
             SUBSTRING(numero_processo FROM 10 FOR 4) || '.' || 
             SUBSTRING(numero_processo FROM 14 FOR 1) || '.' || 
             SUBSTRING(numero_processo FROM 15 FOR 2) || '.' || 
             SUBSTRING(numero_processo FROM 17 FOR 4),
    updated_at = NOW()
WHERE (LENGTH(titulo) > 120 OR titulo LIKE '%FINALIDADE:%' OR titulo LIKE '%Destinatários:%')
  AND LENGTH(numero_processo) = 20;

-- 4. Garantir colunas essenciais
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'processos' AND column_name = 'data_distribuicao') THEN
        ALTER TABLE public.processos ADD COLUMN data_distribuicao DATE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'processos' AND column_name = 'requerido') THEN
        ALTER TABLE public.processos ADD COLUMN requerido TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'processos' AND column_name = 'justica_gratuita') THEN
        ALTER TABLE public.processos ADD COLUMN justica_gratuita BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'processos' AND column_name = 'segredo_justica') THEN
        ALTER TABLE public.processos ADD COLUMN segredo_justica BOOLEAN DEFAULT false;
    END IF;
END $$;

-- 5. Comentário de auditoria
COMMENT ON INDEX idx_processos_unique_numero_office IS 'Garante unicidade de processos ativos por escritório para evitar duplicidades na importação.';


-- ============================================================
-- MIGRATION: 20260424000010_fix_processos_rls_and_backfill.sql
-- ============================================================
-- Migration: Corrigir RLS de processos e backfill de office_id
-- Versão: 20260424000010
-- Problema: processos com office_id=NULL são bloqueados pelo RLS mesmo que
-- pertençam ao usuário via user_id. Este script:
-- 1. Faz backfill de office_id nos processos que estão sem
-- 2. Atualiza o RLS para aceitar processos via user_id como fallback

BEGIN;

-- ========================================================
-- PASSO 1: Backfill de office_id nos processos órfãos
-- Atualiza processos que têm user_id mas NÃO têm office_id,
-- vinculando ao primeiro escritório ativo do usuário
-- ========================================================
UPDATE public.processos p
SET 
  office_id = ou.office_id,
  updated_at = NOW()
FROM public.office_users ou
WHERE 
  p.user_id = ou.user_id
  AND p.office_id IS NULL
  AND ou.active = true;

-- Log quantos foram atualizados (visível no Supabase migration log)
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfill concluído: % processos atualizados com office_id', updated_count;
END $$;

-- ========================================================
-- PASSO 2: Corrigir a política RLS de processos
-- A política atual só permite acesso via office_id.
-- A nova política aceita TAMBÉM processos onde user_id = auth.uid()
-- ========================================================

-- Remover políticas conflitantes existentes
DROP POLICY IF EXISTS "Isolamento por escritório" ON public.processos;
DROP POLICY IF EXISTS "SuperAdmin acesso total" ON public.processos;
DROP POLICY IF EXISTS "Membros do escritório podem ver processos" ON public.processos;
DROP POLICY IF EXISTS "processos_select_policy" ON public.processos;
DROP POLICY IF EXISTS "processos_insert_policy" ON public.processos;
DROP POLICY IF EXISTS "processos_update_policy" ON public.processos;
DROP POLICY IF EXISTS "processos_delete_policy" ON public.processos;

-- Garantir que RLS está habilitado
ALTER TABLE public.processos ENABLE ROW LEVEL SECURITY;

-- Política SELECT: acesso via escritório OU via user_id direto
CREATE POLICY "processos_select_policy" ON public.processos
  FOR SELECT
  USING (
    -- Acesso via escritório (caminho normal)
    (office_id IS NOT NULL AND public.user_belongs_to_office(office_id))
    OR
    -- Acesso via user_id direto (registros legados / sem office_id)
    (user_id = auth.uid())
    OR
    -- Super Admin pode ver tudo
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );

-- Política INSERT: só pode inserir em escritórios que pertence
CREATE POLICY "processos_insert_policy" ON public.processos
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (
      office_id IS NULL
      OR public.user_belongs_to_office(office_id)
      OR EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'super_admin')
    )
  );

-- Política UPDATE: pode atualizar processos do seu escritório ou seus próprios
CREATE POLICY "processos_update_policy" ON public.processos
  FOR UPDATE
  USING (
    (office_id IS NOT NULL AND public.user_belongs_to_office(office_id))
    OR (user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

-- Política DELETE/SOFT DELETE: mesmo que UPDATE
CREATE POLICY "processos_delete_policy" ON public.processos
  FOR DELETE
  USING (
    (office_id IS NOT NULL AND public.user_belongs_to_office(office_id))
    OR (user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

COMMIT;


-- ============================================================
-- MIGRATION: 20260625000001_create_prazos_table.sql
-- ============================================================
-- Tabela de prazos processuais calculados automaticamente
-- Gerada a partir de publicações capturadas via OAB/DJEN
-- Regras: CPC arts. 219-224 e Lei 9.099/95 (Juizado Especial)

CREATE TABLE IF NOT EXISTS public.prazos (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id             UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  publicacao_id         UUID UNIQUE REFERENCES public.publicacoes(id) ON DELETE CASCADE,
  numero_processo       TEXT,
  tipo_prazo            TEXT NOT NULL DEFAULT 'Desconhecido',
  data_disponibilizacao DATE NOT NULL,
  data_intimacao        DATE NOT NULL,
  data_fim_prazo        DATE,
  dias_uteis            INTEGER,
  base_legal            TEXT,
  eh_juizado            BOOLEAN NOT NULL DEFAULT FALSE,
  dias_corridos         BOOLEAN NOT NULL DEFAULT FALSE,
  calculado_em          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para consultas comuns
CREATE INDEX IF NOT EXISTS prazos_office_id_idx        ON public.prazos (office_id);
CREATE INDEX IF NOT EXISTS prazos_data_fim_prazo_idx   ON public.prazos (data_fim_prazo) WHERE data_fim_prazo IS NOT NULL;
CREATE INDEX IF NOT EXISTS prazos_numero_processo_idx  ON public.prazos (numero_processo);

-- RLS
ALTER TABLE public.prazos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuarios veem prazos do proprio escritorio"
  ON public.prazos FOR SELECT
  USING (
    office_id IN (
      SELECT office_id FROM public.office_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "usuarios inserem prazos no proprio escritorio"
  ON public.prazos FOR INSERT
  WITH CHECK (
    office_id IN (
      SELECT office_id FROM public.office_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "usuarios atualizam prazos do proprio escritorio"
  ON public.prazos FOR UPDATE
  USING (
    office_id IN (
      SELECT office_id FROM public.office_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "service role acesso total prazos"
  ON public.prazos FOR ALL
  USING (auth.role() = 'service_role');

-- View auxiliar: prazos próximos do vencimento (≤ 7 dias úteis)
CREATE OR REPLACE VIEW public.prazos_urgentes AS
SELECT
  p.*,
  pub.titulo AS publicacao_titulo,
  pub.status AS publicacao_status,
  (p.data_fim_prazo - CURRENT_DATE) AS dias_restantes
FROM public.prazos p
LEFT JOIN public.publicacoes pub ON pub.id = p.publicacao_id
WHERE
  p.data_fim_prazo IS NOT NULL
  AND p.data_fim_prazo >= CURRENT_DATE
  AND (p.data_fim_prazo - CURRENT_DATE) <= 7
ORDER BY p.data_fim_prazo ASC;



