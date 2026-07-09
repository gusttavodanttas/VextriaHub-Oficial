-- SEGURANÇA (crítico): impede escalada de privilégio via UPDATE em profiles.
--
-- Problema: a policy "Usuários podem atualizar seu próprio perfil" permite o
-- usuário atualizar a própria linha INTEIRA — inclusive a coluna `role`.
-- Qualquer autenticado podia rodar update({ role: 'super_admin' }) em si mesmo
-- e ganhar acesso total (as policies de super admin e as edge functions
-- administrativas confiam em profiles.role).
--
-- Correção em duas partes, idempotente:
--   1) Trigger BEFORE UPDATE que só deixa `role` mudar se o EXECUTOR já for
--      super_admin (ou service_role/postgres — rotinas administrativas).
--   2) Função is_super_admin() SECURITY DEFINER e recriação da policy de
--      super admin sem subquery recursiva em profiles.

-- 1) Guarda da coluna role
create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Rotinas administrativas (edge functions com service key, SQL Editor) passam
  if current_user in ('postgres', 'service_role', 'supabase_admin')
     or coalesce(auth.jwt() ->> 'role', '') = 'service_role' then
    return new;
  end if;

  if new.role is distinct from old.role then
    if not exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid() and p.role = 'super_admin'
    ) then
      raise exception 'Alteração de papel (role) não autorizada';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_protect_profile_privileges on public.profiles;
create trigger trg_protect_profile_privileges
  before update on public.profiles
  for each row
  execute function public.protect_profile_privileges();

-- 2) Checagem de super admin sem recursão de policy
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid() and role = 'super_admin'
  );
$$;

drop policy if exists "SuperAdmin total access profiles" on public.profiles;
create policy "SuperAdmin total access profiles"
on public.profiles
for all
to authenticated
using (public.is_super_admin());
