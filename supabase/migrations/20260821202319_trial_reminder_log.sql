-- Registro de avisos de fim de trial ja enviados (evita repetir o mesmo aviso).
-- Chaveado por (office, marco, data-fim) para que um trial estendido gere novos avisos.
create table if not exists public.trial_reminder_log (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id) on delete cascade,
  kind text not null,                 -- 'd3' | 'd1'
  trial_ends_at date not null,
  sent_at timestamptz not null default now(),
  unique (office_id, kind, trial_ends_at)
);
-- RLS ligada e SEM policies: so o service_role (edge function) acessa; ninguem do client le.
alter table public.trial_reminder_log enable row level security;
