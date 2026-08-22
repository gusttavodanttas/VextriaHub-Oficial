-- Suporte a desconto manual do super-admin no office_subscriptions (fonte da verdade da cobrança).
-- base_value guarda o valor cheio para o desconto ser idempotente (sempre calculado a partir da base).
alter table public.office_subscriptions
  add column if not exists manual_discount_percent numeric not null default 0,
  add column if not exists base_value numeric;
