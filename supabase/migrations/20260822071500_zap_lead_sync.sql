-- Cursor de "última puxada" por vínculo (só busca leads novos/alterados desde então).
alter table public.office_zap_link add column if not exists last_lead_pull_at timestamptz;

-- Mapa anti-duplicação: lead do Zap já importado -> cliente no Hub.
create table if not exists public.zap_synced_leads (
  office_id   uuid not null references public.offices(id) on delete cascade,
  zap_lead_id uuid not null,
  cliente_id  uuid references public.clientes(id) on delete set null,
  synced_at   timestamptz not null default now(),
  primary key (office_id, zap_lead_id)
);
alter table public.zap_synced_leads enable row level security;  -- sem policy = só service_role
