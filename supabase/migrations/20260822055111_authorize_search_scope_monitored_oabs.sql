-- authorize_process_search v2: o escopo de OAB agora é a lista MONITORADA (curada pelo admin,
-- dentro do teto do plano), não mais qualquer OAB de perfil. Bootstrap: escritório sem nenhuma
-- OAB monitorada ainda pode buscar (paywall+rate-limit valem); ao cadastrar a 1ª, tranca na lista.
create or replace function public.authorize_process_search(
  p_user_id uuid,
  p_oab text,
  p_uf text,
  p_weight int default 1
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_office uuid;
  v_has boolean;
  v_oab_digits text := regexp_replace(coalesce(p_oab, ''), '[^0-9]', '', 'g');
  v_oab_ok boolean;
  v_office_has_any boolean;
  v_min bigint;
  v_day bigint;
begin
  select office_id into v_office from public.profiles where user_id = p_user_id limit 1;
  if v_office is null then
    return jsonb_build_object('ok', false, 'reason', 'no_office');
  end if;

  select public.office_has_access(v_office) into v_has;
  if not coalesce(v_has, false) then
    return jsonb_build_object('ok', false, 'reason', 'no_access');
  end if;

  -- Escopo: a OAB buscada precisa estar na lista de MONITORADAS do escritório.
  if length(v_oab_digits) > 0 then
    select exists(
      select 1 from public.monitored_oabs
      where office_id = v_office
        and regexp_replace(coalesce(oab, ''), '[^0-9]', '', 'g') = v_oab_digits
        and (p_uf is null or upper(uf) = upper(p_uf))
    ) into v_oab_ok;
    if not v_oab_ok then
      select exists(select 1 from public.monitored_oabs where office_id = v_office) into v_office_has_any;
      if v_office_has_any then
        return jsonb_build_object('ok', false, 'reason', 'oab_not_in_office');
      end if;
    end if;
  end if;

  insert into public.process_search_log(user_id, office_id, weight)
    values (p_user_id, v_office, greatest(coalesce(p_weight, 1), 1));

  select coalesce(sum(weight), 0) into v_min from public.process_search_log
    where user_id = p_user_id and created_at > now() - interval '1 minute';
  select coalesce(sum(weight), 0) into v_day from public.process_search_log
    where user_id = p_user_id and created_at > now() - interval '1 day';

  if v_min > 500 or v_day > 4000 then
    return jsonb_build_object('ok', false, 'reason', 'rate_limited');
  end if;

  return jsonb_build_object('ok', true, 'office_id', v_office);
end;
$$;

revoke execute on function public.authorize_process_search(uuid, text, text, int) from public, anon, authenticated;
