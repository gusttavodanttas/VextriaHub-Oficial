-- Excluir escritório apaga as contas dos membros (auth.users); FKs "actor" (created_by/invited_by/
-- granted_by/changed_by/aprovado_por) sem ON DELETE bloqueavam. SET NULL: o registro fica, sem o autor.
alter table public.exclusoes_pendentes drop constraint exclusoes_pendentes_aprovado_por_fkey,
  add constraint exclusoes_pendentes_aprovado_por_fkey foreign key (aprovado_por) references auth.users(id) on delete set null;
alter table public.invitations drop constraint invitations_invited_by_fkey,
  add constraint invitations_invited_by_fkey foreign key (invited_by) references auth.users(id) on delete set null;
alter table public.office_access_changes drop constraint office_access_changes_changed_by_fkey,
  add constraint office_access_changes_changed_by_fkey foreign key (changed_by) references auth.users(id) on delete set null;
alter table public.office_users drop constraint office_users_invited_by_fkey,
  add constraint office_users_invited_by_fkey foreign key (invited_by) references auth.users(id) on delete set null;
alter table public.offices drop constraint offices_access_granted_by_fkey,
  add constraint offices_access_granted_by_fkey foreign key (access_granted_by) references auth.users(id) on delete set null;
alter table public.offices drop constraint offices_created_by_fkey,
  add constraint offices_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;
