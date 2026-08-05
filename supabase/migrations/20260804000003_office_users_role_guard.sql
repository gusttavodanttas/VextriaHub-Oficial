-- Fecha a auto-promoção em office_users: as policies de insert/update checavam
-- só o escritório (office_id = ANY(get_user_office_ids())), sem o PAPEL — então
-- um membro comum podia inserir/atualizar linhas do próprio escritório e virar
-- admin. Agora exige super_admin OU admin/owner do escritório (is_office_admin).
--
-- Fluxos legítimos NÃO quebram: dono novo (ensure_office_for_user), convite e
-- create-team-member gravam via SECURITY DEFINER / service_role, que IGNORAM RLS.
-- Aplicar via SQL Editor.

drop policy if exists "office_users_insert" on public.office_users;
drop policy if exists "office_users_update" on public.office_users;

create policy "office_users_insert" on public.office_users
  for insert to authenticated
  with check (public.is_super_admin() or public.is_office_admin(office_id));

create policy "office_users_update" on public.office_users
  for update to authenticated
  using (public.is_super_admin() or public.is_office_admin(office_id))
  with check (public.is_super_admin() or public.is_office_admin(office_id));
