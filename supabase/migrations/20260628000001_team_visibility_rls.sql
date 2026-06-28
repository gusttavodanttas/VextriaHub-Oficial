-- Migration: Visibilidade hierárquica por equipe (RLS)
-- Versão: 20260628000001
--
-- Modelo de visibilidade:
--   • Admin/dono do escritório (office_users.role in admin/super_admin) ou super_admin global → vê TUDO do escritório
--   • Coordenador → vê o conteúdo dele + de todos os membros das equipes que coordena
--   • Membro → vê somente o conteúdo do qual ele é responsável
--
-- "Responsável" por tabela:
--   processos    → user_id
--   tarefas      → coalesce(responsavel_id, user_id)
--   audiencias   → coalesce(responsavel_id, user_id)
--   atendimentos → coalesce(responsavel_id, user_id)
--   consultivos  → coalesce(responsavel_id, user_id)
--   prazos       → responsavel_id (auto-gerados sem responsável ficam só para admin)

BEGIN;

-- ========================================================
-- Funções auxiliares (SECURITY DEFINER evita recursão de RLS)
-- ========================================================

CREATE OR REPLACE FUNCTION public.is_office_admin(p_office_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.office_users
    WHERE office_id = p_office_id
      AND user_id = auth.uid()
      AND active = true
      AND role IN ('admin','super_admin')
  ) OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  );
$$;

-- Conjunto de user_ids que o usuário atual pode "ver":
--  • ele mesmo (sempre)
--  • todos os membros das equipes onde ele é coordenador
CREATE OR REPLACE FUNCTION public.team_visible_user_ids(p_office_id uuid)
RETURNS SETOF uuid LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT auth.uid()
  UNION
  SELECT otm.user_id
  FROM public.office_team_members coord
  JOIN public.office_team_members otm ON otm.team_id = coord.team_id
  WHERE coord.user_id = auth.uid()
    AND coord.role = 'coordinator'
    AND otm.office_id = p_office_id;
$$;

CREATE OR REPLACE FUNCTION public.user_belongs_to_office(p_office_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.office_users
    WHERE office_id = p_office_id AND user_id = auth.uid() AND active = true
  );
$$;

-- ========================================================
-- Helper: remove TODAS as policies de uma tabela
-- ========================================================
CREATE OR REPLACE FUNCTION public._drop_all_policies(p_table text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=p_table
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, p_table);
  END LOOP;
END $$;

-- ========================================================
-- PROCESSOS
-- ========================================================
SELECT public._drop_all_policies('processos');
ALTER TABLE public.processos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "processos_select" ON public.processos FOR SELECT USING (
  public.is_office_admin(office_id)
  OR user_id IN (SELECT public.team_visible_user_ids(office_id))
);
CREATE POLICY "processos_insert" ON public.processos FOR INSERT WITH CHECK (
  user_id = auth.uid()
  AND (office_id IS NULL OR public.user_belongs_to_office(office_id))
);
CREATE POLICY "processos_update" ON public.processos FOR UPDATE USING (
  public.is_office_admin(office_id)
  OR user_id IN (SELECT public.team_visible_user_ids(office_id))
);
CREATE POLICY "processos_delete" ON public.processos FOR DELETE USING (
  public.is_office_admin(office_id)
  OR user_id IN (SELECT public.team_visible_user_ids(office_id))
);

-- ========================================================
-- TAREFAS
-- ========================================================
SELECT public._drop_all_policies('tarefas');
ALTER TABLE public.tarefas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tarefas_select" ON public.tarefas FOR SELECT USING (
  public.is_office_admin(office_id)
  OR COALESCE(responsavel_id, user_id) IN (SELECT public.team_visible_user_ids(office_id))
);
CREATE POLICY "tarefas_insert" ON public.tarefas FOR INSERT WITH CHECK (
  user_id = auth.uid()
  AND (office_id IS NULL OR public.user_belongs_to_office(office_id))
);
CREATE POLICY "tarefas_update" ON public.tarefas FOR UPDATE USING (
  public.is_office_admin(office_id)
  OR COALESCE(responsavel_id, user_id) IN (SELECT public.team_visible_user_ids(office_id))
);
CREATE POLICY "tarefas_delete" ON public.tarefas FOR DELETE USING (
  public.is_office_admin(office_id)
  OR COALESCE(responsavel_id, user_id) IN (SELECT public.team_visible_user_ids(office_id))
);

-- ========================================================
-- AUDIENCIAS
-- ========================================================
SELECT public._drop_all_policies('audiencias');
ALTER TABLE public.audiencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audiencias_select" ON public.audiencias FOR SELECT USING (
  public.is_office_admin(office_id)
  OR COALESCE(responsavel_id, user_id) IN (SELECT public.team_visible_user_ids(office_id))
);
CREATE POLICY "audiencias_insert" ON public.audiencias FOR INSERT WITH CHECK (
  user_id = auth.uid()
  AND (office_id IS NULL OR public.user_belongs_to_office(office_id))
);
CREATE POLICY "audiencias_update" ON public.audiencias FOR UPDATE USING (
  public.is_office_admin(office_id)
  OR COALESCE(responsavel_id, user_id) IN (SELECT public.team_visible_user_ids(office_id))
);
CREATE POLICY "audiencias_delete" ON public.audiencias FOR DELETE USING (
  public.is_office_admin(office_id)
  OR COALESCE(responsavel_id, user_id) IN (SELECT public.team_visible_user_ids(office_id))
);

-- ========================================================
-- ATENDIMENTOS
-- ========================================================
SELECT public._drop_all_policies('atendimentos');
ALTER TABLE public.atendimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "atendimentos_select" ON public.atendimentos FOR SELECT USING (
  public.is_office_admin(office_id)
  OR COALESCE(responsavel_id, user_id) IN (SELECT public.team_visible_user_ids(office_id))
);
CREATE POLICY "atendimentos_insert" ON public.atendimentos FOR INSERT WITH CHECK (
  user_id = auth.uid()
  AND (office_id IS NULL OR public.user_belongs_to_office(office_id))
);
CREATE POLICY "atendimentos_update" ON public.atendimentos FOR UPDATE USING (
  public.is_office_admin(office_id)
  OR COALESCE(responsavel_id, user_id) IN (SELECT public.team_visible_user_ids(office_id))
);
CREATE POLICY "atendimentos_delete" ON public.atendimentos FOR DELETE USING (
  public.is_office_admin(office_id)
  OR COALESCE(responsavel_id, user_id) IN (SELECT public.team_visible_user_ids(office_id))
);

-- ========================================================
-- CONSULTIVOS
-- ========================================================
SELECT public._drop_all_policies('consultivos');
ALTER TABLE public.consultivos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "consultivos_select" ON public.consultivos FOR SELECT USING (
  public.is_office_admin(office_id)
  OR COALESCE(responsavel_id, user_id) IN (SELECT public.team_visible_user_ids(office_id))
);
CREATE POLICY "consultivos_insert" ON public.consultivos FOR INSERT WITH CHECK (
  user_id = auth.uid()
  AND (office_id IS NULL OR public.user_belongs_to_office(office_id))
);
CREATE POLICY "consultivos_update" ON public.consultivos FOR UPDATE USING (
  public.is_office_admin(office_id)
  OR COALESCE(responsavel_id, user_id) IN (SELECT public.team_visible_user_ids(office_id))
);
CREATE POLICY "consultivos_delete" ON public.consultivos FOR DELETE USING (
  public.is_office_admin(office_id)
  OR COALESCE(responsavel_id, user_id) IN (SELECT public.team_visible_user_ids(office_id))
);

-- ========================================================
-- PRAZOS (sem user_id; responsável = responsavel_id)
-- Prazos auto-gerados sem responsável ficam visíveis só para admin.
-- ========================================================
SELECT public._drop_all_policies('prazos');
ALTER TABLE public.prazos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prazos_select" ON public.prazos FOR SELECT USING (
  public.is_office_admin(office_id)
  OR responsavel_id IN (SELECT public.team_visible_user_ids(office_id))
);
CREATE POLICY "prazos_insert" ON public.prazos FOR INSERT WITH CHECK (
  office_id IS NULL OR public.user_belongs_to_office(office_id)
);
CREATE POLICY "prazos_update" ON public.prazos FOR UPDATE USING (
  public.is_office_admin(office_id)
  OR responsavel_id IN (SELECT public.team_visible_user_ids(office_id))
);
CREATE POLICY "prazos_delete" ON public.prazos FOR DELETE USING (
  public.is_office_admin(office_id)
  OR responsavel_id IN (SELECT public.team_visible_user_ids(office_id))
);

DROP FUNCTION public._drop_all_policies(text);

COMMIT;
