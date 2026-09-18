-- Timesheet não tinha nenhum conceito de permissão por membro (nem no tipo
-- FeaturePermissions, nem na RLS) — mesmo padrão de canManageTarefas/
-- canManagePrazos/canManageAudiencias/canManageAgenda (Parte 6), nunca
-- implementado para esta tabela. A visibilidade por time (team_visible_user_ids)
-- já limitava o acesso; isto adiciona a camada de override por membro, no
-- mesmo molde: RESTRICTIVE + coalesce(permission_override(...), true) — sem
-- override configurado, nada muda pra ninguém.
create policy "perm_select_timesheets_canViewTimesheet_narrow" on public.timesheets
  as restrictive for select
  using (coalesce(permission_override(office_id, 'canViewTimesheet'), true));

create policy "perm_insert_timesheets_canManageTimesheet_narrow" on public.timesheets
  as restrictive for insert
  with check (coalesce(permission_override(office_id, 'canManageTimesheet'), true));

create policy "perm_update_timesheets_canManageTimesheet_narrow" on public.timesheets
  as restrictive for update
  using (coalesce(permission_override(office_id, 'canManageTimesheet'), true));

create policy "perm_delete_timesheets_canManageTimesheet_narrow" on public.timesheets
  as restrictive for delete
  using (coalesce(permission_override(office_id, 'canManageTimesheet'), true));
