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
