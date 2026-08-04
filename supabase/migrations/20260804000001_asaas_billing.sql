-- Cobrança via Asaas, POR ESCRITÓRIO. Substitui o Stripe.
-- Fonte-da-verdade do acesso: office_subscriptions.status + office_has_access().
-- Escrita só por service_role (edge functions asaas-billing / asaas-webhook).
-- Aplicar via SQL Editor.

-- 1) assinatura por escritório (1 linha por office)
create table if not exists public.office_subscriptions (
  office_id             uuid primary key references public.offices(id) on delete cascade,
  asaas_customer_id     text,
  asaas_subscription_id text,
  plan_name             text,
  value                 numeric(10,2) not null default 0,
  cycle                 text not null default 'MONTHLY',          -- MONTHLY | YEARLY ...
  billing_type          text not null default 'UNDEFINED',        -- BOLETO | PIX | CREDIT_CARD | UNDEFINED
  status                text not null default 'trial',            -- trial | ativa | pendente | atrasada | cancelada | cortesia
  trial_ends_at         date,
  next_due_date         date,
  last_invoice_url      text,
  is_lifetime           boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- 2) log de eventos do webhook do Asaas
create table if not exists public.billing_events (
  id                    uuid primary key default gen_random_uuid(),
  office_id             uuid,
  asaas_payment_id      text,
  asaas_subscription_id text,
  event                 text,
  status                text,
  value                 numeric(10,2),
  due_date              date,
  invoice_url           text,
  raw                   jsonb,
  created_at            timestamptz not null default now()
);

-- 3) acesso autoritativo do escritório (server-side; usado pelo front e, no futuro, pela RLS)
create or replace function public.office_has_access(p_office uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select s.is_lifetime
        or s.status in ('ativa','cortesia')
        or (s.status = 'trial' and (s.trial_ends_at is null or s.trial_ends_at >= current_date))
    from public.office_subscriptions s
    where s.office_id = p_office
  ), false);
$$;

-- 4) todo escritório NOVO nasce com 7 dias de trial
create or replace function public.office_start_trial()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.office_subscriptions (office_id, status, trial_ends_at, plan_name)
  values (new.id, 'trial', current_date + 7, 'Trial')
  on conflict (office_id) do nothing;
  return new;
end;
$$;
drop trigger if exists trg_office_start_trial on public.offices;
create trigger trg_office_start_trial
  after insert on public.offices
  for each row execute function public.office_start_trial();

-- 5) escritórios JÁ existentes entram como cortesia (não bloquear ninguém na migração;
--    o super admin converte para pago depois, no painel de Cobrança)
insert into public.office_subscriptions (office_id, status, plan_name)
select id, 'cortesia', 'Migrado' from public.offices
on conflict (office_id) do nothing;

-- 6) RLS: membro vê a assinatura do próprio escritório; super_admin vê tudo. Escrita só service_role.
alter table public.office_subscriptions enable row level security;
alter table public.billing_events enable row level security;

drop policy if exists office_subscriptions_select on public.office_subscriptions;
create policy office_subscriptions_select on public.office_subscriptions
  for select to authenticated
  using (public.user_belongs_to_office(office_id) or public.is_super_admin());

drop policy if exists billing_events_select on public.billing_events;
create policy billing_events_select on public.billing_events
  for select to authenticated
  using (public.is_super_admin());

grant execute on function public.office_has_access(uuid) to authenticated;
