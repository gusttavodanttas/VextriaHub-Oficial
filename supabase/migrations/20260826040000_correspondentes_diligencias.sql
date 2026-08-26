-- ============================================================================
-- Correspondentes jurídicos + Diligências
-- ----------------------------------------------------------------------------
-- Escritório cadastra correspondentes (advogados externos que fazem diligências:
-- audiência, protocolo, cópia, carga…) e designa diligências a eles, com status,
-- valor, PAGAMENTO e AVALIAÇÃO. Histórico/desempenho é derivado das diligências
-- (contagens + média de avaliação), então não há colunas denormalizadas.
--
-- Multi-tenant: office-scoped (office_id = any(get_user_office_ids())), com o
-- office_paid_gate RESTRICTIVE (mesma âncora do resto) e o trigger de auto-fill
-- de office_id (set_office_id_from_user). Correspondente é recurso do escritório
-- (todos os membros veem/usam); excluir correspondente é ação de admin.
-- ============================================================================

-- 1) Correspondentes -----------------------------------------------------------
create table if not exists public.correspondentes (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  nome text not null,
  oab text,
  uf text,
  telefone text,
  email text,
  cidades text[] not null default '{}',   -- comarcas/cidades que atende
  valor_padrao numeric,
  observacoes text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_correspondentes_office on public.correspondentes(office_id);

-- 2) Diligências ---------------------------------------------------------------
create table if not exists public.diligencias (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  correspondente_id uuid references public.correspondentes(id) on delete set null,
  processo_id uuid references public.processos(id) on delete set null,
  audiencia_id uuid references public.audiencias(id) on delete set null,
  tipo text not null default 'audiencia'
    check (tipo in ('audiencia','protocolo','copia','carga','despacho','sustentacao','outro')),
  descricao text,
  comarca text,
  uf text,
  data_diligencia timestamptz,
  status text not null default 'solicitada'
    check (status in ('solicitada','aceita','em_andamento','realizada','cancelada')),
  valor numeric,
  pago boolean not null default false,
  data_pagamento date,
  comprovante_url text,
  avaliacao int check (avaliacao between 1 and 5),  -- preenchida após realizada
  avaliacao_comentario text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_diligencias_office on public.diligencias(office_id);
create index if not exists idx_diligencias_correspondente on public.diligencias(correspondente_id);
create index if not exists idx_diligencias_processo on public.diligencias(processo_id);
create index if not exists idx_diligencias_status on public.diligencias(status);

-- 3) Auto-fill de office_id (mesmo trigger dos demais) -------------------------
drop trigger if exists trg_office_id on public.correspondentes;
create trigger trg_office_id before insert on public.correspondentes
  for each row execute function public.set_office_id_from_user();

drop trigger if exists trg_office_id on public.diligencias;
create trigger trg_office_id before insert on public.diligencias
  for each row execute function public.set_office_id_from_user();

-- updated_at automático (se a função existir no schema; senão, o front seta)
do $$
begin
  if exists (select 1 from pg_proc where proname = 'set_updated_at' and pronamespace = 'public'::regnamespace) then
    execute 'drop trigger if exists trg_updated_at on public.correspondentes';
    execute 'create trigger trg_updated_at before update on public.correspondentes for each row execute function public.set_updated_at()';
    execute 'drop trigger if exists trg_updated_at on public.diligencias';
    execute 'create trigger trg_updated_at before update on public.diligencias for each row execute function public.set_updated_at()';
  end if;
end $$;

-- 4) RLS -----------------------------------------------------------------------
alter table public.correspondentes enable row level security;
alter table public.diligencias enable row level security;

-- Paywall (RESTRICTIVE) — mesma âncora do resto do sistema.
drop policy if exists office_paid_gate on public.correspondentes;
create policy office_paid_gate on public.correspondentes as restrictive for all
  using (office_has_access(office_id) or is_super_admin())
  with check (office_has_access(office_id) or is_super_admin());

drop policy if exists office_paid_gate on public.diligencias;
create policy office_paid_gate on public.diligencias as restrictive for all
  using (office_has_access(office_id) or is_super_admin())
  with check (office_has_access(office_id) or is_super_admin());

-- Correspondentes: recurso do escritório (todos veem/usam); excluir = admin.
drop policy if exists correspondentes_select on public.correspondentes;
create policy correspondentes_select on public.correspondentes for select
  using ((office_id = any(get_user_office_ids())) or is_super_admin());
drop policy if exists correspondentes_insert on public.correspondentes;
create policy correspondentes_insert on public.correspondentes for insert
  with check ((office_id is null) or user_belongs_to_office(office_id) or is_super_admin());
drop policy if exists correspondentes_update on public.correspondentes;
create policy correspondentes_update on public.correspondentes for update
  using ((office_id = any(get_user_office_ids())) or is_super_admin());
drop policy if exists correspondentes_delete on public.correspondentes;
create policy correspondentes_delete on public.correspondentes for delete
  using (is_office_admin(office_id) or is_super_admin());

-- Diligências: operacionais — qualquer membro do escritório gerencia.
drop policy if exists diligencias_select on public.diligencias;
create policy diligencias_select on public.diligencias for select
  using ((office_id = any(get_user_office_ids())) or is_super_admin());
drop policy if exists diligencias_insert on public.diligencias;
create policy diligencias_insert on public.diligencias for insert
  with check ((office_id is null) or user_belongs_to_office(office_id) or is_super_admin());
drop policy if exists diligencias_update on public.diligencias;
create policy diligencias_update on public.diligencias for update
  using ((office_id = any(get_user_office_ids())) or is_super_admin());
drop policy if exists diligencias_delete on public.diligencias;
create policy diligencias_delete on public.diligencias for delete
  using ((office_id = any(get_user_office_ids())) or is_super_admin());
