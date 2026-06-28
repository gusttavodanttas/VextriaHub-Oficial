-- Migration: Estende visibilidade hierárquica a clientes, publicações,
--            timesheets, metas e financeiro
-- Versão: 20260628000003
--
-- Mesmo modelo de 20260628000001:
--   admin → tudo | coordenador → dele + membros da equipe | membro → só os dele
--
-- Casos especiais:
--   clientes    → também visível se o cliente tem um processo que o usuário enxerga
--   publicacoes → visível se a publicação está vinculada a um processo que o
--                 usuário enxerga (cascata via RLS de processos). Sem vínculo → só admin.

BEGIN;

CREATE OR REPLACE FUNCTION public._drop_all_policies(p_table text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=p_table
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, p_table); END LOOP;
END $$;

-- ========================================================
-- CLIENTES (owner = user_id; + clientes de processos visíveis)
-- ========================================================
SELECT public._drop_all_policies('clientes');
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clientes_select" ON public.clientes FOR SELECT USING (
  public.is_office_admin(office_id)
  OR user_id IN (SELECT public.team_visible_user_ids(office_id))
  OR id IN (SELECT cliente_id FROM public.processos WHERE cliente_id IS NOT NULL)
);
CREATE POLICY "clientes_insert" ON public.clientes FOR INSERT WITH CHECK (
  user_id = auth.uid() AND (office_id IS NULL OR public.user_belongs_to_office(office_id))
);
CREATE POLICY "clientes_update" ON public.clientes FOR UPDATE USING (
  public.is_office_admin(office_id)
  OR user_id IN (SELECT public.team_visible_user_ids(office_id))
);
CREATE POLICY "clientes_delete" ON public.clientes FOR DELETE USING (
  public.is_office_admin(office_id)
  OR user_id IN (SELECT public.team_visible_user_ids(office_id))
);

-- ========================================================
-- PUBLICACOES (visível via processo vinculado; sem vínculo = só admin)
-- ========================================================
SELECT public._drop_all_policies('publicacoes');
ALTER TABLE public.publicacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "publicacoes_select" ON public.publicacoes FOR SELECT USING (
  public.is_office_admin(office_id)
  OR (processo_id IS NOT NULL AND processo_id IN (SELECT id FROM public.processos))
  OR (user_id IS NOT NULL AND user_id IN (SELECT public.team_visible_user_ids(office_id)))
);
CREATE POLICY "publicacoes_insert" ON public.publicacoes FOR INSERT WITH CHECK (
  office_id IS NULL OR public.user_belongs_to_office(office_id)
);
CREATE POLICY "publicacoes_update" ON public.publicacoes FOR UPDATE USING (
  public.is_office_admin(office_id)
  OR (processo_id IS NOT NULL AND processo_id IN (SELECT id FROM public.processos))
  OR (user_id IS NOT NULL AND user_id IN (SELECT public.team_visible_user_ids(office_id)))
);
CREATE POLICY "publicacoes_delete" ON public.publicacoes FOR DELETE USING (
  public.is_office_admin(office_id)
  OR (user_id IS NOT NULL AND user_id IN (SELECT public.team_visible_user_ids(office_id)))
);

-- ========================================================
-- TIMESHEETS (owner = user_id)
-- ========================================================
SELECT public._drop_all_policies('timesheets');
ALTER TABLE public.timesheets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "timesheets_select" ON public.timesheets FOR SELECT USING (
  public.is_office_admin(office_id)
  OR user_id IN (SELECT public.team_visible_user_ids(office_id))
);
CREATE POLICY "timesheets_insert" ON public.timesheets FOR INSERT WITH CHECK (
  user_id = auth.uid() AND (office_id IS NULL OR public.user_belongs_to_office(office_id))
);
CREATE POLICY "timesheets_update" ON public.timesheets FOR UPDATE USING (
  public.is_office_admin(office_id)
  OR user_id IN (SELECT public.team_visible_user_ids(office_id))
);
CREATE POLICY "timesheets_delete" ON public.timesheets FOR DELETE USING (
  public.is_office_admin(office_id)
  OR user_id IN (SELECT public.team_visible_user_ids(office_id))
);

-- ========================================================
-- METAS (owner = user_id)
-- ========================================================
SELECT public._drop_all_policies('metas');
ALTER TABLE public.metas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "metas_select" ON public.metas FOR SELECT USING (
  public.is_office_admin(office_id)
  OR user_id IN (SELECT public.team_visible_user_ids(office_id))
);
CREATE POLICY "metas_insert" ON public.metas FOR INSERT WITH CHECK (
  user_id = auth.uid() AND (office_id IS NULL OR public.user_belongs_to_office(office_id))
);
CREATE POLICY "metas_update" ON public.metas FOR UPDATE USING (
  public.is_office_admin(office_id)
  OR user_id IN (SELECT public.team_visible_user_ids(office_id))
);
CREATE POLICY "metas_delete" ON public.metas FOR DELETE USING (
  public.is_office_admin(office_id)
  OR user_id IN (SELECT public.team_visible_user_ids(office_id))
);

-- ========================================================
-- FINANCEIRO (owner = user_id)
-- ========================================================
SELECT public._drop_all_policies('financeiro');
ALTER TABLE public.financeiro ENABLE ROW LEVEL SECURITY;

CREATE POLICY "financeiro_select" ON public.financeiro FOR SELECT USING (
  public.is_office_admin(office_id)
  OR user_id IN (SELECT public.team_visible_user_ids(office_id))
);
CREATE POLICY "financeiro_insert" ON public.financeiro FOR INSERT WITH CHECK (
  user_id = auth.uid() AND (office_id IS NULL OR public.user_belongs_to_office(office_id))
);
CREATE POLICY "financeiro_update" ON public.financeiro FOR UPDATE USING (
  public.is_office_admin(office_id)
  OR user_id IN (SELECT public.team_visible_user_ids(office_id))
);
CREATE POLICY "financeiro_delete" ON public.financeiro FOR DELETE USING (
  public.is_office_admin(office_id)
  OR user_id IN (SELECT public.team_visible_user_ids(office_id))
);

DROP FUNCTION public._drop_all_policies(text);

COMMIT;
