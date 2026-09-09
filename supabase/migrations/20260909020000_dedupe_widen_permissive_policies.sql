-- Fecha os 16 avisos de "multiple permissive policies" introduzidos de proposito
-- pela parte 6 (D.1): cada tabela tinha a policy admin-only original MAIS a
-- policy "widen" (canManageEquipe/canInviteUsers) como PERMISSIVE separada pra
-- mesma acao -- policies PERMISSIVE ja se somam por OR, entao consolidar as
-- duas condicoes numa policy so' e' by-construction identico (OR e' associativo).

drop policy if exists "inv_insert" on public.invitations;
drop policy if exists "perm_insert_invitations_canInviteUsers_widen" on public.invitations;
create policy "inv_insert" on public.invitations for insert
  with check (is_super_admin() OR is_office_admin(office_id) OR coalesce(permission_override(office_id, 'canInviteUsers'), false));

drop policy if exists "office_teams_insert" on public.office_teams;
drop policy if exists "perm_insert_office_teams_canManageEquipe_widen" on public.office_teams;
create policy "office_teams_insert" on public.office_teams for insert
  with check (is_office_admin(office_id) OR coalesce(permission_override(office_id, 'canManageEquipe'), false));

drop policy if exists "office_teams_update" on public.office_teams;
drop policy if exists "perm_update_office_teams_canManageEquipe_widen" on public.office_teams;
create policy "office_teams_update" on public.office_teams for update
  using (is_office_admin(office_id) OR coalesce(permission_override(office_id, 'canManageEquipe'), false));

drop policy if exists "office_teams_delete" on public.office_teams;
drop policy if exists "perm_delete_office_teams_canManageEquipe_widen" on public.office_teams;
create policy "office_teams_delete" on public.office_teams for delete
  using (is_office_admin(office_id) OR coalesce(permission_override(office_id, 'canManageEquipe'), false));
