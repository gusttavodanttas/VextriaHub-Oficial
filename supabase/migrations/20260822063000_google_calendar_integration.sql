-- Integração Google Agenda (mão única VextriaHub -> Google). Escopo app.created:
-- cria um calendário "VextriaHub" separado na conta do advogado e só mexe nele.
-- Conexão POR USUÁRIO. Tokens ficam em tabelas com RLS SEM policy (só service_role).

-- 1. Tokens + estado da conexão de cada usuário.
create table if not exists public.google_integrations (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  office_id     uuid,
  google_email  text,
  access_token  text,
  refresh_token text,
  token_expiry  timestamptz,
  calendar_id   text,                      -- id do calendário "VextriaHub" criado na conta
  status        text not null default 'connected',  -- connected | revoked
  last_sync_at  timestamptz,
  last_error    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
alter table public.google_integrations enable row level security;  -- sem policy = só service_role

-- 2. Estados do OAuth (curtos, uso único; a edge não tem sessão).
create table if not exists public.google_oauth_states (
  state       text primary key,
  user_id     uuid not null,
  office_id   uuid,
  redirect_uri text,
  created_at  timestamptz not null default now()
);
alter table public.google_oauth_states enable row level security;  -- sem policy

-- 3. Mapa item do VextriaHub -> evento no Google (sync incremental por diff).
create table if not exists public.google_calendar_map (
  user_id        uuid not null,
  source_type    text not null,            -- 'prazo' | 'audiencia'
  source_id      uuid not null,
  google_event_id text not null,
  content_hash   text,                     -- p/ só atualizar quando muda
  updated_at     timestamptz not null default now(),
  primary key (user_id, source_type, source_id)
);
alter table public.google_calendar_map enable row level security;  -- sem policy

create index if not exists google_calendar_map_user_idx on public.google_calendar_map(user_id);

-- Status da conexão para o frontend (SEM expor tokens). Retorna 0 linhas se desconectado.
create or replace function public.google_status()
returns table(connected boolean, status text, google_email text, last_sync_at timestamptz)
language sql stable security definer set search_path = public as $$
  select true, gi.status, gi.google_email, gi.last_sync_at
  from public.google_integrations gi
  where gi.user_id = auth.uid()
  limit 1;
$$;
revoke execute on function public.google_status() from public, anon;
grant execute on function public.google_status() to authenticated;
