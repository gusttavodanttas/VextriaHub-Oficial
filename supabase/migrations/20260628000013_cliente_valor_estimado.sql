-- Migration: Valor estimado do negócio (lead/cliente) para o CRM
-- Versão: 20260628000013
--
-- Permite registrar o valor potencial do contrato, alimentando o
-- "Valor do Pipeline" real (antes era estimado por volume).

BEGIN;

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS valor_estimado numeric(15,2) DEFAULT 0;

COMMENT ON COLUMN public.clientes.valor_estimado IS 'Valor potencial do negócio (R$) usado no pipeline do CRM';

COMMIT;
