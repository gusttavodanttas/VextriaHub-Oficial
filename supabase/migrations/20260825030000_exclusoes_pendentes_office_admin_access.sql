-- Libera o painel de "Solicitações de Exclusão" para o admin do escritório (antes só super_admin).
-- Escopo ESTRITO: cada admin só enxerga e só aprova/rejeita exclusões do PRÓPRIO escritório
-- (is_office_admin(office_id)). Super_admin segue com acesso total pelas policies existentes
-- (excl_select_admin / excl_update_admin). Policies PERMISSIVE somam por OR, então isto amplia
-- sem afrouxar o que já havia. O hook useExclusoesPendentes passou a liberar isOfficeAdmin também.
create policy excl_select_office_admin on public.exclusoes_pendentes
  for select using (public.is_office_admin(office_id));

create policy excl_update_office_admin on public.exclusoes_pendentes
  for update using (public.is_office_admin(office_id))
  with check (public.is_office_admin(office_id));
