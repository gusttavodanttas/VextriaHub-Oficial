-- Migration: Data de encerramento dedicada (preenchida automaticamente)
-- Versão: 20260628000011
--
-- Cria data_encerramento e a preenche quando o status vira 'encerrado'
-- (e limpa se o processo for reaberto). Torna o cálculo de duração preciso.

BEGIN;

ALTER TABLE public.processos
  ADD COLUMN IF NOT EXISTS data_encerramento date;

CREATE OR REPLACE FUNCTION public.set_data_encerramento()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'encerrado' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'encerrado') THEN
    IF NEW.data_encerramento IS NULL THEN
      NEW.data_encerramento := CURRENT_DATE;
    END IF;
  ELSIF NEW.status IS DISTINCT FROM 'encerrado' THEN
    NEW.data_encerramento := NULL;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_set_data_encerramento ON public.processos;
CREATE TRIGGER trg_set_data_encerramento
  BEFORE INSERT OR UPDATE OF status ON public.processos
  FOR EACH ROW EXECUTE FUNCTION public.set_data_encerramento();

-- Backfill dos já encerrados
UPDATE public.processos
SET data_encerramento = COALESCE(data_ultima_atualizacao, updated_at::date)
WHERE status = 'encerrado' AND data_encerramento IS NULL;

COMMIT;
