-- Prazo do consultivo: permite controlar por data e aparecer na agenda do dashboard.
-- Rode UMA VEZ no Supabase (SQL Editor).
alter table public.consultivos
  add column if not exists prazo date;
