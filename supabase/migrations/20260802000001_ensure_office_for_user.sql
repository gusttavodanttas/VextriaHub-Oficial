-- Raiz do achado #1 (multi-tenant): a criação do escritório era feita no
-- navegador (createProfile), de forma não-atômica e frágil — se falhasse, o
-- usuário ficava sem escritório e nada consertava. Nada setava profiles.office_id
-- de forma confiável (auto_accept_invitation só mexe em invitations).
--
-- Esta RPC centraliza no banco, atômica e IDEMPOTENTE. Chamada no login:
--   - super_admin: sem escritório (vê tudo) → retorna null.
--   - já tem escritório (profiles OU office_users): sincroniza profiles.office_id
--     e retorna — no-op seguro. Também AUTO-REPARA quem ficou sem o campo.
--   - dono novo sem escritório: cria offices + office_users(admin) + seta
--     profiles.office_id, tudo na mesma transação.
--
-- NÃO trata convite (membro entrando em escritório existente): hoje o admin
-- provisiona via office_users ANTES do 1º login do membro, então a checagem de
-- "já tem escritório" cobre esse caso. Wire completo de convite fica p/ depois.

create or replace function public.ensure_office_for_user()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_role      text;
  v_full_name text;
  v_email     text;
  v_office_id uuid;
begin
  if v_uid is null then
    raise exception 'ensure_office_for_user: sem usuário autenticado';
  end if;

  select role::text, full_name, email
    into v_role, v_full_name, v_email
  from public.profiles
  where user_id = v_uid;

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
    update public.profiles
       set office_id = v_office_id
     where user_id = v_uid and office_id is distinct from v_office_id;
    return v_office_id;
  end if;

  -- dono novo: cria escritório + vínculo admin + seta profiles.office_id
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
