-- Migração: Remover referências ao ASAAS e adicionar campos Stripe

-- 1. Renomear tabela asaas_checkouts para stripe_checkouts
ALTER TABLE IF EXISTS asaas_checkouts RENAME TO stripe_checkouts;

-- 2. Renomear colunas na tabela stripe_checkouts
ALTER TABLE stripe_checkouts 
RENAME COLUMN asaas_checkout_id TO stripe_checkout_id;

ALTER TABLE stripe_checkouts 
RENAME COLUMN asaas_customer_id TO stripe_customer_id;

ALTER TABLE stripe_checkouts 
RENAME COLUMN asaas_subscription_id TO stripe_subscription_id;

-- 3. Renomear tabela asaas_webhooks para stripe_webhooks
ALTER TABLE IF EXISTS asaas_webhooks RENAME TO stripe_webhooks;

-- 4. Renomear colunas na tabela stripe_webhooks
ALTER TABLE stripe_webhooks 
RENAME COLUMN asaas_event_id TO stripe_event_id;

-- 5. Atualizar tabela subscriptions para usar Stripe
ALTER TABLE subscriptions 
RENAME COLUMN asaas_customer_id TO stripe_customer_id;

ALTER TABLE subscriptions 
RENAME COLUMN asaas_subscription_id TO stripe_subscription_id;

ALTER TABLE subscriptions 
RENAME COLUMN asaas_payment_id TO stripe_payment_intent_id;

-- 6. Adicionar novas colunas para Stripe se não existirem
ALTER TABLE stripe_checkouts 
ADD COLUMN IF NOT EXISTS stripe_session_id TEXT;

ALTER TABLE stripe_checkouts 
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;

-- 7. Criar índices para as novas colunas
CREATE INDEX IF NOT EXISTS idx_stripe_checkouts_stripe_customer_id 
ON stripe_checkouts(stripe_customer_id);

CREATE INDEX IF NOT EXISTS idx_stripe_checkouts_stripe_checkout_id 
ON stripe_checkouts(stripe_checkout_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id 
ON subscriptions(stripe_customer_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id 
ON subscriptions(stripe_subscription_id);

-- 8. Atualizar RLS policies se necessário
-- As políticas existentes continuarão funcionando após renomeação

-- 9. Limpar dados antigos do ASAAS (opcional)
-- DELETE FROM stripe_checkouts WHERE asaas_checkout_id IS NOT NULL;
-- DELETE FROM stripe_webhooks WHERE asaas_event_id IS NOT NULL;

-- 10. Adicionar coluna para armazenar configurações do Stripe
ALTER TABLE offices 
ADD COLUMN IF NOT EXISTS stripe_config JSONB DEFAULT '{}';

-- 11. Criar tabela para armazenar webhooks do Stripe
CREATE TABLE IF NOT EXISTS stripe_webhooks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stripe_event_id TEXT UNIQUE,
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 12. Adicionar índice para webhook events
CREATE INDEX IF NOT EXISTS idx_stripe_webhooks_event_id 
ON stripe_webhooks(stripe_event_id);

CREATE INDEX IF NOT EXISTS idx_stripe_webhooks_event_type 
ON stripe_webhooks(event_type);