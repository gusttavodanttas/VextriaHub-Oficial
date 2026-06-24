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