-- ============================================================================
-- Migration retroativa: office_teams, office_team_members e as colunas
-- team_id de processos/clientes nunca tiveram CREATE/ALTER TABLE versionado
-- (achado no teste de RLS de 2026-09-04, supabase/tests/rls-standalone/README.md,
-- e confirmado na parte 2 da análise: docs/ANALISE_PLATAFORMA_SET2026.md).
-- Foram criadas direto em produção, fora da esteira normal de migrations.
--
-- Sem isto, um rebuild do zero (`supabase db push` num projeto novo) quebra
-- em cascata: 20260628000001_team_visibility_rls.sql já assume que
-- office_team_members existe (só dá ALTER TABLE ENABLE RLS + CREATE POLICY,
-- nunca CREATE TABLE); 20260628000004 e outras referenciam `processos.team_id`
-- sem nunca terem adicionado a coluna; e a própria correção de performance
-- desta sessão (20260904140000_rls_perf_auth_uid_and_fk_indexes.sql) cria
-- `idx_processos_team_id`/`idx_clientes_team_id` — índice numa coluna que,
-- sem esta migration, nunca teria sido criada.
--
-- Datada logo após a migration que cria `processos`/`clientes`
-- (20250709123659-...sql) e bem antes de 20260628000001 (a mais antiga que já
-- assume que tudo isto existe) — mesma estratégia da migration retroativa dos
-- crons (20260904160000_crons_vault_secrets.sql): fecha o buraco no lugar
-- certo da linha do tempo, não no fim dela.
--
-- Schema abaixo é cópia fiel do que está em produção hoje (colunas, tipos,
-- defaults, constraints e índices via information_schema/pg_constraint/
-- pg_indexes) — não uma reconstrução de memória. RLS de ambas as tabelas
-- continua ficando por conta de 20260628000006/000007 (já rastreadas), que
-- rodam depois desta na ordem cronológica.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.office_teams (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id   uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  name        text NOT NULL,
  color       text NOT NULL DEFAULT '#3b82f6',
  description text,
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_office_teams_office_id ON public.office_teams (office_id);

CREATE TABLE IF NOT EXISTS public.office_team_members (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    uuid NOT NULL REFERENCES public.office_teams(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  office_id  uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  role       text NOT NULL DEFAULT 'member' CHECK (role = ANY (ARRAY['coordinator'::text, 'member'::text])),
  UNIQUE (team_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_office_team_members_office_id ON public.office_team_members (office_id);
CREATE INDEX IF NOT EXISTS idx_office_team_members_user_id ON public.office_team_members (user_id);

ALTER TABLE public.processos
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.office_teams(id) ON DELETE SET NULL;

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.office_teams(id) ON DELETE SET NULL;
