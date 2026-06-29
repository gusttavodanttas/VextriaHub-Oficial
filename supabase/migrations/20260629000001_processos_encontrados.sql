-- Caixa de entrada "Processos Encontrados": staging dos processos achados pelo robô (OAB)
-- antes de serem adicionados à base. O usuário aprova ou descarta.
create table if not exists public.processos_encontrados (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null,
  numero_processo text not null,
  titulo text,
  tribunal text,
  autor text,
  reu text,
  fonte text,
  payload jsonb,
  encontrado_por uuid,
  created_at timestamptz not null default now(),
  unique (office_id, numero_processo)
);

alter table public.processos_encontrados enable row level security;

-- Membros do escritório podem ver/gerenciar os achados do próprio escritório
drop policy if exists "encontrados_office_all" on public.processos_encontrados;
create policy "encontrados_office_all" on public.processos_encontrados
  for all to authenticated
  using (office_id in (select office_id from public.office_users where user_id = auth.uid()))
  with check (office_id in (select office_id from public.office_users where user_id = auth.uid()));

create index if not exists idx_proc_encontrados_office on public.processos_encontrados(office_id);
