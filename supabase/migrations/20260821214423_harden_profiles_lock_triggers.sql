-- (1) Guard de role no INSERT de profiles: um usuario so cria o proprio profile como 'user'.
--     super_admin e concedido apenas pelo handle_new_user (SECURITY DEFINER, bypassa RLS).
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (auth.uid() = user_id and (role = 'user' or public.is_super_admin()));

-- (2) Advisory lock em ensure_office_for_user: serializa chamadas concorrentes do MESMO
--     usuario (Register + AuthContext em paralelo) -> impede criar 2 escritorios pro mesmo dono.
create or replace function public.ensure_office_for_user()
 returns uuid language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid(); v_auth_email text := auth.email();
  v_role text; v_full_name text; v_email text; v_office_id uuid;
  v_invite_office uuid; v_invite_role app_role;
begin
  if v_uid is null then raise exception 'sem usuario autenticado'; end if;
  perform pg_advisory_xact_lock(hashtext('ensure_office:' || v_uid::text));
  select role::text, full_name, email into v_role, v_full_name, v_email from public.profiles where user_id = v_uid;
  if v_role = 'super_admin' then return null; end if;
  v_office_id := coalesce((select office_id from public.profiles where user_id = v_uid),
    (select office_id from public.office_users where user_id = v_uid and active order by joined_at limit 1));
  if v_office_id is not null then
    update public.profiles set office_id = v_office_id where user_id = v_uid and office_id is distinct from v_office_id;
    return v_office_id;
  end if;
  if v_auth_email is not null then
    select office_id, role into v_invite_office, v_invite_role from public.invitations
    where lower(email) = lower(v_auth_email) and status = 'pending' and (expires_at is null or expires_at > now())
    order by created_at desc limit 1;
  end if;
  if v_invite_office is not null then
    insert into public.office_users (user_id, office_id, role, active, joined_at)
    values (v_uid, v_invite_office, coalesce(v_invite_role,'user'::app_role), true, now());
    update public.profiles set office_id = v_invite_office where user_id = v_uid;
    return v_invite_office;
  end if;
  insert into public.offices (name, active, created_by)
  values ('Escritorio de ' || split_part(coalesce(nullif(trim(v_full_name),''), v_email, 'Novo'),' ',1), true, v_uid)
  returning id into v_office_id;
  insert into public.office_users (user_id, office_id, role, active, joined_at) values (v_uid, v_office_id, 'admin', true, now());
  update public.profiles set office_id = v_office_id, role = 'admin' where user_id = v_uid;
  return v_office_id;
end $function$;

-- (3) Revoga EXECUTE das funcoes de TRIGGER (nao devem ser chamaveis via RPC /rpc/...).
--     Triggers seguem funcionando normalmente (independe de grant de EXECUTE).
do $harden$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prorettype = 'pg_catalog.trigger'::regtype
  loop
    execute format('revoke execute on function %s from anon, authenticated', r.sig);
  end loop;
end $harden$;
