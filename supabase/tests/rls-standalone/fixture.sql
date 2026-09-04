-- Fixture mínimo pra testar isolamento de visibilidade por time/escritório.
-- Colunas e corpos de função copiados VERBATIM da produção (via information_schema
-- e das migrations) — não reinventados. Escopo: só o que tarefas_select/
-- financeiro_select realmente usam (is_office_admin, user_belongs_to_office,
-- team_visible_user_ids). Paywall (office_paid_gate) e cota de plano ficam de
-- fora de propósito — são testes separados, não este.
--
-- POR QUE UM SCHEMA MÍNIMO, E NÃO AS MIGRATIONS REAIS: tentei replayar
-- supabase/migrations/*.sql inteiro (é o que daria fidelidade máxima) e
-- descobri, no processo, que office_teams e office_team_members — as DUAS
-- tabelas centrais da visibilidade por time — NÃO TÊM CREATE TABLE em
-- migration nenhuma; existem só no banco vivo (confirmado via
-- information_schema.columns na produção). É o mesmo achado P2 da análise
-- de set/2026 ("migrations não reconstroem o ambiente"), agora com um
-- exemplo concreto: um rebuild do zero quebraria bem antes de chegar aqui,
-- ao tentar aplicar policy em cima de tabela que não existe. Registrado
-- aqui para virar migration própria depois — não fiz junto porque inserir
-- um CREATE TABLE com timestamp retroativo numa migration já aplicada em
-- produção merece cuidado à parte, não uma correção de passagem.
--
-- Por isso este fixture recria só o necessário, com colunas conferidas
-- contra a produção (não migrations) via information_schema.

-- ── shim de auth (o que o Supabase Platform fornece e este Postgres cru não) ──
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create or replace function auth.role() returns text language sql stable as
  $$ select coalesce(current_setting('request.jwt.claim.role', true), 'anon') $$;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
end $$;
grant authenticated to current_user;
grant usage on schema auth, public to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;
grant execute on function auth.role() to authenticated, anon;

-- ── schema mínimo (colunas conferidas contra a produção via information_schema) ──
do $$ begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type app_role as enum ('user', 'admin', 'super_admin');
  end if;
end $$;

create table offices (
  id uuid primary key default gen_random_uuid()
);

create table office_users (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references offices(id),
  user_id uuid not null,
  role app_role not null default 'user',
  active boolean not null default true
);

create table office_teams (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references offices(id),
  name text not null
);

create table office_team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references office_teams(id),
  user_id uuid not null,
  office_id uuid not null references offices(id),
  role text not null default 'member'
);

create table profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role app_role not null default 'user',
  office_id uuid references offices(id)
);

create table tarefas (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references offices(id),
  user_id uuid not null,
  responsavel_id uuid,
  deletado boolean not null default false,
  titulo text
);

create table financeiro (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references offices(id),
  user_id uuid not null,
  deletado boolean not null default false,
  descricao text
);

grant select, insert, update, delete on tarefas, financeiro to authenticated;

-- ── funções de visibilidade, copiadas verbatim de supabase/migrations/ ──
-- (20260628000001_team_visibility_rls.sql)
CREATE OR REPLACE FUNCTION public.is_office_admin(p_office_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.office_users
    WHERE office_id = p_office_id
      AND user_id = auth.uid()
      AND active = true
      AND role IN ('admin','super_admin')
  ) OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() AND role = 'super_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.user_belongs_to_office(p_office_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.office_users
    WHERE office_id = p_office_id AND user_id = auth.uid() AND active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.team_visible_user_ids(p_office_id uuid)
RETURNS SETOF uuid LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT auth.uid()
  UNION
  SELECT otm.user_id
  FROM public.office_team_members coord
  JOIN public.office_team_members otm ON otm.team_id = coord.team_id
  WHERE coord.user_id = auth.uid()
    AND coord.role = 'coordinator'
    AND otm.office_id = p_office_id;
$$;

-- ── RLS, copiada verbatim ──
-- tarefas: 20260628000001_team_visibility_rls.sql
ALTER TABLE public.tarefas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tarefas_select" ON public.tarefas FOR SELECT USING (
  public.is_office_admin(office_id)
  OR COALESCE(responsavel_id, user_id) IN (SELECT public.team_visible_user_ids(office_id))
);
CREATE POLICY "tarefas_insert" ON public.tarefas FOR INSERT WITH CHECK (
  user_id = auth.uid()
  AND (office_id IS NULL OR public.user_belongs_to_office(office_id))
);
CREATE POLICY "tarefas_update" ON public.tarefas FOR UPDATE USING (
  public.is_office_admin(office_id)
  OR COALESCE(responsavel_id, user_id) IN (SELECT public.team_visible_user_ids(office_id))
);
CREATE POLICY "tarefas_delete" ON public.tarefas FOR DELETE USING (
  public.is_office_admin(office_id)
  OR COALESCE(responsavel_id, user_id) IN (SELECT public.team_visible_user_ids(office_id))
);

-- financeiro: 20260628000003_team_visibility_rls_extra.sql
ALTER TABLE public.financeiro ENABLE ROW LEVEL SECURITY;
CREATE POLICY "financeiro_select" ON public.financeiro FOR SELECT USING (
  public.is_office_admin(office_id)
  OR user_id IN (SELECT public.team_visible_user_ids(office_id))
);
CREATE POLICY "financeiro_insert" ON public.financeiro FOR INSERT WITH CHECK (
  user_id = auth.uid() AND (office_id IS NULL OR public.user_belongs_to_office(office_id))
);
CREATE POLICY "financeiro_update" ON public.financeiro FOR UPDATE USING (
  public.is_office_admin(office_id)
  OR user_id IN (SELECT public.team_visible_user_ids(office_id))
);
CREATE POLICY "financeiro_delete" ON public.financeiro FOR DELETE USING (
  public.is_office_admin(office_id)
  OR user_id IN (SELECT public.team_visible_user_ids(office_id))
);
