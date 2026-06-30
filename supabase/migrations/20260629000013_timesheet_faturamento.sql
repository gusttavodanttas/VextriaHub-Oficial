-- Faturamento no timesheet: valor/hora e marcação faturável.
alter table public.timesheets add column if not exists valor_hora numeric;
alter table public.timesheets add column if not exists faturavel boolean not null default true;
