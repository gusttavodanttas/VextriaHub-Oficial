-- Migration: Normaliza os nomes de plano (enum legado -> nomes atuais)
-- Versão: 20260628000009
--
-- Estado atual: offices.plan usa valores antigos (free/basic/professional/enterprise).
-- O app espera: trial/basico/intermediario/avancado/premium.
-- Abordagem segura: converte a coluna para TEXT e mapeia os valores, sem mexer
-- no tipo enum (evita DROP TYPE ... CASCADE). O app já trata plan como string.

BEGIN;

-- OFFICES
ALTER TABLE public.offices ALTER COLUMN plan DROP DEFAULT;
ALTER TABLE public.offices ALTER COLUMN plan TYPE text USING plan::text;
UPDATE public.offices SET plan = CASE plan
  WHEN 'free'         THEN 'trial'
  WHEN 'basic'        THEN 'basico'
  WHEN 'professional' THEN 'avancado'
  WHEN 'enterprise'   THEN 'premium'
  ELSE plan
END;
ALTER TABLE public.offices ALTER COLUMN plan SET DEFAULT 'trial';

-- SUBSCRIPTIONS (se existir a coluna)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'plan'
  ) THEN
    EXECUTE 'ALTER TABLE public.subscriptions ALTER COLUMN plan DROP DEFAULT';
    EXECUTE 'ALTER TABLE public.subscriptions ALTER COLUMN plan TYPE text USING plan::text';
    UPDATE public.subscriptions SET plan = CASE plan
      WHEN 'free'         THEN 'trial'
      WHEN 'basic'        THEN 'basico'
      WHEN 'professional' THEN 'avancado'
      WHEN 'enterprise'   THEN 'premium'
      ELSE plan
    END;
  END IF;
END $$;

COMMIT;
