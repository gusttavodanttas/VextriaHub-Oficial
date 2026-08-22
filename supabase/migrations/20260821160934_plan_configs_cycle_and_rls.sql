-- Ciclo de cobrança por plano (mensal/semestral/anual). Asaas: MONTHLY/SEMIANNUALLY/YEARLY.
alter table public.plan_configs add column if not exists cycle text not null default 'MONTHLY';

-- Garante que o super-admin gerencia os planos (leitura livre p/ mostrar preços; escrita só super).
alter table public.plan_configs enable row level security;
drop policy if exists plan_configs_read on public.plan_configs;
create policy plan_configs_read on public.plan_configs for select using (true);
drop policy if exists plan_configs_write on public.plan_configs;
create policy plan_configs_write on public.plan_configs for all
  using (public.is_super_admin()) with check (public.is_super_admin());
