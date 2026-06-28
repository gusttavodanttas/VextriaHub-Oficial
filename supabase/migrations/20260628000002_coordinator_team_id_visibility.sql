-- Migration: Coordenador enxerga processos atribuídos às equipes que coordena
-- Versão: 20260628000002
--
-- Complementa 20260628000001: além de ver por responsável (user_id), o
-- coordenador passa a ver também processos cujo team_id pertence a uma
-- equipe que ele coordena. Membro comum continua vendo só os dele.

BEGIN;

-- Equipes que o usuário atual COORDENA no escritório
CREATE OR REPLACE FUNCTION public.coordinated_team_ids(p_office_id uuid)
RETURNS SETOF uuid LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT team_id FROM public.office_team_members
  WHERE user_id = auth.uid() AND role = 'coordinator' AND office_id = p_office_id;
$$;

DROP POLICY IF EXISTS "processos_select" ON public.processos;
DROP POLICY IF EXISTS "processos_update" ON public.processos;
DROP POLICY IF EXISTS "processos_delete" ON public.processos;

CREATE POLICY "processos_select" ON public.processos FOR SELECT USING (
  public.is_office_admin(office_id)
  OR user_id IN (SELECT public.team_visible_user_ids(office_id))
  OR team_id IN (SELECT public.coordinated_team_ids(office_id))
);
CREATE POLICY "processos_update" ON public.processos FOR UPDATE USING (
  public.is_office_admin(office_id)
  OR user_id IN (SELECT public.team_visible_user_ids(office_id))
  OR team_id IN (SELECT public.coordinated_team_ids(office_id))
);
CREATE POLICY "processos_delete" ON public.processos FOR DELETE USING (
  public.is_office_admin(office_id)
  OR user_id IN (SELECT public.team_visible_user_ids(office_id))
  OR team_id IN (SELECT public.coordinated_team_ids(office_id))
);

COMMIT;
