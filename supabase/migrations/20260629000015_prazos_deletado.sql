-- Soft delete para prazos (alinha com a Lixeira; evita perda permanente de prazos).
alter table public.prazos add column if not exists deletado boolean not null default false;
create index if not exists prazos_deletado_idx on public.prazos (deletado);
