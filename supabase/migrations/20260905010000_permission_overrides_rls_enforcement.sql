-- ============================================================================
-- Item D.1 do plano de acao (auditoria de front-end): os toggles de
-- "Permissoes" por membro (Equipe -> Permissoes) nao tinham efeito real -
-- nem a tela nem a RLS consultavam user_permissions.granted pra a maioria
-- das ~20 flags "Gerenciar"/"Excluir"/"Editar"/"Ver" por modulo. Confirmado
-- com dados reais: ja existem 8 overrides gravados (canEditAtendimentos,
-- canEditClients, canEditProcesses, canManageAgenda, canManageAudiencias,
-- canManagePrazos, canManageTarefas, canViewFinanceiro) que um admin
-- configurou pra um membro especifico e NUNCA fizeram diferenca nenhuma.
--
-- Padrao seguro: helper permission_override() so retorna algo quando existe
-- uma linha explicita em user_permissions; sem override, cai no DEFAULT
-- (allow pra flags narrow, deny pra flags widen) -- ou seja, ZERO mudanca de
-- comportamento pra qualquer membro que nunca teve um toggle mexido. So
-- passa a restringir/liberar de verdade a partir do momento em que um admin
-- efetivamente usa o toggle -- que e exatamente o que a tela sempre prometeu.
-- ============================================================================

create or replace function public.permission_override(p_office uuid, p_key text)
returns boolean language sql stable security definer set search_path = public as $$
  select granted from public.user_permissions
  where office_id = p_office and user_id = (select auth.uid()) and permission_key = p_key
  limit 1;
$$;
revoke execute on function public.permission_override(uuid, text) from public, anon, authenticated;
grant execute on function public.permission_override(uuid, text) to authenticated;

drop policy if exists "perm_select_clientes_canViewClients_narrow" on public.clientes;
create policy "perm_select_clientes_canViewClients_narrow" on public.clientes as restrictive for select using (coalesce(permission_override(office_id, 'canViewClients'), true));

drop policy if exists "perm_insert_clientes_canCreateClients_narrow" on public.clientes;
create policy "perm_insert_clientes_canCreateClients_narrow" on public.clientes as restrictive for insert with check (coalesce(permission_override(office_id, 'canCreateClients'), true));

drop policy if exists "perm_update_clientes_canEditClients_narrow" on public.clientes;
create policy "perm_update_clientes_canEditClients_narrow" on public.clientes as restrictive for update using (coalesce(permission_override(office_id, 'canEditClients'), true));

drop policy if exists "perm_delete_clientes_canDeleteClients_narrow" on public.clientes;
create policy "perm_delete_clientes_canDeleteClients_narrow" on public.clientes as restrictive for delete using (coalesce(permission_override(office_id, 'canDeleteClients'), true));

drop policy if exists "perm_select_processos_canViewProcesses_narrow" on public.processos;
create policy "perm_select_processos_canViewProcesses_narrow" on public.processos as restrictive for select using (coalesce(permission_override(office_id, 'canViewProcesses'), true));

drop policy if exists "perm_insert_processos_canCreateProcesses_narrow" on public.processos;
create policy "perm_insert_processos_canCreateProcesses_narrow" on public.processos as restrictive for insert with check (coalesce(permission_override(office_id, 'canCreateProcesses'), true));

drop policy if exists "perm_update_processos_canEditProcesses_narrow" on public.processos;
create policy "perm_update_processos_canEditProcesses_narrow" on public.processos as restrictive for update using (coalesce(permission_override(office_id, 'canEditProcesses'), true));

drop policy if exists "perm_delete_processos_canDeleteProcesses_narrow" on public.processos;
create policy "perm_delete_processos_canDeleteProcesses_narrow" on public.processos as restrictive for delete using (coalesce(permission_override(office_id, 'canDeleteProcesses'), true));

drop policy if exists "perm_select_atendimentos_canViewAtendimentos_narrow" on public.atendimentos;
create policy "perm_select_atendimentos_canViewAtendimentos_narrow" on public.atendimentos as restrictive for select using (coalesce(permission_override(office_id, 'canViewAtendimentos'), true));

drop policy if exists "perm_insert_atendimentos_canCreateAtendimentos_narrow" on public.atendimentos;
create policy "perm_insert_atendimentos_canCreateAtendimentos_narrow" on public.atendimentos as restrictive for insert with check (coalesce(permission_override(office_id, 'canCreateAtendimentos'), true));

drop policy if exists "perm_update_atendimentos_canEditAtendimentos_narrow" on public.atendimentos;
create policy "perm_update_atendimentos_canEditAtendimentos_narrow" on public.atendimentos as restrictive for update using (coalesce(permission_override(office_id, 'canEditAtendimentos'), true));

drop policy if exists "perm_delete_atendimentos_canDeleteAtendimentos_narrow" on public.atendimentos;
create policy "perm_delete_atendimentos_canDeleteAtendimentos_narrow" on public.atendimentos as restrictive for delete using (coalesce(permission_override(office_id, 'canDeleteAtendimentos'), true));

drop policy if exists "perm_insert_atendimentos_canManageAgenda_narrow" on public.atendimentos;
create policy "perm_insert_atendimentos_canManageAgenda_narrow" on public.atendimentos as restrictive for insert with check (coalesce(permission_override(office_id, 'canManageAgenda'), true));

drop policy if exists "perm_update_atendimentos_canManageAgenda_narrow" on public.atendimentos;
create policy "perm_update_atendimentos_canManageAgenda_narrow" on public.atendimentos as restrictive for update using (coalesce(permission_override(office_id, 'canManageAgenda'), true));

drop policy if exists "perm_select_financeiro_canViewFinanceiro_narrow" on public.financeiro;
create policy "perm_select_financeiro_canViewFinanceiro_narrow" on public.financeiro as restrictive for select using (coalesce(permission_override(office_id, 'canViewFinanceiro'), true));

drop policy if exists "perm_insert_financeiro_canManageFinanceiro_narrow" on public.financeiro;
create policy "perm_insert_financeiro_canManageFinanceiro_narrow" on public.financeiro as restrictive for insert with check (coalesce(permission_override(office_id, 'canManageFinanceiro'), true));

drop policy if exists "perm_update_financeiro_canManageFinanceiro_narrow" on public.financeiro;
create policy "perm_update_financeiro_canManageFinanceiro_narrow" on public.financeiro as restrictive for update using (coalesce(permission_override(office_id, 'canManageFinanceiro'), true));

drop policy if exists "perm_delete_financeiro_canManageFinanceiro_narrow" on public.financeiro;
create policy "perm_delete_financeiro_canManageFinanceiro_narrow" on public.financeiro as restrictive for delete using (coalesce(permission_override(office_id, 'canManageFinanceiro'), true));

drop policy if exists "perm_select_audiencias_canViewAudiencias_narrow" on public.audiencias;
create policy "perm_select_audiencias_canViewAudiencias_narrow" on public.audiencias as restrictive for select using (coalesce(permission_override(office_id, 'canViewAudiencias'), true));

drop policy if exists "perm_insert_audiencias_canManageAudiencias_narrow" on public.audiencias;
create policy "perm_insert_audiencias_canManageAudiencias_narrow" on public.audiencias as restrictive for insert with check (coalesce(permission_override(office_id, 'canManageAudiencias'), true));

drop policy if exists "perm_update_audiencias_canManageAudiencias_narrow" on public.audiencias;
create policy "perm_update_audiencias_canManageAudiencias_narrow" on public.audiencias as restrictive for update using (coalesce(permission_override(office_id, 'canManageAudiencias'), true));

drop policy if exists "perm_delete_audiencias_canManageAudiencias_narrow" on public.audiencias;
create policy "perm_delete_audiencias_canManageAudiencias_narrow" on public.audiencias as restrictive for delete using (coalesce(permission_override(office_id, 'canManageAudiencias'), true));

drop policy if exists "perm_select_tarefas_canViewTarefas_narrow" on public.tarefas;
create policy "perm_select_tarefas_canViewTarefas_narrow" on public.tarefas as restrictive for select using (coalesce(permission_override(office_id, 'canViewTarefas'), true));

drop policy if exists "perm_insert_tarefas_canManageTarefas_narrow" on public.tarefas;
create policy "perm_insert_tarefas_canManageTarefas_narrow" on public.tarefas as restrictive for insert with check (coalesce(permission_override(office_id, 'canManageTarefas'), true));

drop policy if exists "perm_update_tarefas_canManageTarefas_narrow" on public.tarefas;
create policy "perm_update_tarefas_canManageTarefas_narrow" on public.tarefas as restrictive for update using (coalesce(permission_override(office_id, 'canManageTarefas'), true));

drop policy if exists "perm_delete_tarefas_canManageTarefas_narrow" on public.tarefas;
create policy "perm_delete_tarefas_canManageTarefas_narrow" on public.tarefas as restrictive for delete using (coalesce(permission_override(office_id, 'canManageTarefas'), true));

drop policy if exists "perm_select_prazos_canViewPrazos_narrow" on public.prazos;
create policy "perm_select_prazos_canViewPrazos_narrow" on public.prazos as restrictive for select using (coalesce(permission_override(office_id, 'canViewPrazos'), true));

drop policy if exists "perm_insert_prazos_canManagePrazos_narrow" on public.prazos;
create policy "perm_insert_prazos_canManagePrazos_narrow" on public.prazos as restrictive for insert with check (coalesce(permission_override(office_id, 'canManagePrazos'), true));

drop policy if exists "perm_update_prazos_canManagePrazos_narrow" on public.prazos;
create policy "perm_update_prazos_canManagePrazos_narrow" on public.prazos as restrictive for update using (coalesce(permission_override(office_id, 'canManagePrazos'), true));

drop policy if exists "perm_delete_prazos_canManagePrazos_narrow" on public.prazos;
create policy "perm_delete_prazos_canManagePrazos_narrow" on public.prazos as restrictive for delete using (coalesce(permission_override(office_id, 'canManagePrazos'), true));

drop policy if exists "perm_select_consultivos_canViewConsultivo_narrow" on public.consultivos;
create policy "perm_select_consultivos_canViewConsultivo_narrow" on public.consultivos as restrictive for select using (coalesce(permission_override(office_id, 'canViewConsultivo'), true));

drop policy if exists "perm_insert_consultivos_canManageConsultivo_narrow" on public.consultivos;
create policy "perm_insert_consultivos_canManageConsultivo_narrow" on public.consultivos as restrictive for insert with check (coalesce(permission_override(office_id, 'canManageConsultivo'), true));

drop policy if exists "perm_update_consultivos_canManageConsultivo_narrow" on public.consultivos;
create policy "perm_update_consultivos_canManageConsultivo_narrow" on public.consultivos as restrictive for update using (coalesce(permission_override(office_id, 'canManageConsultivo'), true));

drop policy if exists "perm_delete_consultivos_canManageConsultivo_narrow" on public.consultivos;
create policy "perm_delete_consultivos_canManageConsultivo_narrow" on public.consultivos as restrictive for delete using (coalesce(permission_override(office_id, 'canManageConsultivo'), true));

drop policy if exists "perm_select_metas_canViewMetas_narrow" on public.metas;
create policy "perm_select_metas_canViewMetas_narrow" on public.metas as restrictive for select using (coalesce(permission_override(office_id, 'canViewMetas'), true));

drop policy if exists "perm_insert_metas_canManageMetas_narrow" on public.metas;
create policy "perm_insert_metas_canManageMetas_narrow" on public.metas as restrictive for insert with check (coalesce(permission_override(office_id, 'canManageMetas'), true));

drop policy if exists "perm_update_metas_canManageMetas_narrow" on public.metas;
create policy "perm_update_metas_canManageMetas_narrow" on public.metas as restrictive for update using (coalesce(permission_override(office_id, 'canManageMetas'), true));

drop policy if exists "perm_delete_metas_canManageMetas_narrow" on public.metas;
create policy "perm_delete_metas_canManageMetas_narrow" on public.metas as restrictive for delete using (coalesce(permission_override(office_id, 'canManageMetas'), true));

drop policy if exists "perm_insert_office_teams_canManageEquipe_widen" on public.office_teams;
create policy "perm_insert_office_teams_canManageEquipe_widen" on public.office_teams for insert with check (coalesce(permission_override(office_id, 'canManageEquipe'), false));

drop policy if exists "perm_update_office_teams_canManageEquipe_widen" on public.office_teams;
create policy "perm_update_office_teams_canManageEquipe_widen" on public.office_teams for update using (coalesce(permission_override(office_id, 'canManageEquipe'), false));

drop policy if exists "perm_delete_office_teams_canManageEquipe_widen" on public.office_teams;
create policy "perm_delete_office_teams_canManageEquipe_widen" on public.office_teams for delete using (coalesce(permission_override(office_id, 'canManageEquipe'), false));

drop policy if exists "perm_insert_invitations_canInviteUsers_widen" on public.invitations;
create policy "perm_insert_invitations_canInviteUsers_widen" on public.invitations for insert with check (coalesce(permission_override(office_id, 'canInviteUsers'), false));
