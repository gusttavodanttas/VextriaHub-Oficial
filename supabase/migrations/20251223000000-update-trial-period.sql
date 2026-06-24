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