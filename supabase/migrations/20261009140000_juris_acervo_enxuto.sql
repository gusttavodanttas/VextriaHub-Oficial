-- ============================================================================
-- Acervo enxuto para o plano gratuito do Supabase (500 MB). Já aplicado em produção em 09/10/2026.
-- 1) sai a coluna tsvector armazenada (~220 MB); 2) espelhos do STJ sem texto do dispositivo e com
-- metadados mínimos (UPDATE feito em partes, pelo conector); 3) busca por índice GIN de expressão,
-- ranqueando só os 3.000 acertos mais recentes com vetor leve (título + ementa).
-- Depois disto é preciso rodar, no SQL Editor (fora de transação): vacuum full public.juris_documents;
-- ============================================================================

drop index if exists public.idx_juris_documents_fts;
alter table public.juris_documents drop column if exists fts;

-- Enxugar espelhos (idempotente; em produção foi feito em partes por causa do statement timeout)
update public.juris_documents d
set full_text = null,
    metadata = (select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) from jsonb_each(d.metadata) e(k, v)
                where k in ('numeroRegistro','registro_formatado','scon_busca','siglaClasse','tema','teseJuridica','tipoDeDecisao','referenciasLegislativas'))
where source_id = 'stj_dadosabertos' and (full_text is not null or metadata ? 'acordaosSimilares');

create or replace function public.juris_fts_expr(d public.juris_documents)
returns tsvector
language sql
immutable
parallel safe
as $$
  select to_tsvector('public.pt_unaccent',
    coalesce(d.title, '') || ' ' || coalesce(d.case_number, '') || ' ' || coalesce(d.decision_number, '') || ' ' ||
    coalesce(d.summary, '') || ' ' || coalesce(left(d.full_text, 200000), ''))
$$;

create index if not exists idx_juris_documents_fts_expr on public.juris_documents using gin (public.juris_fts_expr(juris_documents));

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
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  tsq tsquery;
begin
  if coalesce(trim(p_q), '') <> '' then
    tsq := websearch_to_tsquery('public.pt_unaccent', p_q);
  end if;
  return query
  with candidatos as (
    select d.doc_id as c_doc_id, d.title as c_title, d.summary as c_summary,
           coalesce(d.judgment_date, d.publication_date) as c_data,
           r.status as c_status, r.created_at as c_reviewed_at
    from public.juris_documents d
    left join public.juris_user_reviews r on r.doc_id = d.doc_id and r.user_id = (select auth.uid())
    where (tsq is null or public.juris_fts_expr(d) @@ tsq)
      and (p_source is null or d.source_id = p_source)
      and (p_tipo is null
           or (p_tipo = 'precedente' and d.document_type in ('acordao','decisao_monocratica','sumula'))
           or (p_tipo = 'norma' and d.document_type = 'ato_normativo')
           or d.document_type = p_tipo)
      and (p_organ is null or d.organ ilike '%' || p_organ || '%')
      and (p_from is null or coalesce(d.judgment_date, d.publication_date) >= p_from)
      and (p_to is null or coalesce(d.judgment_date, d.publication_date) <= p_to)
      and (not p_only_verified or r.status = 'VERIFIED')
    order by coalesce(d.judgment_date, d.publication_date) desc nulls last
    limit 3000
  ),
  ranqueados as (
    select c_doc_id, c_status, c_reviewed_at, c_data,
           case when tsq is null then 0::real
                else ts_rank_cd(to_tsvector('public.pt_unaccent', coalesce(c_title, '') || ' ' || coalesce(c_summary, '')), tsq) end as c_rank
    from candidatos
    order by 5 desc, c_data desc nulls last
    limit greatest(1, least(p_limit, 100)) offset greatest(0, p_offset)
  )
  select d.doc_id, d.source_id, d.court, d.document_type, d.organ, d.case_number, d.decision_number,
         d.class_name, d.rapporteur, d.judgment_date, d.publication_date, d.title, d.summary,
         d.official_url, d.metadata,
         case when tsq is null then left(coalesce(d.summary, d.full_text, ''), 240)
              else ts_headline('public.pt_unaccent', coalesce(d.summary, left(d.full_text, 20000), ''), tsq,
                               'MaxFragments=2, MaxWords=28, MinWords=12, StartSel=[, StopSel=]') end as snippet,
         h.c_rank, h.c_status, h.c_reviewed_at
  from ranqueados h
  join public.juris_documents d on d.doc_id = h.c_doc_id
  order by h.c_rank desc, h.c_data desc nulls last;
end $$;
grant execute on function public.juris_search(text, text, text, text, date, date, boolean, int, int) to authenticated;
