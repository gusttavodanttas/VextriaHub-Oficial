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