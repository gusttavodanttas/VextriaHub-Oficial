-- Migration: Apenas admin do escritório cria/edita/exclui equipes
-- Versão: 20260628000006
--
-- SELECT: qualquer membro do escritório vê as equipes.
-- INSERT/UPDATE/DELETE: somente admin/dono do escritório.

BEGIN;

CREATE OR REPLACE FUNCTION public._drop_all_policies(p_table text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=p_table
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, p_table); END LOOP;
END $$;

SELECT public._drop_all_policies('office_teams');
ALTER TABLE public.office_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "office_teams_select" ON public.office_teams FOR SELECT USING (
  public.user_belongs_to_office(office_id)
);
CREATE POLICY "office_teams_insert" ON public.office_teams FOR INSERT WITH CHECK (
  public.is_office_admin(office_id)
);
CREATE POLICY "office_teams_update" ON public.office_teams FOR UPDATE USING (
  public.is_office_admin(office_id)
);
CREATE POLICY "office_teams_delete" ON public.office_teams FOR DELETE USING (
  public.is_office_admin(office_id)
);

DROP FUNCTION public._drop_all_policies(text);

COMMIT;
