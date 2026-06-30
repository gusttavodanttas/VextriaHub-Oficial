-- Antecedências de aviso por item também para atendimentos agendados.
alter table public.atendimentos add column if not exists avisos_dias integer[];
