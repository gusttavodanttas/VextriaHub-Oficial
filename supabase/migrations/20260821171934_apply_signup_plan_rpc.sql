-- Registra, no cadastro via link de plano, qual plano o cliente escolheu.
-- Se o plano nao tem trial (trial_days=0), REMOVE o teste (status=pendente) para exigir
-- pagamento imediato. Nunca estende/reinicia o trial e nunca toca em assinatura
-- pagante/cortesia/vitalicio -> seguro contra abuso.
create or replace function public.apply_signup_plan(p_plan_type text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_office uuid;
  v_trial int;
  v_name text;
begin
  if v_uid is null then raise exception 'sem usuario autenticado'; end if;
  select coalesce(
    (select office_id from public.profiles where user_id = v_uid),
    (select office_id from public.office_users where user_id = v_uid and active order by joined_at limit 1)
  ) into v_office;
  if v_office is null then return; end if;

  select coalesce(trial_days, 0), plan_name into v_trial, v_name
    from public.plan_configs where plan_type = p_plan_type and is_active limit 1;
  if v_name is null then return; end if;  -- plano desconhecido: nao faz nada

  update public.office_subscriptions s
     set plan_name     = v_name,
         status        = case when v_trial = 0 then 'pendente' else s.status end,
         trial_ends_at = case when v_trial = 0 then null else s.trial_ends_at end,
         updated_at    = now()
   where s.office_id = v_office
     and s.status in ('trial', 'pendente')
     and coalesce(s.is_lifetime, false) = false;
end $$;

grant execute on function public.apply_signup_plan(text) to authenticated;
