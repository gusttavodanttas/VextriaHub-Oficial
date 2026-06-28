-- Migration: Campo de resultado/desfecho do processo
-- Versão: 20260628000010
--
-- Permite registrar o desfecho do processo (ganho, acordo, perda, etc.)
-- para alimentar o KPI de "Resultado dos processos".

BEGIN;

ALTER TABLE public.processos
  ADD COLUMN IF NOT EXISTS resultado text;

-- Valores sugeridos (texto livre, validado na aplicação):
--   ganho      → Procedente / Ganho
--   parcial    → Parcialmente procedente
--   acordo     → Acordo / Conciliação
--   perda      → Improcedente / Perda
--   extinto    → Extinto sem mérito
--   (null)     → Sem desfecho definido

COMMENT ON COLUMN public.processos.resultado IS 'Desfecho do processo: ganho|parcial|acordo|perda|extinto';

COMMIT;
