-- =============================================================================
-- FIX: infinite recursion in RLS policies
-- Usa funções SECURITY DEFINER para quebrar a recursão
-- =============================================================================

-- Funções auxiliares (SECURITY DEFINER = executam como dono, bypassam RLS)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'super_admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_office_ids()
RETURNS UUID[] LANGUAGE sql SECURITY DEFINER STABLE SET search_path = 'public' AS $$
  SELECT ARRAY(
    SELECT office_id FROM public.office_users WHERE user_id = auth.uid() AND active = true
  )
$$;

-- =============================================================================
-- profiles: remover política auto-referencial
-- =============================================================================
DROP POLICY IF EXISTS "profiles_super_admin" ON public.profiles;
-- A política select_own já permite ler o próprio perfil — suficiente.
-- Super admin acessa perfis de outros via função abaixo:
CREATE POLICY "profiles_select_admin" ON public.profiles FOR SELECT
  USING (public.is_super_admin());

-- =============================================================================
-- office_users: remover auto-referência
-- =============================================================================
DROP POLICY IF EXISTS "office_users_select" ON public.office_users;
DROP POLICY IF EXISTS "office_users_insert" ON public.office_users;
DROP POLICY IF EXISTS "office_users_update" ON public.office_users;

CREATE POLICY "office_users_select" ON public.office_users FOR SELECT USING (
  user_id = auth.uid() OR
  office_id = ANY(public.get_user_office_ids()) OR
  public.is_super_admin()
);
CREATE POLICY "office_users_insert" ON public.office_users FOR INSERT WITH CHECK (
  public.is_super_admin() OR office_id = ANY(public.get_user_office_ids())
);
CREATE POLICY "office_users_update" ON public.office_users FOR UPDATE USING (
  public.is_super_admin() OR office_id = ANY(public.get_user_office_ids())
);

-- =============================================================================
-- offices
-- =============================================================================
DROP POLICY IF EXISTS "offices_select_super"  ON public.offices;
DROP POLICY IF EXISTS "offices_select_member" ON public.offices;
DROP POLICY IF EXISTS "offices_update_admin"  ON public.offices;

CREATE POLICY "offices_select_super"  ON public.offices FOR SELECT USING (public.is_super_admin());
CREATE POLICY "offices_select_member" ON public.offices FOR SELECT USING (
  id = ANY(public.get_user_office_ids())
);
CREATE POLICY "offices_update_admin"  ON public.offices FOR UPDATE USING (
  public.is_super_admin() OR id = ANY(public.get_user_office_ids())
);

-- =============================================================================
-- subscriptions
-- =============================================================================
DROP POLICY IF EXISTS "subs_select_super"  ON public.subscriptions;
DROP POLICY IF EXISTS "subs_select_member" ON public.subscriptions;
DROP POLICY IF EXISTS "subs_manage_super"  ON public.subscriptions;

CREATE POLICY "subs_select_super"  ON public.subscriptions FOR SELECT USING (public.is_super_admin());
CREATE POLICY "subs_select_member" ON public.subscriptions FOR SELECT USING (
  office_id = ANY(public.get_user_office_ids())
);
CREATE POLICY "subs_manage_super"  ON public.subscriptions FOR ALL USING (public.is_super_admin());

-- =============================================================================
-- invitations
-- =============================================================================
DROP POLICY IF EXISTS "inv_select" ON public.invitations;
DROP POLICY IF EXISTS "inv_insert" ON public.invitations;
DROP POLICY IF EXISTS "inv_update" ON public.invitations;

CREATE POLICY "inv_select" ON public.invitations FOR SELECT USING (
  email = auth.email() OR office_id = ANY(public.get_user_office_ids()) OR public.is_super_admin()
);
CREATE POLICY "inv_insert" ON public.invitations FOR INSERT WITH CHECK (
  office_id = ANY(public.get_user_office_ids()) OR public.is_super_admin()
);
CREATE POLICY "inv_update" ON public.invitations FOR UPDATE USING (
  email = auth.email() OR public.is_super_admin()
);

-- =============================================================================
-- clientes
-- =============================================================================
DROP POLICY IF EXISTS "clientes_select" ON public.clientes;
DROP POLICY IF EXISTS "clientes_update" ON public.clientes;

CREATE POLICY "clientes_select" ON public.clientes FOR SELECT USING (
  deletado = false AND (auth.uid() = user_id OR office_id = ANY(public.get_user_office_ids()))
);
CREATE POLICY "clientes_update" ON public.clientes FOR UPDATE USING (
  auth.uid() = user_id OR office_id = ANY(public.get_user_office_ids())
);

-- =============================================================================
-- processos
-- =============================================================================
DROP POLICY IF EXISTS "processos_select" ON public.processos;
DROP POLICY IF EXISTS "processos_update" ON public.processos;

CREATE POLICY "processos_select" ON public.processos FOR SELECT USING (
  deletado = false AND (auth.uid() = user_id OR office_id = ANY(public.get_user_office_ids()))
);
CREATE POLICY "processos_update" ON public.processos FOR UPDATE USING (
  auth.uid() = user_id OR office_id = ANY(public.get_user_office_ids())
);

-- =============================================================================
-- audiencias
-- =============================================================================
DROP POLICY IF EXISTS "audiencias_select" ON public.audiencias;
CREATE POLICY "audiencias_select" ON public.audiencias FOR SELECT USING (
  deletado = false AND (auth.uid() = user_id OR office_id = ANY(public.get_user_office_ids()))
);

-- =============================================================================
-- tarefas
-- =============================================================================
DROP POLICY IF EXISTS "tarefas_select" ON public.tarefas;
CREATE POLICY "tarefas_select" ON public.tarefas FOR SELECT USING (
  deletado = false AND (auth.uid() = user_id OR office_id = ANY(public.get_user_office_ids()))
);

-- =============================================================================
-- atendimentos
-- =============================================================================
DROP POLICY IF EXISTS "atendimentos_select" ON public.atendimentos;
CREATE POLICY "atendimentos_select" ON public.atendimentos FOR SELECT USING (
  deletado = false AND (auth.uid() = user_id OR office_id = ANY(public.get_user_office_ids()))
);

-- =============================================================================
-- metas
-- =============================================================================
DROP POLICY IF EXISTS "metas_select" ON public.metas;
CREATE POLICY "metas_select" ON public.metas FOR SELECT USING (
  deletado = false AND (auth.uid() = user_id OR office_id = ANY(public.get_user_office_ids()))
);

-- =============================================================================
-- financeiro
-- =============================================================================
DROP POLICY IF EXISTS "financeiro_select" ON public.financeiro;
CREATE POLICY "financeiro_select" ON public.financeiro FOR SELECT USING (
  deletado = false AND (auth.uid() = user_id OR office_id = ANY(public.get_user_office_ids()))
);

-- =============================================================================
-- publicacoes
-- =============================================================================
DROP POLICY IF EXISTS "pub_select" ON public.publicacoes;
DROP POLICY IF EXISTS "pub_insert" ON public.publicacoes;
DROP POLICY IF EXISTS "pub_update" ON public.publicacoes;
DROP POLICY IF EXISTS "pub_delete" ON public.publicacoes;

CREATE POLICY "pub_select" ON public.publicacoes FOR SELECT USING (
  office_id = ANY(public.get_user_office_ids()) OR public.is_super_admin()
);
CREATE POLICY "pub_insert" ON public.publicacoes FOR INSERT WITH CHECK (
  office_id = ANY(public.get_user_office_ids())
);
CREATE POLICY "pub_update" ON public.publicacoes FOR UPDATE USING (
  office_id = ANY(public.get_user_office_ids())
);
CREATE POLICY "pub_delete" ON public.publicacoes FOR DELETE USING (public.is_super_admin());

-- =============================================================================
-- monitoramento_termos
-- =============================================================================
DROP POLICY IF EXISTS "mon_select" ON public.monitoramento_termos;
DROP POLICY IF EXISTS "mon_insert" ON public.monitoramento_termos;
DROP POLICY IF EXISTS "mon_update" ON public.monitoramento_termos;

CREATE POLICY "mon_select" ON public.monitoramento_termos FOR SELECT USING (
  office_id = ANY(public.get_user_office_ids())
);
CREATE POLICY "mon_insert" ON public.monitoramento_termos FOR INSERT WITH CHECK (
  office_id = ANY(public.get_user_office_ids())
);
CREATE POLICY "mon_update" ON public.monitoramento_termos FOR UPDATE USING (
  office_id = ANY(public.get_user_office_ids())
);

-- =============================================================================
-- prazos
-- =============================================================================
DROP POLICY IF EXISTS "prazos_select" ON public.prazos;
DROP POLICY IF EXISTS "prazos_insert" ON public.prazos;
DROP POLICY IF EXISTS "prazos_update" ON public.prazos;

CREATE POLICY "prazos_select" ON public.prazos FOR SELECT USING (
  office_id = ANY(public.get_user_office_ids())
);
CREATE POLICY "prazos_insert" ON public.prazos FOR INSERT WITH CHECK (
  office_id = ANY(public.get_user_office_ids())
);
CREATE POLICY "prazos_update" ON public.prazos FOR UPDATE USING (
  office_id = ANY(public.get_user_office_ids())
);

-- =============================================================================
-- exclusoes_pendentes
-- =============================================================================
DROP POLICY IF EXISTS "excl_select_admin" ON public.exclusoes_pendentes;
DROP POLICY IF EXISTS "excl_update_admin" ON public.exclusoes_pendentes;

CREATE POLICY "excl_select_admin" ON public.exclusoes_pendentes FOR SELECT USING (public.is_super_admin());
CREATE POLICY "excl_update_admin" ON public.exclusoes_pendentes FOR UPDATE USING (public.is_super_admin());

-- =============================================================================
-- plan_configs / office_access_changes
-- =============================================================================
DROP POLICY IF EXISTS "plans_manage_admin"   ON public.plan_configs;
DROP POLICY IF EXISTS "access_changes_select" ON public.office_access_changes;

CREATE POLICY "plans_manage_admin"    ON public.plan_configs          FOR ALL    USING (public.is_super_admin());
CREATE POLICY "access_changes_select" ON public.office_access_changes FOR SELECT USING (public.is_super_admin());
