-- offices.plan/access_type (que o usePlanFeatures lê para os LIMITES do plano) ficavam presos
-- em 'trial' mesmo após o cliente assinar um plano pago (só office_subscriptions era atualizado)
-- → um pagante de Básico seria capado no limite do trial (10 processos). Este trigger mantém
-- offices.plan/access_type sempre coerentes com a assinatura real, cobrindo TODOS os caminhos
-- (webhook Asaas, self-serve, concessões do admin). O ACESSO continua gated por office_has_access;
-- aqui é só o tier que define limites. offices.plan é TEXT; offices.access_type é ENUM access_type
-- (trial | stripe_paid | lifetime | courtesy). Testado ao vivo: assinar Básico → plan=basico.
create or replace function public.sync_office_plan_from_subscription()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_plan text; v_access text; v_name text := lower(coalesce(new.plan_name, ''));
begin
  if new.is_lifetime then
    v_plan := 'premium'; v_access := 'lifetime';
  elsif new.status = 'cortesia' then
    v_plan := 'cortesia'; v_access := 'courtesy';
  elsif new.status = 'ativa' then
    v_plan := case
      when v_name like '%premium%' then 'premium'
      when v_name like '%avanç%' or v_name like '%avanc%' then 'avancado'
      when v_name like '%intermedi%' then 'intermediario'
      when v_name like '%básic%' or v_name like '%basic%' then 'basico'
      else 'basico' end;
    v_access := 'stripe_paid';
  else
    -- trial / pendente / atrasada / cancelada → limites de trial (acesso é gated à parte)
    v_plan := 'trial'; v_access := 'trial';
  end if;
  update public.offices
     set plan = v_plan, access_type = v_access::access_type
   where id = new.office_id
     and (plan is distinct from v_plan or access_type::text is distinct from v_access);
  return new;
end $function$;

drop trigger if exists trg_sync_office_plan on public.office_subscriptions;
create trigger trg_sync_office_plan
  after insert or update of status, is_lifetime, plan_name on public.office_subscriptions
  for each row execute function public.sync_office_plan_from_subscription();

-- Backfill: alinha os escritórios existentes ao estado atual da assinatura.
update public.offices o set
  plan = sub.v_plan, access_type = sub.v_access::access_type
from (
  select os.office_id,
    case
      when os.is_lifetime then 'premium'
      when os.status = 'cortesia' then 'cortesia'
      when os.status = 'ativa' then case
        when lower(os.plan_name) like '%premium%' then 'premium'
        when lower(os.plan_name) like '%avanç%' or lower(os.plan_name) like '%avanc%' then 'avancado'
        when lower(os.plan_name) like '%intermedi%' then 'intermediario'
        when lower(os.plan_name) like '%básic%' or lower(os.plan_name) like '%basic%' then 'basico'
        else 'basico' end
      else 'trial' end as v_plan,
    case
      when os.is_lifetime then 'lifetime'
      when os.status = 'cortesia' then 'courtesy'
      when os.status = 'ativa' then 'stripe_paid'
      else 'trial' end as v_access
  from public.office_subscriptions os
) sub
where sub.office_id = o.id
  and (o.plan is distinct from sub.v_plan or o.access_type::text is distinct from sub.v_access);
