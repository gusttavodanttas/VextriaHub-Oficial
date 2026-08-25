-- MEDIUM (v11): offices_update_admin deixava o admin do escritório dar UPDATE em QUALQUER
-- coluna de offices, sem restrição. Como o create-team-member confia em offices.max_users
-- para o limite de assentos, um admin fazia `update offices set max_users = 9999` e furava o
-- limite do plano (feature paga). Idem para plan/access_type/active (escalada de privilégio).
-- Correção: trigger BEFORE UPDATE que barra alteração das colunas de plano/cobrança/acesso por
-- quem NÃO é super_admin — espelha o protect_profile_privileges. Admin segue editando o PERFIL
-- do escritório (nome/email/telefone/endereço/logo/settings). Backend (service_role/postgres,
-- ex.: sync_office_plan_from_subscription que é SECURITY DEFINER owned by postgres) passa livre.
create or replace function public.protect_office_privileges()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  -- Backend (service_role/postgres/supabase_admin) e super_admin alteram tudo.
  if current_user in ('postgres','service_role','supabase_admin')
     or coalesce(auth.jwt() ->> 'role','') = 'service_role'
     or public.is_super_admin() then
    return new;
  end if;
  -- Colunas de plano/cobrança/acesso são intocáveis pelo admin do escritório.
  if new.max_users        is distinct from old.max_users         then raise exception 'Alteração de max_users não autorizada'; end if;
  if new.plan             is distinct from old.plan              then raise exception 'Alteração de plano não autorizada'; end if;
  if new.access_type      is distinct from old.access_type       then raise exception 'Alteração de access_type não autorizada'; end if;
  if new.access_granted_by is distinct from old.access_granted_by then raise exception 'Alteração de concessão de acesso não autorizada'; end if;
  if new.access_granted_at is distinct from old.access_granted_at then raise exception 'Alteração de concessão de acesso não autorizada'; end if;
  if new.access_note      is distinct from old.access_note       then raise exception 'Alteração de nota de acesso não autorizada'; end if;
  if new.active           is distinct from old.active            then raise exception 'Alteração de status ativo não autorizada'; end if;
  if new.created_by       is distinct from old.created_by        then raise exception 'Alteração de proprietário não autorizada'; end if;
  return new;
end; $function$;

drop trigger if exists trg_protect_office_privileges on public.offices;
create trigger trg_protect_office_privileges
  before update on public.offices
  for each row execute function public.protect_office_privileges();
