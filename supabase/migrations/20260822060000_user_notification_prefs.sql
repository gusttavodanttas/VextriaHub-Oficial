-- Preferências de notificação POR USUÁRIO (antes só em localStorage → não sincronizava
-- entre dispositivos e sumia ao limpar o cache). prefs = jsonb {prazos,audiencias,tarefas,
-- atendimentos,financeiro}; lead_dias = antecedência padrão dos avisos.
create table if not exists public.user_notification_prefs (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  prefs      jsonb   not null default '{}'::jsonb,
  lead_dias  integer not null default 3,
  updated_at timestamptz not null default now()
);

alter table public.user_notification_prefs enable row level security;

-- Cada usuário só enxerga/gerencia as PRÓPRIAS preferências.
drop policy if exists "unp_select_own" on public.user_notification_prefs;
create policy "unp_select_own" on public.user_notification_prefs
  for select using (user_id = auth.uid());

drop policy if exists "unp_insert_own" on public.user_notification_prefs;
create policy "unp_insert_own" on public.user_notification_prefs
  for insert with check (user_id = auth.uid());

drop policy if exists "unp_update_own" on public.user_notification_prefs;
create policy "unp_update_own" on public.user_notification_prefs
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
