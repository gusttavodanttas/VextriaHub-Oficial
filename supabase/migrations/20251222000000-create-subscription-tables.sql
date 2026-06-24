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