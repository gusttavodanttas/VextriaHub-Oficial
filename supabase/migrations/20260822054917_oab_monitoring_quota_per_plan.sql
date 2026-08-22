-- Limite de OABs MONITORADAS por plano (feature: monitorar só a OAB do admin
-- + as que ele cadastrar, até o teto do plano). Espelha o modelo "nomes para captura" da Astrea.

-- 1) Teto por plano (editável na tela de Planos). Semente escada 1·3·5·10 por tier.
alter table public.plan_configs add column if not exists max_oabs int not null default 1;
update public.plan_configs set max_oabs = 1  where plan_type like 'BASIC%'      or plan_type like 'B_SICO%';
update public.plan_configs set max_oabs = 3  where plan_type like 'PRO%';
update public.plan_configs set max_oabs = 5  where plan_type like 'ENTERPRISE%';
update public.plan_configs set max_oabs = 10 where plan_type like 'PREMIUM%';

-- 2) OABs que o escritório escolheu monitorar (curadas pelo admin)
create table if not exists public.monitored_oabs (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id) on delete cascade,
  oab text not null,
  uf text not null,
  label text,                         -- nome do advogado (opcional)
  user_id uuid,                       -- se a OAB é de um usuário do sistema (opcional)
  added_by uuid,
  created_at timestamptz not null default now()
);
create unique index if not exists monitored_oabs_office_oab_uq
  on public.monitored_oabs (office_id, (regexp_replace(coalesce(oab,''),'[^0-9]','','g')), upper(uf));
create index if not exists idx_monitored_oabs_office on public.monitored_oabs(office_id);

alter table public.monitored_oabs enable row level security;
drop policy if exists monitored_oabs_select on public.monitored_oabs;
create policy monitored_oabs_select on public.monitored_oabs
  for select using (office_id = any(public.get_user_office_ids()) or public.is_super_admin());
drop policy if exists monitored_oabs_write on public.monitored_oabs;
create policy monitored_oabs_write on public.monitored_oabs
  for all
  using (public.is_office_admin(office_id) or public.is_super_admin())
  with check (public.is_office_admin(office_id) or public.is_super_admin());

-- 3) Teto efetivo do escritório: cortesia/vitalício = generoso; senão o do plano
--    (match exato do plano ativo; rede por palavra-chave do tier p/ plan_name livre/trial).
create or replace function public.office_oab_limit(p_office uuid)
returns int
language plpgsql stable security definer set search_path = public
as $$
declare v_name text; v_life boolean; v_status text; v_limit int;
begin
  select plan_name, coalesce(is_lifetime,false), coalesce(status,'')
    into v_name, v_life, v_status
  from public.office_subscriptions where office_id = p_office;

  if not found then return 1; end if;
  if v_life or v_status = 'cortesia' then return 9999; end if;

  select max(max_oabs) into v_limit from public.plan_configs
    where plan_name = v_name and is_active;
  if v_limit is not null then return v_limit; end if;

  return case
    when v_name ilike '%premium%' then 10
    when v_name ilike '%avan%'    then 5
    when v_name ilike '%interm%'  then 3
    else 1
  end;
end $$;
revoke execute on function public.office_oab_limit(uuid) from public, anon, authenticated;

-- 4) Trava de cota no INSERT (não passa do teto)
create or replace function public.enforce_oab_quota()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_count int; v_limit int;
begin
  select count(*) into v_count from public.monitored_oabs where office_id = new.office_id;
  select public.office_oab_limit(new.office_id) into v_limit;
  if v_count >= v_limit then
    raise exception 'Limite de OABs do plano atingido (% de %). Faça upgrade para monitorar mais.', v_count, v_limit
      using errcode = 'check_violation';
  end if;
  return new;
end $$;
revoke execute on function public.enforce_oab_quota() from public, anon, authenticated;
drop trigger if exists trg_enforce_oab_quota on public.monitored_oabs;
create trigger trg_enforce_oab_quota before insert on public.monitored_oabs
  for each row execute function public.enforce_oab_quota();

-- 5) Cota atual do escritório do usuário (p/ a UI mostrar "X de Y")
create or replace function public.my_oab_quota()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'limit', public.office_oab_limit(x.o),
    'used',  (select count(*) from public.monitored_oabs where office_id = x.o)
  )
  from (select office_id as o from public.profiles where user_id = auth.uid() limit 1) x;
$$;
grant execute on function public.my_oab_quota() to authenticated;

-- 6) Semear: cada escritório passa a monitorar a OAB do seu ADMIN (o resto deixa de ser
--    auto-monitorado). Pega o admin ativo mais antigo com OAB preenchida.
insert into public.monitored_oabs (office_id, oab, uf, label, user_id, added_by)
select distinct on (ou.office_id)
       ou.office_id, p.oab, p.oab_uf, coalesce(p.full_name, p.email), p.user_id, p.user_id
from public.office_users ou
join public.profiles p on p.user_id = ou.user_id
where ou.role = 'admin' and ou.active
  and p.oab is not null and p.oab_uf is not null
  and length(regexp_replace(p.oab,'[^0-9]','','g')) > 0
order by ou.office_id, ou.joined_at
on conflict do nothing;
