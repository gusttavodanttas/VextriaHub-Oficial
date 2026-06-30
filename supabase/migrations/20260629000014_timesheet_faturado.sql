-- Controle de faturamento: marca registros de timesheet já cobrados e liga ao lançamento financeiro.
alter table public.timesheets add column if not exists faturado boolean not null default false;
alter table public.timesheets add column if not exists faturado_em timestamptz;
alter table public.timesheets add column if not exists financeiro_id uuid;
