-- Blindagem das buscas externas (fetch-by-oab / fetch-processo):
-- 1) paywall (office_has_access), 2) OAB só do próprio escritório, 3) rate-limit por custo.
-- Chamada exclusivamente pelas edge functions via service_role.

create table if not exists public.process_search_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  office_id uuid,
  weight int not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists idx_process_search_log_user_time
  on public.process_search_log (user_id, created_at desc);

-- Tabela é interna (só a RPC SECURITY DEFINER escreve/lê). RLS ligada sem policy = nega acesso direto.
alter table public.process_search_log enable row level security;

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

  -- Paywall: mesma regra do gate (lifetime/ativa/cortesia/trial válido)
  select public.office_has_access(v_office) into v_has;
  if not coalesce(v_has, false) then
    return jsonb_build_object('ok', false, 'reason', 'no_access');
  end if;

  -- Escopo de OAB: a carteira buscada precisa pertencer a alguém do escritório.
  -- Graceful: se o escritório ainda não cadastrou NENHUMA OAB, libera (bootstrap).
  if length(v_oab_digits) > 0 then
    select exists(
      select 1 from public.profiles
      where office_id = v_office
        and regexp_replace(coalesce(oab, ''), '[^0-9]', '', 'g') = v_oab_digits
        and (p_uf is null or oab_uf is null or upper(oab_uf) = upper(p_uf))
    ) into v_oab_ok;
    if not v_oab_ok then
      select exists(
        select 1 from public.profiles
        where office_id = v_office
          and length(regexp_replace(coalesce(oab, ''), '[^0-9]', '', 'g')) > 0
      ) into v_office_has_any;
      if v_office_has_any then
        return jsonb_build_object('ok', false, 'reason', 'oab_not_in_office');
      end if;
    end if;
  end if;

  -- Rate-limit por custo (nacional pesa mais que 1 CNJ). Registra e soma janelas.
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

-- Só o service_role (edge functions) chama. Ninguém mais.
revoke execute on function public.authorize_process_search(uuid, text, text, int) from public, anon, authenticated;
