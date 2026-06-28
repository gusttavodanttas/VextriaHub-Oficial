-- Migration: Processo de equipe sem membro responsável → responsável = coordenador
-- Versão: 20260628000005
--
-- Regra: quando um processo pertence a uma equipe (team_id) e o responsável
-- atual NÃO é membro dessa equipe, o responsável passa a ser o coordenador
-- da equipe. Assim, enquanto o coordenador não delega a um membro, o processo
-- fica sob responsabilidade dele.

BEGIN;

-- Trigger que aplica a regra em INSERT/UPDATE
CREATE OR REPLACE FUNCTION public.processo_default_responsavel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE coord uuid;
BEGIN
  IF NEW.team_id IS NOT NULL THEN
    -- Se o responsável não for membro da equipe, cai para o coordenador
    IF NEW.responsavel_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.office_team_members m
      WHERE m.team_id = NEW.team_id AND m.user_id = NEW.responsavel_id
    ) THEN
      SELECT user_id INTO coord FROM public.office_team_members
      WHERE team_id = NEW.team_id AND role = 'coordinator'
      LIMIT 1;
      IF coord IS NOT NULL THEN
        NEW.responsavel_id := coord;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_processo_default_responsavel ON public.processos;
CREATE TRIGGER trg_processo_default_responsavel
  BEFORE INSERT OR UPDATE OF team_id, responsavel_id ON public.processos
  FOR EACH ROW EXECUTE FUNCTION public.processo_default_responsavel();

-- Backfill dos processos existentes de equipes
UPDATE public.processos p
SET responsavel_id = (
  SELECT user_id FROM public.office_team_members
  WHERE team_id = p.team_id AND role = 'coordinator' LIMIT 1
)
WHERE p.team_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.office_team_members c
    WHERE c.team_id = p.team_id AND c.role = 'coordinator'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.office_team_members m
    WHERE m.team_id = p.team_id AND m.user_id = p.responsavel_id
  );

COMMIT;
