-- Wire de convite: fecha o multi-tenant. A UI já cria convites (invitations) e o
-- trigger auto_accept_invitation já marca como aceito quando alguém entra em
-- office_users — mas FALTAVA o elo: quando o convidado se cadastra, ninguém o
-- vinculava ao escritório do convite (a ensure_office_for_user criava um
-- escritório NOVO pra ele, errado).
--
-- Esta versão da ensure_office_for_user, ANTES de criar escritório de dono novo,
-- procura convite pendente (não expirado) pelo email → entra NESSE escritório com
-- o role do convite. O trigger auto_accept_invitation então marca o convite aceito.
-- Aplicar via SQL Editor. Sem mudança de front (a criação de convite já existe).

create or replace function public.ensure_office_for_user()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid           uuid := auth.uid();
  v_role          text;
  v_full_name     text;
  v_email         text;
  v_office_id     uuid;
  v_invite_office uuid;
  v_invite_role   app_role;
begin
  if v_uid is null then
    raise exception 'ensure_office_for_user: sem usuário autenticado';
  end if;

  select role::text, full_name, email
    into v_role, v_full_name, v_email
  from public.profiles where user_id = v_uid;

  -- super_admin não tem escritório
  if v_role = 'super_admin' then
    return null;
  end if;

  -- já tem escritório? (profiles primeiro, office_users fallback) → idempotente
  v_office_id := coalesce(
    (select office_id from public.profiles where user_id = v_uid),
    (select office_id from public.office_users
       where user_id = v_uid and active order by joined_at limit 1)
  );
  if v_office_id is not null then
    update public.profiles set office_id = v_office_id
     where user_id = v_uid and office_id is distinct from v_office_id;
    return v_office_id;
  end if;

  -- CONVITE: convite pendente e não expirado pro email → entra NESSE escritório
  select office_id, role into v_invite_office, v_invite_role
  from public.invitations
  where lower(email) = lower(v_email)
    and status = 'pending'
    and (expires_at is null or expires_at > now())
  order by created_at desc
  limit 1;

  if v_invite_office is not null then
    insert into public.office_users (user_id, office_id, role, active, joined_at)
    values (v_uid, v_invite_office, coalesce(v_invite_role, 'user'::app_role), true, now());
    update public.profiles set office_id = v_invite_office where user_id = v_uid;
    -- trigger auto_accept_invitation marca o convite como 'accepted'
    return v_invite_office;
  end if;

  -- DONO NOVO: sem escritório e sem convite → cria o próprio escritório
  insert into public.offices (name, active, created_by)
  values (
    'Escritório de ' || split_part(coalesce(nullif(trim(v_full_name), ''), v_email, 'Novo'), ' ', 1),
    true, v_uid
  )
  returning id into v_office_id;

  insert into public.office_users (user_id, office_id, role, active, joined_at)
  values (v_uid, v_office_id, 'admin', true, now());

  update public.profiles set office_id = v_office_id where user_id = v_uid;

  return v_office_id;
end;
$$;

grant execute on function public.ensure_office_for_user() to authenticated;
