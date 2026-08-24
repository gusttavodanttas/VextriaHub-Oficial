-- Jornada do cliente (#11): o escritório nascia sem e-mail → o asaas-billing criava o
-- cliente no Asaas sem e-mail → recibos/lembretes do Asaas não chegavam ao cliente.
-- Passa a gravar o e-mail do dono na criação do office (e faz backfill dos existentes).
CREATE OR REPLACE FUNCTION public.ensure_office_for_user()
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  insert into public.offices (name, email, active, created_by)
  values ('Escritorio de ' || split_part(coalesce(nullif(trim(v_full_name),''), v_email, 'Novo'),' ',1),
          coalesce(v_email, v_auth_email), true, v_uid)
  returning id into v_office_id;
  insert into public.office_users (user_id, office_id, role, active, joined_at) values (v_uid, v_office_id, 'admin', true, now());
  update public.profiles set office_id = v_office_id, role = 'admin' where user_id = v_uid;
  return v_office_id;
end $function$;

-- Backfill: e-mail do admin ativo de cada escritório sem e-mail.
update public.offices o
   set email = (select u.email from public.office_users ou join auth.users u on u.id = ou.user_id
                where ou.office_id = o.id and ou.role = 'admin' and ou.active
                order by ou.joined_at limit 1)
 where o.email is null;
