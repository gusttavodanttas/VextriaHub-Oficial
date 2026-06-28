-- Migration: Responsável atribuível em processos
-- Versão: 20260628000004
--
-- Adiciona responsavel_id em processos (default = criador) e atualiza o RLS
-- para considerar o responsável: membro vê processos onde é o responsável,
-- coordenador vê os da equipe (por responsável OU team_id), admin vê tudo.

BEGIN;

ALTER TABLE public.processos
  ADD COLUMN IF NOT EXISTS responsavel_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Backfill: responsável = criador onde ainda não definido
UPDATE public.processos SET responsavel_id = user_id WHERE responsavel_id IS NULL;

-- Atualiza as policies de processos para usar COALESCE(responsavel_id, user_id)
DROP POLICY IF EXISTS "processos_select" ON public.processos;
DROP POLICY IF EXISTS "processos_update" ON public.processos;
DROP POLICY IF EXISTS "processos_delete" ON public.processos;

CREATE POLICY "processos_select" ON public.processos FOR SELECT USING (
  public.is_office_admin(office_id)
  OR COALESCE(responsavel_id, user_id) IN (SELECT public.team_visible_user_ids(office_id))
  OR team_id IN (SELECT public.coordinated_team_ids(office_id))
);
CREATE POLICY "processos_update" ON public.processos FOR UPDATE USING (
  public.is_office_admin(office_id)
  OR COALESCE(responsavel_id, user_id) IN (SELECT public.team_visible_user_ids(office_id))
  OR team_id IN (SELECT public.coordinated_team_ids(office_id))
);
CREATE POLICY "processos_delete" ON public.processos FOR DELETE USING (
  public.is_office_admin(office_id)
  OR COALESCE(responsavel_id, user_id) IN (SELECT public.team_visible_user_ids(office_id))
  OR team_id IN (SELECT public.coordinated_team_ids(office_id))
);

COMMIT;
