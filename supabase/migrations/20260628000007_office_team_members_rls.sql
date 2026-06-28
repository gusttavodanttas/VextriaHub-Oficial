-- Migration: RLS de office_team_members (admin + coordenador gerenciam)
-- Versão: 20260628000007
--
-- SELECT: qualquer membro do escritório vê as composições de equipe.
-- INSERT/UPDATE/DELETE: admin do escritório OU coordenador da própria equipe.

BEGIN;

CREATE OR REPLACE FUNCTION public._drop_all_policies(p_table text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=p_table
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, p_table); END LOOP;
END $$;

SELECT public._drop_all_policies('office_team_members');
ALTER TABLE public.office_team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "otm_select" ON public.office_team_members FOR SELECT USING (
  public.user_belongs_to_office(office_id)
);
CREATE POLICY "otm_insert" ON public.office_team_members FOR INSERT WITH CHECK (
  public.is_office_admin(office_id)
  OR team_id IN (SELECT public.coordinated_team_ids(office_id))
);
CREATE POLICY "otm_update" ON public.office_team_members FOR UPDATE USING (
  public.is_office_admin(office_id)
  OR team_id IN (SELECT public.coordinated_team_ids(office_id))
);
CREATE POLICY "otm_delete" ON public.office_team_members FOR DELETE USING (
  public.is_office_admin(office_id)
  OR team_id IN (SELECT public.coordinated_team_ids(office_id))
);

DROP FUNCTION public._drop_all_policies(text);

COMMIT;
