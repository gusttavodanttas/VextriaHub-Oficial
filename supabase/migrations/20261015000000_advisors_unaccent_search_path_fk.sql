-- Advisors de segurança/desempenho apontados na Parte 29 (10/10/2026):
--   1) extensão `unaccent` instalada em `public` → vai para `extensions` (relocável;
--      a configuração de busca `public.pt_unaccent` referencia o dicionário por OID e
--      continua válida, assim como o índice GIN que usa `juris_fts_expr`);
--   2) `f_unaccent` e `juris_fts_expr` sem `search_path` fixo → fixado em `public, extensions`
--      (nomes já são qualificados; o config só fecha a brecha de resolução por papel);
--   3) FK `office_integrations.connected_by` sem índice.
-- Idempotente. NÃO aplicada em produção ainda: aguarda autorização ("aplique a migration").

do $$
begin
  if exists (select 1 from pg_extension e join pg_namespace n on n.oid = e.extnamespace
             where e.extname = 'unaccent' and n.nspname = 'public') then
    alter extension unaccent set schema extensions;
  end if;
end $$;

create or replace function public.f_unaccent(text)
returns text
language sql
immutable
parallel safe
strict
set search_path = public, extensions
as $$ select extensions.unaccent('extensions.unaccent', $1) $$;

alter function public.juris_fts_expr(public.juris_documents) set search_path = public, extensions;

create index if not exists idx_office_integrations_connected_by
  on public.office_integrations(connected_by);
