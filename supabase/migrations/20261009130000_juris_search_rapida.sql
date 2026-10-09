-- juris_search: primeiro escolhe os N melhores (índice + ranking), só depois monta o trecho destacado.
-- Antes, o ts_headline era calculado para TODOS os documentos que casavam (milhares) antes do LIMIT:
-- uma busca comum levava ~49 s com 87 mil documentos; agora ~1,3 s. Já aplicada em produção.
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
  with hits as (
    select d.doc_id as h_doc_id,
           case when tsq is null then 0::real else ts_rank_cd(d.fts, tsq) end as h_rank,
           r.status as h_status, r.created_at as h_reviewed_at
    from public.juris_documents d
    left join public.juris_user_reviews r on r.doc_id = d.doc_id and r.user_id = auth.uid()
    where (tsq is null or d.fts @@ tsq)
      and (p_source is null or d.source_id = p_source)
      and (p_tipo is null
           or (p_tipo = 'precedente' and d.document_type in ('acordao','decisao_monocratica','sumula'))
           or (p_tipo = 'norma' and d.document_type = 'ato_normativo')
           or d.document_type = p_tipo)
      and (p_organ is null or d.organ ilike '%' || p_organ || '%')
      and (p_from is null or coalesce(d.judgment_date, d.publication_date) >= p_from)
      and (p_to is null or coalesce(d.judgment_date, d.publication_date) <= p_to)
      and (not p_only_verified or r.status = 'VERIFIED')
    order by (case when tsq is null then 0 else ts_rank_cd(d.fts, tsq) end) desc,
             coalesce(d.judgment_date, d.publication_date) desc nulls last
    limit greatest(1, least(p_limit, 100)) offset greatest(0, p_offset)
  )
  select d.doc_id, d.source_id, d.court, d.document_type, d.organ, d.case_number, d.decision_number,
         d.class_name, d.rapporteur, d.judgment_date, d.publication_date, d.title, d.summary,
         d.official_url, d.metadata,
         case when tsq is null then left(coalesce(d.summary, d.full_text, ''), 240)
              else ts_headline('public.pt_unaccent', coalesce(d.summary, left(d.full_text, 20000), ''), tsq,
                               'MaxFragments=2, MaxWords=28, MinWords=12, StartSel=[, StopSel=]') end as snippet,
         h.h_rank, h.h_status, h.h_reviewed_at
  from hits h
  join public.juris_documents d on d.doc_id = h.h_doc_id
  order by h.h_rank desc, coalesce(d.judgment_date, d.publication_date) desc nulls last;
end $$;
grant execute on function public.juris_search(text, text, text, text, date, date, boolean, int, int) to authenticated;

-- Advisor de performance: auth.uid() avaliado uma vez por consulta e índices das FKs. Já aplicado em produção.
do $$
declare t text;
begin
  foreach t in array array['juris_user_reviews','juris_user_searches','juris_user_pins','juris_user_norma_alertas'] loop
    execute format('drop policy if exists %I_own on public.%I', t, t);
    execute format('create policy %I_own on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t, t);
  end loop;
end $$;
create index if not exists idx_juris_reviews_office on public.juris_user_reviews(office_id);
create index if not exists idx_juris_searches_office on public.juris_user_searches(office_id);
create index if not exists idx_juris_pins_office on public.juris_user_pins(office_id);
create index if not exists idx_juris_pins_doc on public.juris_user_pins(doc_id);
create index if not exists idx_juris_norma_alertas_office on public.juris_user_norma_alertas(office_id);
