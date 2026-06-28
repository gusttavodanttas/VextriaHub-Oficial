-- Migration: Metas por equipe
-- Versão: 20260628000012
--
-- Adiciona team_id em metas. Meta com team_id é uma meta da equipe
-- (progresso somado entre os membros). Sem team_id = meta individual.

BEGIN;

ALTER TABLE public.metas
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.office_teams(id) ON DELETE SET NULL;

COMMIT;
