-- "Avançado" e "Premium" tinham plan_type=ENTERPRISE duplicado → o setup (.maybeSingle) falhava
-- e bloqueava a assinatura desses 2 planos. Dá um plan_type único ao Premium.
update public.plan_configs set plan_type = 'PREMIUM'
where plan_name = 'Premium' and plan_type = 'ENTERPRISE';

-- Impede a reincidência: não pode haver 2 planos ATIVOS com o mesmo plan_type.
create unique index if not exists plan_configs_active_plan_type_uq
  on public.plan_configs (plan_type) where is_active;
