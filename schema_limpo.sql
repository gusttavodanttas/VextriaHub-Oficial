-- =============================================================================
-- SCHEMA LIMPO VEXTRIA UB
-- Estratégia: 1) Enums  2) Funções  3) TODAS as tabelas  4) TODAS as políticas RLS
-- =============================================================================

-- =============================================================================
-- PARTE 1 — ENUMS
-- =============================================================================
DO $$ BEGIN CREATE TYPE public.app_role AS ENUM ('user', 'admin', 'super_admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE public.subscription_plan AS ENUM ('free', 'basic', 'professional', 'enterprise');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE public.subscription_status AS ENUM ('active', 'inactive', 'suspended', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE public.invitation_status AS ENUM ('pending', 'accepted', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE public.access_type AS ENUM ('trial', 'stripe_paid', 'lifetime', 'courtesy');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- PARTE 2 — FUNÇÕES UTILITÁRIAS
-- =============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.update_subscribers_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- =============================================================================
-- PARTE 3 — TODAS AS TABELAS (sem políticas ainda)
-- =============================================================================

-- profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id                 UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id            UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name          TEXT,
  email              TEXT,
  role               public.app_role NOT NULL DEFAULT 'user',
  oab                TEXT,
  oab_uf             TEXT,
  avatar_url         TEXT,
  office_id          UUID,
  stripe_customer_id TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- offices
CREATE TABLE IF NOT EXISTS public.offices (
  id                UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name              TEXT NOT NULL,
  email             TEXT,
  phone             TEXT,
  address           TEXT,
  logo_url          TEXT,
  plan              public.subscription_plan NOT NULL DEFAULT 'free',
  max_users         INTEGER NOT NULL DEFAULT 5,
  active            BOOLEAN NOT NULL DEFAULT true,
  access_type       public.access_type NOT NULL DEFAULT 'trial',
  access_granted_by UUID REFERENCES auth.users(id),
  access_granted_at TIMESTAMPTZ,
  access_note       TEXT,
  created_by        UUID REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- office_users
CREATE TABLE IF NOT EXISTS public.office_users (
  id         UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  office_id  UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       public.app_role NOT NULL DEFAULT 'user',
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  invited_by UUID REFERENCES auth.users(id),
  active     BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(office_id, user_id)
);

-- FK de profiles → offices (após offices existir)
DO $$ BEGIN
  ALTER TABLE public.profiles ADD CONSTRAINT profiles_office_id_fkey
    FOREIGN KEY (office_id) REFERENCES public.offices(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- subscriptions
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                      UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  office_id               UUID NOT NULL UNIQUE REFERENCES public.offices(id) ON DELETE CASCADE,
  plan                    public.subscription_plan NOT NULL DEFAULT 'free',
  status                  public.subscription_status NOT NULL DEFAULT 'active',
  start_date              DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date                DATE,
  price                   NUMERIC(10,2),
  billing_cycle           TEXT DEFAULT 'monthly',
  stripe_subscription_id  TEXT,
  stripe_customer_id      TEXT,
  payment_status          TEXT DEFAULT 'pending',
  access_status           TEXT DEFAULT 'trial',
  trial_ends_at           TIMESTAMPTZ,
  manual_discount_percent NUMERIC(5,2),
  stripe_coupon_id        TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- invitations
CREATE TABLE IF NOT EXISTS public.invitations (
  id          UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  office_id   UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  role        public.app_role NOT NULL DEFAULT 'user',
  token       UUID NOT NULL DEFAULT gen_random_uuid(),
  status      public.invitation_status NOT NULL DEFAULT 'pending',
  invited_by  UUID NOT NULL REFERENCES auth.users(id),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- clientes
CREATE TABLE IF NOT EXISTS public.clientes (
  id               UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  office_id        UUID REFERENCES public.offices(id) ON DELETE CASCADE,
  nome             TEXT NOT NULL,
  email            TEXT,
  telefone         TEXT,
  cpf_cnpj         TEXT,
  tipo_pessoa      TEXT CHECK (tipo_pessoa IN ('fisica','juridica')) DEFAULT 'fisica',
  endereco         TEXT,
  origem           TEXT,
  data_aniversario DATE,
  status           TEXT DEFAULT 'ativo',
  observacoes      TEXT,
  deletado         BOOLEAN NOT NULL DEFAULT false,
  deletado_pendente BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- processos
CREATE TABLE IF NOT EXISTS public.processos (
  id                      UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  office_id               UUID REFERENCES public.offices(id) ON DELETE CASCADE,
  cliente_id              UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  numero_processo         TEXT NOT NULL,
  titulo                  TEXT NOT NULL,
  status                  TEXT DEFAULT 'ativo',
  tipo_processo           TEXT,
  tribunal                TEXT,
  comarca                 TEXT,
  vara                    TEXT,
  sistema_tribunal        TEXT,
  instancia               TEXT,
  juiz                    TEXT,
  natureza                TEXT,
  valor_causa             DECIMAL(15,2),
  data_inicio             DATE DEFAULT CURRENT_DATE,
  data_distribuicao       DATE,
  data_ultima_atualizacao DATE DEFAULT CURRENT_DATE,
  proximo_prazo           DATE,
  etiquetas               TEXT[],
  observacoes             TEXT,
  requerido               TEXT,
  segredo_justica         BOOLEAN DEFAULT false,
  justica_gratuita        BOOLEAN DEFAULT false,
  deletado                BOOLEAN NOT NULL DEFAULT false,
  deletado_pendente       BOOLEAN NOT NULL DEFAULT false,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS processos_office_numero_unique
  ON public.processos (office_id, numero_processo) WHERE deletado = false AND office_id IS NOT NULL;

-- audiencias
CREATE TABLE IF NOT EXISTS public.audiencias (
  id             UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  office_id      UUID REFERENCES public.offices(id) ON DELETE CASCADE,
  processo_id    UUID REFERENCES public.processos(id) ON DELETE CASCADE,
  cliente_id     UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  titulo         TEXT NOT NULL,
  tipo           TEXT,
  data_audiencia TIMESTAMPTZ NOT NULL,
  local          TEXT,
  observacoes    TEXT,
  status         TEXT DEFAULT 'agendada',
  deletado       BOOLEAN NOT NULL DEFAULT false,
  deletado_pendente BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- tarefas
CREATE TABLE IF NOT EXISTS public.tarefas (
  id              UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  office_id       UUID REFERENCES public.offices(id) ON DELETE CASCADE,
  processo_id     UUID REFERENCES public.processos(id) ON DELETE SET NULL,
  cliente_id      UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  titulo          TEXT NOT NULL,
  descricao       TEXT,
  prioridade      TEXT CHECK (prioridade IN ('baixa','media','alta')) DEFAULT 'media',
  status          TEXT DEFAULT 'pendente',
  data_vencimento DATE,
  concluida       BOOLEAN DEFAULT false,
  deletado        BOOLEAN NOT NULL DEFAULT false,
  deletado_pendente BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- atendimentos
CREATE TABLE IF NOT EXISTS public.atendimentos (
  id               UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  office_id        UUID REFERENCES public.offices(id) ON DELETE CASCADE,
  cliente_id       UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  tipo_atendimento TEXT NOT NULL,
  data_atendimento TIMESTAMPTZ NOT NULL,
  duracao          INTEGER,
  observacoes      TEXT,
  status           TEXT DEFAULT 'agendado',
  deletado         BOOLEAN NOT NULL DEFAULT false,
  deletado_pendente BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- metas
CREATE TABLE IF NOT EXISTS public.metas (
  id          UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  office_id   UUID REFERENCES public.offices(id) ON DELETE CASCADE,
  titulo      TEXT NOT NULL,
  tipo        TEXT NOT NULL,
  valor_meta  DECIMAL(15,2),
  valor_atual DECIMAL(15,2) DEFAULT 0,
  periodo     TEXT NOT NULL,
  data_inicio DATE NOT NULL,
  data_fim    DATE NOT NULL,
  status      TEXT DEFAULT 'ativa',
  deletado    BOOLEAN NOT NULL DEFAULT false,
  deletado_pendente BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- financeiro
CREATE TABLE IF NOT EXISTS public.financeiro (
  id              UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  office_id       UUID REFERENCES public.offices(id) ON DELETE CASCADE,
  processo_id     UUID REFERENCES public.processos(id) ON DELETE SET NULL,
  cliente_id      UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  tipo            TEXT CHECK (tipo IN ('receita','despesa')) NOT NULL,
  descricao       TEXT NOT NULL,
  valor           DECIMAL(15,2) NOT NULL,
  data_vencimento DATE NOT NULL,
  data_pagamento  DATE,
  status          TEXT DEFAULT 'pendente',
  categoria       TEXT,
  deletado        BOOLEAN NOT NULL DEFAULT false,
  deletado_pendente BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- publicacoes
CREATE TABLE IF NOT EXISTS public.publicacoes (
  id              UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  office_id       UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES auth.users(id),
  numero_processo TEXT NOT NULL,
  titulo          TEXT NOT NULL,
  conteudo        TEXT NOT NULL,
  data_publicacao DATE NOT NULL,
  status          TEXT NOT NULL DEFAULT 'nova' CHECK (status IN ('nova','lida','arquivada','processada')),
  urgencia        TEXT NOT NULL DEFAULT 'media' CHECK (urgencia IN ('baixa','media','alta')),
  tags            TEXT[] DEFAULT '{}',
  cliente_id      UUID REFERENCES public.clientes(id),
  processo_id     UUID REFERENCES public.processos(id),
  tribunal        TEXT,
  vara            TEXT,
  comarca         TEXT,
  instancia       TEXT,
  juiz            TEXT,
  tipo_documento  TEXT,
  nome_orgao      TEXT,
  tipo_acao       TEXT,
  natureza        TEXT,
  metadata        JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- monitoramento_termos
CREATE TABLE IF NOT EXISTS public.monitoramento_termos (
  id           UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  office_id    UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  termo        TEXT NOT NULL,
  tipo         TEXT NOT NULL DEFAULT 'oab' CHECK (tipo IN ('oab','nome','processo','cpf_cnpj')),
  seccional    TEXT,
  ativo        BOOLEAN DEFAULT true,
  ultima_busca TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- prazos (CPC + Lei 9.099/95)
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

-- notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id         UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  office_id  UUID REFERENCES public.offices(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  message    TEXT,
  type       TEXT DEFAULT 'info',
  read       BOOLEAN DEFAULT false,
  data       JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- exclusoes_pendentes
CREATE TABLE IF NOT EXISTS public.exclusoes_pendentes (
  id             UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  office_id      UUID REFERENCES public.offices(id) ON DELETE CASCADE,
  tabela         TEXT NOT NULL,
  registro_id    UUID NOT NULL,
  dados_registro JSONB NOT NULL,
  motivo         TEXT,
  solicitado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
  aprovado_por   UUID REFERENCES auth.users(id),
  aprovado_em    TIMESTAMPTZ,
  status         TEXT DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','rejeitado'))
);

-- subscribers
CREATE TABLE IF NOT EXISTS public.subscribers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email             TEXT NOT NULL UNIQUE,
  stripe_customer_id TEXT,
  subscribed        BOOLEAN NOT NULL DEFAULT false,
  subscription_tier TEXT,
  subscription_end  TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- plan_configs
CREATE TABLE IF NOT EXISTS public.plan_configs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_name   TEXT NOT NULL,
  plan_type   TEXT NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 0,
  features    JSONB DEFAULT '[]'::jsonb,
  trial_days  INTEGER DEFAULT 7,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- office_access_changes
CREATE TABLE IF NOT EXISTS public.office_access_changes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id  UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  changed_by UUID NOT NULL REFERENCES auth.users(id),
  action     TEXT NOT NULL,
  details    JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- PARTE 4 — HABILITAR RLS EM TODAS AS TABELAS
-- =============================================================================
ALTER TABLE public.profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offices             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audiencias          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tarefas             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atendimentos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metas               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publicacoes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitoramento_termos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prazos              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exclusoes_pendentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscribers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_configs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_access_changes ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- PARTE 5 — POLÍTICAS RLS (todas as tabelas já existem aqui)
-- =============================================================================

-- profiles
DROP POLICY IF EXISTS "profiles_select_own"   ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own"   ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own"   ON public.profiles;
DROP POLICY IF EXISTS "profiles_super_admin"  ON public.profiles;
CREATE POLICY "profiles_select_own"  ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "profiles_update_own"  ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "profiles_insert_own"  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "profiles_super_admin" ON public.profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'super_admin')
);

-- offices
DROP POLICY IF EXISTS "offices_select_super"  ON public.offices;
DROP POLICY IF EXISTS "offices_select_member" ON public.offices;
DROP POLICY IF EXISTS "offices_insert_auth"   ON public.offices;
DROP POLICY IF EXISTS "offices_update_admin"  ON public.offices;
CREATE POLICY "offices_select_super"  ON public.offices FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'super_admin')
);
CREATE POLICY "offices_select_member" ON public.offices FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.office_users WHERE office_users.office_id = offices.id AND office_users.user_id = auth.uid())
);
CREATE POLICY "offices_insert_auth"   ON public.offices FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "offices_update_admin"  ON public.offices FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.office_users WHERE office_users.office_id = offices.id AND office_users.user_id = auth.uid() AND office_users.role IN ('admin','super_admin'))
);

-- office_users
DROP POLICY IF EXISTS "office_users_select" ON public.office_users;
DROP POLICY IF EXISTS "office_users_insert" ON public.office_users;
DROP POLICY IF EXISTS "office_users_update" ON public.office_users;
CREATE POLICY "office_users_select" ON public.office_users FOR SELECT USING (
  user_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.office_users ou WHERE ou.office_id = office_users.office_id AND ou.user_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM public.profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'super_admin')
);
CREATE POLICY "office_users_insert" ON public.office_users FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE profiles.user_id = auth.uid() AND profiles.role IN ('admin','super_admin')) OR
  EXISTS (SELECT 1 FROM public.office_users ou WHERE ou.office_id = office_users.office_id AND ou.user_id = auth.uid() AND ou.role IN ('admin','super_admin'))
);
CREATE POLICY "office_users_update" ON public.office_users FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'super_admin') OR
  EXISTS (SELECT 1 FROM public.office_users ou WHERE ou.office_id = office_users.office_id AND ou.user_id = auth.uid() AND ou.role IN ('admin','super_admin'))
);

-- subscriptions
DROP POLICY IF EXISTS "subs_select_super"  ON public.subscriptions;
DROP POLICY IF EXISTS "subs_select_member" ON public.subscriptions;
DROP POLICY IF EXISTS "subs_manage_super"  ON public.subscriptions;
CREATE POLICY "subs_select_super"  ON public.subscriptions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'super_admin')
);
CREATE POLICY "subs_select_member" ON public.subscriptions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.office_users WHERE office_users.office_id = subscriptions.office_id AND office_users.user_id = auth.uid())
);
CREATE POLICY "subs_manage_super"  ON public.subscriptions FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'super_admin')
);

-- invitations
DROP POLICY IF EXISTS "inv_select" ON public.invitations;
DROP POLICY IF EXISTS "inv_insert" ON public.invitations;
DROP POLICY IF EXISTS "inv_update" ON public.invitations;
CREATE POLICY "inv_select" ON public.invitations FOR SELECT USING (
  email = auth.email() OR
  EXISTS (SELECT 1 FROM public.office_users WHERE office_users.office_id = invitations.office_id AND office_users.user_id = auth.uid() AND office_users.role IN ('admin','super_admin')) OR
  EXISTS (SELECT 1 FROM public.profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'super_admin')
);
CREATE POLICY "inv_insert" ON public.invitations FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.office_users WHERE office_users.office_id = invitations.office_id AND office_users.user_id = auth.uid() AND office_users.role IN ('admin','super_admin')) OR
  EXISTS (SELECT 1 FROM public.profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'super_admin')
);
CREATE POLICY "inv_update" ON public.invitations FOR UPDATE USING (
  email = auth.email() OR
  EXISTS (SELECT 1 FROM public.profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'super_admin')
);

-- clientes
DROP POLICY IF EXISTS "clientes_select" ON public.clientes;
DROP POLICY IF EXISTS "clientes_insert" ON public.clientes;
DROP POLICY IF EXISTS "clientes_update" ON public.clientes;
DROP POLICY IF EXISTS "clientes_delete" ON public.clientes;
CREATE POLICY "clientes_select" ON public.clientes FOR SELECT USING (
  deletado = false AND (
    auth.uid() = user_id OR
    (office_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.office_users WHERE office_users.office_id = clientes.office_id AND office_users.user_id = auth.uid()))
  )
);
CREATE POLICY "clientes_insert" ON public.clientes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "clientes_update" ON public.clientes FOR UPDATE USING (
  auth.uid() = user_id OR
  (office_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.office_users WHERE office_users.office_id = clientes.office_id AND office_users.user_id = auth.uid()))
);
CREATE POLICY "clientes_delete" ON public.clientes FOR DELETE USING (auth.uid() = user_id);

-- processos
DROP POLICY IF EXISTS "processos_select" ON public.processos;
DROP POLICY IF EXISTS "processos_insert" ON public.processos;
DROP POLICY IF EXISTS "processos_update" ON public.processos;
DROP POLICY IF EXISTS "processos_delete" ON public.processos;
CREATE POLICY "processos_select" ON public.processos FOR SELECT USING (
  deletado = false AND (
    auth.uid() = user_id OR
    (office_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.office_users WHERE office_users.office_id = processos.office_id AND office_users.user_id = auth.uid()))
  )
);
CREATE POLICY "processos_insert" ON public.processos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "processos_update" ON public.processos FOR UPDATE USING (
  auth.uid() = user_id OR
  (office_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.office_users WHERE office_users.office_id = processos.office_id AND office_users.user_id = auth.uid()))
);
CREATE POLICY "processos_delete" ON public.processos FOR DELETE USING (auth.uid() = user_id);

-- audiencias
DROP POLICY IF EXISTS "audiencias_select" ON public.audiencias;
DROP POLICY IF EXISTS "audiencias_insert" ON public.audiencias;
DROP POLICY IF EXISTS "audiencias_update" ON public.audiencias;
CREATE POLICY "audiencias_select" ON public.audiencias FOR SELECT USING (
  deletado = false AND (auth.uid() = user_id OR (office_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.office_users WHERE office_users.office_id = audiencias.office_id AND office_users.user_id = auth.uid())))
);
CREATE POLICY "audiencias_insert" ON public.audiencias FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "audiencias_update" ON public.audiencias FOR UPDATE USING (auth.uid() = user_id);

-- tarefas
DROP POLICY IF EXISTS "tarefas_select" ON public.tarefas;
DROP POLICY IF EXISTS "tarefas_insert" ON public.tarefas;
DROP POLICY IF EXISTS "tarefas_update" ON public.tarefas;
CREATE POLICY "tarefas_select" ON public.tarefas FOR SELECT USING (
  deletado = false AND (auth.uid() = user_id OR (office_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.office_users WHERE office_users.office_id = tarefas.office_id AND office_users.user_id = auth.uid())))
);
CREATE POLICY "tarefas_insert" ON public.tarefas FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tarefas_update" ON public.tarefas FOR UPDATE USING (auth.uid() = user_id);

-- atendimentos
DROP POLICY IF EXISTS "atendimentos_select" ON public.atendimentos;
DROP POLICY IF EXISTS "atendimentos_insert" ON public.atendimentos;
DROP POLICY IF EXISTS "atendimentos_update" ON public.atendimentos;
CREATE POLICY "atendimentos_select" ON public.atendimentos FOR SELECT USING (
  deletado = false AND (auth.uid() = user_id OR (office_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.office_users WHERE office_users.office_id = atendimentos.office_id AND office_users.user_id = auth.uid())))
);
CREATE POLICY "atendimentos_insert" ON public.atendimentos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "atendimentos_update" ON public.atendimentos FOR UPDATE USING (auth.uid() = user_id);

-- metas
DROP POLICY IF EXISTS "metas_select" ON public.metas;
DROP POLICY IF EXISTS "metas_insert" ON public.metas;
DROP POLICY IF EXISTS "metas_update" ON public.metas;
CREATE POLICY "metas_select" ON public.metas FOR SELECT USING (
  deletado = false AND (auth.uid() = user_id OR (office_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.office_users WHERE office_users.office_id = metas.office_id AND office_users.user_id = auth.uid())))
);
CREATE POLICY "metas_insert" ON public.metas FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "metas_update" ON public.metas FOR UPDATE USING (auth.uid() = user_id);

-- financeiro
DROP POLICY IF EXISTS "financeiro_select" ON public.financeiro;
DROP POLICY IF EXISTS "financeiro_insert" ON public.financeiro;
DROP POLICY IF EXISTS "financeiro_update" ON public.financeiro;
CREATE POLICY "financeiro_select" ON public.financeiro FOR SELECT USING (
  deletado = false AND (auth.uid() = user_id OR (office_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.office_users WHERE office_users.office_id = financeiro.office_id AND office_users.user_id = auth.uid())))
);
CREATE POLICY "financeiro_insert" ON public.financeiro FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "financeiro_update" ON public.financeiro FOR UPDATE USING (auth.uid() = user_id);

-- publicacoes
DROP POLICY IF EXISTS "pub_select"       ON public.publicacoes;
DROP POLICY IF EXISTS "pub_insert"       ON public.publicacoes;
DROP POLICY IF EXISTS "pub_update"       ON public.publicacoes;
DROP POLICY IF EXISTS "pub_delete"       ON public.publicacoes;
DROP POLICY IF EXISTS "pub_service_role" ON public.publicacoes;
CREATE POLICY "pub_select" ON public.publicacoes FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.office_users WHERE office_users.office_id = publicacoes.office_id AND office_users.user_id = auth.uid())
);
CREATE POLICY "pub_insert" ON public.publicacoes FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.office_users WHERE office_users.office_id = publicacoes.office_id AND office_users.user_id = auth.uid())
);
CREATE POLICY "pub_update" ON public.publicacoes FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.office_users WHERE office_users.office_id = publicacoes.office_id AND office_users.user_id = auth.uid())
);
CREATE POLICY "pub_delete" ON public.publicacoes FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.office_users WHERE office_users.office_id = publicacoes.office_id AND office_users.user_id = auth.uid() AND office_users.role IN ('admin','super_admin'))
);
CREATE POLICY "pub_service_role" ON public.publicacoes FOR ALL USING (auth.role() = 'service_role');

-- monitoramento_termos
DROP POLICY IF EXISTS "mon_select" ON public.monitoramento_termos;
DROP POLICY IF EXISTS "mon_insert" ON public.monitoramento_termos;
DROP POLICY IF EXISTS "mon_update" ON public.monitoramento_termos;
CREATE POLICY "mon_select" ON public.monitoramento_termos FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.office_users WHERE office_users.office_id = monitoramento_termos.office_id AND office_users.user_id = auth.uid())
);
CREATE POLICY "mon_insert" ON public.monitoramento_termos FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.office_users WHERE office_users.office_id = monitoramento_termos.office_id AND office_users.user_id = auth.uid() AND office_users.role IN ('admin','super_admin'))
);
CREATE POLICY "mon_update" ON public.monitoramento_termos FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.office_users WHERE office_users.office_id = monitoramento_termos.office_id AND office_users.user_id = auth.uid() AND office_users.role IN ('admin','super_admin'))
);

-- prazos
DROP POLICY IF EXISTS "prazos_select"       ON public.prazos;
DROP POLICY IF EXISTS "prazos_insert"       ON public.prazos;
DROP POLICY IF EXISTS "prazos_update"       ON public.prazos;
DROP POLICY IF EXISTS "prazos_service_role" ON public.prazos;
CREATE POLICY "prazos_select" ON public.prazos FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.office_users WHERE office_users.office_id = prazos.office_id AND office_users.user_id = auth.uid())
);
CREATE POLICY "prazos_insert" ON public.prazos FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.office_users WHERE office_users.office_id = prazos.office_id AND office_users.user_id = auth.uid())
);
CREATE POLICY "prazos_update" ON public.prazos FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.office_users WHERE office_users.office_id = prazos.office_id AND office_users.user_id = auth.uid())
);
CREATE POLICY "prazos_service_role" ON public.prazos FOR ALL USING (auth.role() = 'service_role');

-- notifications
DROP POLICY IF EXISTS "notif_select" ON public.notifications;
DROP POLICY IF EXISTS "notif_update" ON public.notifications;
DROP POLICY IF EXISTS "notif_insert" ON public.notifications;
CREATE POLICY "notif_select" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notif_update" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "notif_insert" ON public.notifications FOR INSERT WITH CHECK (auth.role() = 'service_role' OR auth.uid() = user_id);

-- exclusoes_pendentes
DROP POLICY IF EXISTS "excl_select_own"   ON public.exclusoes_pendentes;
DROP POLICY IF EXISTS "excl_insert_own"   ON public.exclusoes_pendentes;
DROP POLICY IF EXISTS "excl_select_admin" ON public.exclusoes_pendentes;
DROP POLICY IF EXISTS "excl_update_admin" ON public.exclusoes_pendentes;
CREATE POLICY "excl_select_own"   ON public.exclusoes_pendentes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "excl_insert_own"   ON public.exclusoes_pendentes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "excl_select_admin" ON public.exclusoes_pendentes FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'super_admin')
);
CREATE POLICY "excl_update_admin" ON public.exclusoes_pendentes FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'super_admin')
);

-- subscribers
DROP POLICY IF EXISTS "subs_user_select" ON public.subscribers;
DROP POLICY IF EXISTS "subs_user_update" ON public.subscribers;
DROP POLICY IF EXISTS "subs_user_insert" ON public.subscribers;
CREATE POLICY "subs_user_select" ON public.subscribers FOR SELECT USING (user_id = auth.uid() OR email = auth.email());
CREATE POLICY "subs_user_update" ON public.subscribers FOR UPDATE USING (true);
CREATE POLICY "subs_user_insert" ON public.subscribers FOR INSERT WITH CHECK (true);

-- plan_configs
DROP POLICY IF EXISTS "plans_select_public" ON public.plan_configs;
DROP POLICY IF EXISTS "plans_manage_admin"  ON public.plan_configs;
CREATE POLICY "plans_select_public" ON public.plan_configs FOR SELECT USING (is_active = true);
CREATE POLICY "plans_manage_admin"  ON public.plan_configs FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'super_admin')
);

-- office_access_changes
DROP POLICY IF EXISTS "access_changes_select" ON public.office_access_changes;
CREATE POLICY "access_changes_select" ON public.office_access_changes FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'super_admin')
);

-- =============================================================================
-- PARTE 6 — TRIGGERS
-- =============================================================================
DROP TRIGGER IF EXISTS update_profiles_updated_at     ON public.profiles;
DROP TRIGGER IF EXISTS update_offices_updated_at      ON public.offices;
DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON public.subscriptions;
DROP TRIGGER IF EXISTS update_clientes_updated_at     ON public.clientes;
DROP TRIGGER IF EXISTS update_processos_updated_at    ON public.processos;
DROP TRIGGER IF EXISTS update_audiencias_updated_at   ON public.audiencias;
DROP TRIGGER IF EXISTS update_tarefas_updated_at      ON public.tarefas;
DROP TRIGGER IF EXISTS update_atendimentos_updated_at ON public.atendimentos;
DROP TRIGGER IF EXISTS update_metas_updated_at        ON public.metas;
DROP TRIGGER IF EXISTS update_financeiro_updated_at   ON public.financeiro;
DROP TRIGGER IF EXISTS update_publicacoes_updated_at  ON public.publicacoes;
DROP TRIGGER IF EXISTS update_subscribers_updated_at  ON public.subscribers;

CREATE TRIGGER update_profiles_updated_at      BEFORE UPDATE ON public.profiles      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_offices_updated_at       BEFORE UPDATE ON public.offices       FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_clientes_updated_at      BEFORE UPDATE ON public.clientes      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_processos_updated_at     BEFORE UPDATE ON public.processos     FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_audiencias_updated_at    BEFORE UPDATE ON public.audiencias    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tarefas_updated_at       BEFORE UPDATE ON public.tarefas       FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_atendimentos_updated_at  BEFORE UPDATE ON public.atendimentos  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_metas_updated_at         BEFORE UPDATE ON public.metas         FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_financeiro_updated_at    BEFORE UPDATE ON public.financeiro    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_publicacoes_updated_at   BEFORE UPDATE ON public.publicacoes   FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_subscribers_updated_at   BEFORE UPDATE ON public.subscribers   FOR EACH ROW EXECUTE FUNCTION public.update_subscribers_updated_at();

-- =============================================================================
-- PARTE 7 — TRIGGER: CRIAR PERFIL AO REGISTRAR USUÁRIO
-- =============================================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    NEW.email,
    CASE WHEN NEW.email = 'contato@vextriahub.com.br' THEN 'super_admin'::app_role ELSE 'user'::app_role END
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- PARTE 8 — ÍNDICES
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_clientes_user_id        ON public.clientes(user_id);
CREATE INDEX IF NOT EXISTS idx_clientes_office_id      ON public.clientes(office_id);
CREATE INDEX IF NOT EXISTS idx_processos_user_id       ON public.processos(user_id);
CREATE INDEX IF NOT EXISTS idx_processos_office_id     ON public.processos(office_id);
CREATE INDEX IF NOT EXISTS idx_tarefas_user_id         ON public.tarefas(user_id);
CREATE INDEX IF NOT EXISTS idx_tarefas_office_id       ON public.tarefas(office_id);
CREATE INDEX IF NOT EXISTS idx_audiencias_user_id      ON public.audiencias(user_id);
CREATE INDEX IF NOT EXISTS idx_audiencias_office_id    ON public.audiencias(office_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_user_id      ON public.financeiro(user_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_office_id    ON public.financeiro(office_id);
CREATE INDEX IF NOT EXISTS idx_office_users_uid        ON public.office_users(user_id);
CREATE INDEX IF NOT EXISTS idx_office_users_oid        ON public.office_users(office_id);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id        ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_office_id      ON public.profiles(office_id);
CREATE INDEX IF NOT EXISTS idx_pub_office_id           ON public.publicacoes(office_id);
CREATE INDEX IF NOT EXISTS idx_pub_status              ON public.publicacoes(status);
CREATE INDEX IF NOT EXISTS idx_pub_data                ON public.publicacoes(data_publicacao);
CREATE INDEX IF NOT EXISTS idx_pub_numero_processo     ON public.publicacoes(numero_processo);
CREATE INDEX IF NOT EXISTS idx_prazos_office_id        ON public.prazos(office_id);
CREATE INDEX IF NOT EXISTS idx_prazos_data_fim         ON public.prazos(data_fim_prazo) WHERE data_fim_prazo IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prazos_numero_processo  ON public.prazos(numero_processo);

-- =============================================================================
-- PARTE 9 — DADOS INICIAIS
-- =============================================================================
INSERT INTO public.plan_configs (plan_name, plan_type, price_cents, features, trial_days, is_active) VALUES
('Básico',        'BASIC',      4700,  '["Painel de processos","Gestão de prazos","Cadastro de clientes","1 usuário","até 30 processos"]'::jsonb, 7, true),
('Intermediário', 'PRO',        9700,  '["Tudo do Básico","Múltiplos usuários","Relatórios básicos","até 3 usuários","até 100 processos"]'::jsonb, 7, true),
('Avançado',      'ENTERPRISE', 19700, '["Tudo do Intermediário","Módulo financeiro completo","Relatórios avançados","até 5 usuários","até 300 processos"]'::jsonb, 7, true),
('Premium',       'ENTERPRISE', 39700, '["Tudo do Avançado","Módulo de metas","IA","Suporte VIP","até 10 usuários","processos ilimitados"]'::jsonb, 7, true)
ON CONFLICT DO NOTHING;
