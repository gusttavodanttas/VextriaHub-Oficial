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
