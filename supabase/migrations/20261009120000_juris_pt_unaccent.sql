-- ============================================================================
-- Jurisprudência: configuração de busca "pt_unaccent" (português + sem acento)
-- ----------------------------------------------------------------------------
-- Antes, o índice e o trecho destacado usavam o texto já sem acento (f_unaccent), então o
-- snippet saía "participacao", "absolvicao". Com uma configuração de busca que aplica o
-- dicionário unaccent na tokenização, o índice continua sem acento (busca com ou sem acento
-- acha o mesmo), mas o trecho destacado é extraído do texto ORIGINAL, com acentos.
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_ts_config where cfgname = 'pt_unaccent') then
    create text search configuration public.pt_unaccent (copy = pg_catalog.portuguese);
    alter text search configuration public.pt_unaccent
      alter mapping for hword, hword_part, word with public.unaccent, portuguese_stem;
  end if;
end $$;

-- Recria a coluna gerada com a configuração nova (o índice é recriado em seguida).
alter table public.juris_documents drop column if exists fts;
alter table public.juris_documents add column fts tsvector generated always as (
  setweight(to_tsvector('public.pt_unaccent', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('public.pt_unaccent', coalesce(case_number, '') || ' ' || coalesce(decision_number, '')), 'A') ||
  setweight(to_tsvector('public.pt_unaccent', coalesce(summary, '')), 'B') ||
  setweight(to_tsvector('public.pt_unaccent', left(coalesce(full_text, ''), 200000)), 'C')
) stored;
create index if not exists idx_juris_documents_fts on public.juris_documents using gin (fts);

drop function if exists public.juris_search(text, text, text, text, date, date, boolean, int, int);
create or replace function public.juris_search(
  p_q text,
  p_source text default null,
  p_tipo text default null,
  p_organ text default null,
  p_from date default null,
  p_to date default null,
  p_only_verified boolean default false,
  p_limit int default 20,
  p_offset int default 0
)
returns table (
  doc_id text, source_id text, court text, document_type text, organ text, case_number text, decision_number text,
  class_name text, rapporteur text, judgment_date date, publication_date date, title text, summary text,
  official_url text, metadata jsonb, snippet text, rank real, my_status text, my_reviewed_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  with q as (
    select case when coalesce(trim(p_q), '') = '' then null
                else websearch_to_tsquery('public.pt_unaccent', p_q) end as tsq
  )
  select d.doc_id, d.source_id, d.court, d.document_type, d.organ, d.case_number, d.decision_number,
         d.class_name, d.rapporteur, d.judgment_date, d.publication_date, d.title, d.summary,
         d.official_url, d.metadata,
         case when q.tsq is null then left(coalesce(d.summary, d.full_text, ''), 240)
              else ts_headline('public.pt_unaccent', coalesce(d.summary, left(d.full_text, 20000), ''), q.tsq,
                               'MaxFragments=2, MaxWords=28, MinWords=12, StartSel=[, StopSel=]') end as snippet,
         case when q.tsq is null then 0::real else ts_rank_cd(d.fts, q.tsq) end as rank,
         r.status as my_status, r.created_at as my_reviewed_at
  from public.juris_documents d
  cross join q
  left join public.juris_user_reviews r on r.doc_id = d.doc_id and r.user_id = auth.uid()
  where (q.tsq is null or d.fts @@ q.tsq)
    and (p_source is null or d.source_id = p_source)
    and (p_tipo is null
         or (p_tipo = 'precedente' and d.document_type in ('acordao','decisao_monocratica','sumula'))
         or (p_tipo = 'norma' and d.document_type = 'ato_normativo')
         or d.document_type = p_tipo)
    and (p_organ is null or d.organ ilike '%' || p_organ || '%')
    and (p_from is null or coalesce(d.judgment_date, d.publication_date) >= p_from)
    and (p_to is null or coalesce(d.judgment_date, d.publication_date) <= p_to)
    and (not p_only_verified or r.status = 'VERIFIED')
  order by (case when q.tsq is null then 0 else ts_rank_cd(d.fts, q.tsq) end) desc,
           coalesce(d.judgment_date, d.publication_date) desc nulls last
  limit greatest(1, least(p_limit, 100)) offset greatest(0, p_offset);
$$;
grant execute on function public.juris_search(text, text, text, text, date, date, boolean, int, int) to authenticated;
