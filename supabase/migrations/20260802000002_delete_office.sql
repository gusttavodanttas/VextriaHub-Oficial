-- Exclusão definitiva de escritório (super-admin), em cascata e atômica.
-- A plataforma só tinha "suspender" (active=false); não havia como REMOVER um
-- escritório/contas — gap de limpeza (teste/spam/churn) e de LGPD (direito de
-- exclusão). Esta RPC purga tudo de um escritório numa única transação.
--
-- Camadas de segurança: (1) só super_admin; (2) confirmação por nome; (3) atômica
-- (qualquer erro faz rollback — nada fica meio-apagado). Aplicar via SQL Editor.

create or replace function public.delete_office(p_office_id uuid, p_confirm_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role text;
  v_office_name text;
  v_user_ids    uuid[];
  r record;
begin
  -- 1) só super_admin executa
  select role::text into v_caller_role from public.profiles where user_id = auth.uid();
  if v_caller_role is distinct from 'super_admin' then
    raise exception 'Apenas super_admin pode excluir escritório';
  end if;

  -- 2) confirmação: o nome digitado tem que bater com o do escritório
  select name into v_office_name from public.offices where id = p_office_id;
  if v_office_name is null then
    raise exception 'Escritório não encontrado';
  end if;
  if btrim(coalesce(p_confirm_name, '')) is distinct from btrim(v_office_name) then
    raise exception 'Confirmação incorreta: o nome não confere';
  end if;

  -- 3) membros do escritório (office_users + quem aponta via profiles.office_id)
  select coalesce(array_agg(distinct uid) filter (where uid is not null), array[]::uuid[])
    into v_user_ids
  from (
    select user_id as uid from public.office_users where office_id = p_office_id
    union
    select user_id       from public.profiles     where office_id = p_office_id
  ) s;

  -- 4) apaga tudo que referencia o OFFICE (dinâmico — pega dados + seeds + vínculos)
  for r in
    select table_name from information_schema.columns
    where table_schema = 'public' and column_name = 'office_id' and table_name <> 'offices'
  loop
    execute format('delete from public.%I where office_id = $1', r.table_name) using p_office_id;
  end loop;

  -- 5) apaga tudo que referencia os MEMBROS (dinâmico — inclui profiles)
  if array_length(v_user_ids, 1) > 0 then
    for r in
      select table_name from information_schema.columns
      where table_schema = 'public' and column_name = 'user_id'
    loop
      execute format('delete from public.%I where user_id = any($1)', r.table_name) using v_user_ids;
    end loop;
  end if;

  -- 6) o escritório
  delete from public.offices where id = p_office_id;

  -- 7) as contas de login (auth) dos membros
  if array_length(v_user_ids, 1) > 0 then
    delete from auth.users where id = any(v_user_ids);
  end if;

  return jsonb_build_object(
    'ok', true,
    'office', v_office_name,
    'users_removed', coalesce(array_length(v_user_ids, 1), 0)
  );
end;
$$;

revoke all on function public.delete_office(uuid, text) from public, anon;
grant execute on function public.delete_office(uuid, text) to authenticated;
