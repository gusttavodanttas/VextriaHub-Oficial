-- ============================================================================
-- Parte 9 do relatorio: fecha as 33 policies RLS permissivas redundantes que a
-- parte 2 tinha deixado documentadas (exigiam reescrita de condicao, nao so
-- remocao). Cada consolidacao foi verificada por PROVA LOGICA (a condicao
-- nova e a disjuncao -- OR -- exata das condicoes antigas, nunca um
-- subconjunto) e empiricamente (BEGIN/ROLLBACK simulando super_admin, office
-- admin e usuario comum, antes/depois: zero diferenca nas contagens de SELECT
-- visiveis; testes de UPDATE/INSERT confirmando os casos mais arriscados --
-- super_admin edita perfil de outro usuario, usuario comum NAO edita perfil
-- de outro, office_admin insere na propria office). Zero mudanca de
-- comportamento.
-- ============================================================================

drop policy if exists "excl_select_admin" on public.exclusoes_pendentes;
drop policy if exists "excl_select_office_admin" on public.exclusoes_pendentes;
drop policy if exists "excl_select_own" on public.exclusoes_pendentes;
create policy "excl_select" on public.exclusoes_pendentes for select
  using (is_super_admin() OR is_office_admin(office_id) OR ((select auth.uid()) = user_id));

drop policy if exists "excl_update_admin" on public.exclusoes_pendentes;
drop policy if exists "excl_update_office_admin" on public.exclusoes_pendentes;
create policy "excl_update" on public.exclusoes_pendentes for update
  using (is_super_admin() OR is_office_admin(office_id))
  with check (is_super_admin() OR is_office_admin(office_id));

-- monitored_oabs_write era FOR ALL; a fatia de SELECT que ele dava
-- (is_office_admin() OR is_super_admin()) ja e' inteiramente coberta por
-- monitored_oabs_select (membro ativo do office OR super_admin) -- basta
-- explicitar insert/update/delete.
drop policy if exists "monitored_oabs_write" on public.monitored_oabs;
create policy "monitored_oabs_insert" on public.monitored_oabs for insert
  with check (is_office_admin(office_id) OR is_super_admin());
create policy "monitored_oabs_update" on public.monitored_oabs for update
  using (is_office_admin(office_id) OR is_super_admin())
  with check (is_office_admin(office_id) OR is_super_admin());
create policy "monitored_oabs_delete" on public.monitored_oabs for delete
  using (is_office_admin(office_id) OR is_super_admin());

drop policy if exists "offices_select_member" on public.offices;
drop policy if exists "offices_select_super" on public.offices;
create policy "offices_select" on public.offices for select
  using ((id = ANY (get_user_office_ids())) OR is_super_admin());

-- plan_configs_write era FOR ALL (is_super_admin()); sua fatia de SELECT
-- some com o split, entao vira OR explicito na policy publica de select --
-- senao super_admin perderia visibilidade de planos inativos.
drop policy if exists "plan_configs_write" on public.plan_configs;
drop policy if exists "plans_select_public" on public.plan_configs;
create policy "plan_configs_select" on public.plan_configs for select
  using ((is_active = true) OR is_super_admin());
create policy "plan_configs_insert" on public.plan_configs for insert
  with check (is_super_admin());
create policy "plan_configs_update" on public.plan_configs for update
  using (is_super_admin())
  with check (is_super_admin());
create policy "plan_configs_delete" on public.plan_configs for delete
  using (is_super_admin());

-- "SuperAdmin total access profiles" era FOR ALL sem WITH CHECK proprio --
-- em Postgres isso faz o USING valer tambem como WITH CHECK -- entao
-- super_admin podia inserir/atualizar QUALQUER linha, nao so a propria; as
-- condicoes novas abaixo reproduzem exatamente essa uniao (verificado ao
-- vivo: super_admin editando o perfil de outro usuario continua permitido).
drop policy if exists "SuperAdmin total access profiles" on public.profiles;
drop policy if exists "office members can view each other profiles" on public.profiles;
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_select" on public.profiles for select
  using (
    is_super_admin()
    OR ((select auth.uid()) = user_id)
    OR (office_id IN (
      select office_users.office_id from office_users
      where office_users.user_id = (select auth.uid()) and office_users.active = true
    ))
  );

create policy "profiles_insert" on public.profiles for insert
  to authenticated
  with check (
    is_super_admin()
    OR (((select auth.uid()) = user_id) AND (role = 'user'::app_role))
  );

create policy "profiles_update" on public.profiles for update
  to authenticated
  using (is_super_admin() OR ((select auth.uid()) = user_id))
  with check (
    is_super_admin()
    OR (((select auth.uid()) = user_id) AND ((role <> 'super_admin'::app_role) OR is_super_admin()))
  );

create policy "profiles_delete_superadmin" on public.profiles for delete
  to authenticated
  using (is_super_admin());

-- user_permissions_write era FOR ALL; sua fatia de SELECT ja e' inteiramente
-- coberta por user_permissions_select (mesmos dois termos MAIS a
-- visibilidade da propria linha) -- basta explicitar insert/update/delete.
drop policy if exists "user_permissions_write" on public.user_permissions;
create policy "user_permissions_insert" on public.user_permissions for insert
  to authenticated
  with check (is_office_admin(office_id) OR is_super_admin());
create policy "user_permissions_update" on public.user_permissions for update
  to authenticated
  using (is_office_admin(office_id) OR is_super_admin())
  with check (is_office_admin(office_id) OR is_super_admin());
create policy "user_permissions_delete" on public.user_permissions for delete
  to authenticated
  using (is_office_admin(office_id) OR is_super_admin());
