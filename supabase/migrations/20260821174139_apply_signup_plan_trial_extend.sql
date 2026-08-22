-- Plano "so no cadastro" (escondido do checkout publico, usado so em link de cadastro).
alter table public.plan_configs
  add column if not exists signup_only boolean not null default false;

-- Garante que o plano do cadastro so e aplicado UMA vez por escritorio (anti-farm de trial).
alter table public.office_subscriptions
  add column if not exists plan_claimed boolean not null default false;

-- apply_signup_plan v2: retorna o desfecho ('trial'|'pendente') e agora HONRA trial_days>0
-- (trial estendido, ex.: 30 dias), mas SO na primeira vez (plan_claimed).
drop function if exists public.apply_signup_plan(text);
create function public.apply_signup_plan(p_plan_type text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_office uuid; v_trial int; v_name text; v_claimed boolean; v_status text;
begin
  if v_uid is null then raise exception 'sem usuario autenticado'; end if;
  select coalesce(
    (select office_id from public.profiles where user_id = v_uid),
    (select office_id from public.office_users where user_id = v_uid and active order by joined_at limit 1)
  ) into v_office;
  if v_office is null then return null; end if;

  select coalesce(trial_days, 0), plan_name into v_trial, v_name
    from public.plan_configs where plan_type = p_plan_type and is_active limit 1;
  if v_name is null then return null; end if;  -- plano desconhecido/inativo

  select coalesce(plan_claimed, false), status into v_claimed, v_status
    from public.office_subscriptions where office_id = v_office;

  -- Ja reivindicado: nao reaplica (impede reiniciar/farmar trial). Devolve o estado atual.
  if v_claimed then
    return case when v_status = 'pendente' then 'pendente' else 'trial' end;
  end if;

  update public.office_subscriptions s
     set plan_name     = v_name,
         status        = case when v_trial = 0 then 'pendente' else 'trial' end,
         trial_ends_at = case when v_trial = 0 then null else current_date + v_trial end,
         plan_claimed  = true,
         updated_at    = now()
   where s.office_id = v_office
     and coalesce(s.is_lifetime, false) = false
     and s.status in ('trial', 'pendente');

  return case when v_trial = 0 then 'pendente' else 'trial' end;
end $$;
grant execute on function public.apply_signup_plan(text) to authenticated;
