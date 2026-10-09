-- ============================================================================
-- Jurisprudência e normas (base auditável) — integração do JurisKit no VextriaHub
-- ----------------------------------------------------------------------------
-- Modelo:
--   juris_documents        acervo GLOBAL (jurisprudência e normas são públicas): acórdãos do
--                          STJ/TJDFT, inteiro teor, atos normativos (ANS, CFO, DOU…). Só o
--                          serviço de sincronização (service role) escreve; todo usuário
--                          autenticado lê. Busca por texto completo em português, sem acento.
--   juris_user_reviews     conferência INDIVIDUAL: quem conferiu na fonte oficial, quando, com
--                          qual URL. Um advogado não vê a conferência do outro.
--   juris_user_searches    histórico/pesquisas salvas, privadas por usuário.
--   juris_user_pins        precedentes/normas fixados pelo usuário em processo, publicação ou
--                          consultivo. Privados por usuário.
--   juris_user_norma_alertas  preferências de alerta de normas novas (ANS, CFO, CRO, termos).
-- Regra de ouro (herdada do kit): tudo entra NÃO CONFERIDO; só pode ser citado o que o
-- próprio advogado marcou como CONFERIDO. Ato normativo e metadado nunca são precedente.
-- Multi-tenant: as tabelas *_user_* são por usuário (user_id = auth.uid()) e carregam
-- office_id (auto-fill + paywall RESTRICTIVE, mesma âncora do resto do sistema).
-- ============================================================================

create extension if not exists unaccent;

-- unaccent não é IMMUTABLE por padrão; este wrapper permite usá-lo em coluna gerada e índice.
create or replace function public.f_unaccent(text)
returns text
language sql
immutable
parallel safe
strict
as $$ select public.unaccent('public.unaccent', $1) $$;

-- 1) Acervo global -------------------------------------------------------------
create table if not exists public.juris_documents (
  doc_id              text primary key,                 -- ex.: stj:1460157, tjdft:<uuid>, dou:<id>
  source_id           text not null,                    -- stj_dadosabertos, tjdft_jurisdf, inlabs_dou, cfo_atos…
  court               text,
  document_type       text not null,                    -- acordao, decisao_monocratica, sumula, ato_normativo, metadado_processual
  organ               text,
  case_number         text,
  decision_number     text,
  class_name          text,
  rapporteur          text,
  judgment_date       date,
  publication_date    date,
  title               text,
  summary             text,                             -- ementa
  full_text           text,                             -- inteiro teor / texto extraído
  official_url        text not null,                    -- onde o humano reabre o documento
  source_artifact_url text,
  retrieval_method    text,
  captured_at         timestamptz not null,
  content_sha256      text not null,
  extraction_status   text not null default 'OK',
  metadata            jsonb not null default '{}'::jsonb,
  synced_at           timestamptz not null default now(),
  fts tsvector generated always as (
    setweight(to_tsvector('portuguese', public.f_unaccent(coalesce(title, ''))), 'A') ||
    setweight(to_tsvector('portuguese', public.f_unaccent(coalesce(case_number, '') || ' ' || coalesce(decision_number, ''))), 'A') ||
    setweight(to_tsvector('portuguese', public.f_unaccent(coalesce(summary, ''))), 'B') ||
    setweight(to_tsvector('portuguese', public.f_unaccent(left(coalesce(full_text, ''), 200000))), 'C')
  ) stored
);

create index if not exists idx_juris_documents_fts on public.juris_documents using gin (fts);
create index if not exists idx_juris_documents_source on public.juris_documents(source_id);
create index if not exists idx_juris_documents_type on public.juris_documents(document_type);
create index if not exists idx_juris_documents_dates on public.juris_documents(coalesce(judgment_date, publication_date) desc);
create index if not exists idx_juris_documents_registro on public.juris_documents((metadata->>'numeroRegistro'));

alter table public.juris_documents enable row level security;
drop policy if exists juris_documents_select on public.juris_documents;
create policy juris_documents_select on public.juris_documents for select to authenticated using (true);
-- sem policy de insert/update/delete: só o service role (função juris-sync) escreve.

-- 2) Conferência individual ----------------------------------------------------
create table if not exists public.juris_user_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  office_id uuid not null references public.offices(id) on delete cascade,
  doc_id text not null references public.juris_documents(doc_id) on delete cascade,
  status text not null check (status in ('VERIFIED','BLOCKED')),
  official_url_informada text not null,
  nota text,
  created_at timestamptz not null default now(),
  unique (user_id, doc_id)
);
create index if not exists idx_juris_reviews_user on public.juris_user_reviews(user_id);
create index if not exists idx_juris_reviews_doc on public.juris_user_reviews(doc_id);

-- 3) Histórico e pesquisas salvas (privadas) ----------------------------------
create table if not exists public.juris_user_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  office_id uuid not null references public.offices(id) on delete cascade,
  nome text,
  query text not null,
  filtros jsonb not null default '{}'::jsonb,
  salva boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_juris_searches_user on public.juris_user_searches(user_id, created_at desc);

-- 4) Precedentes fixados (privados) -------------------------------------------
create table if not exists public.juris_user_pins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  office_id uuid not null references public.offices(id) on delete cascade,
  doc_id text not null references public.juris_documents(doc_id) on delete cascade,
  alvo_tipo text not null check (alvo_tipo in ('processo','publicacao','consultivo')),
  alvo_id uuid not null,
  nota text,
  created_at timestamptz not null default now(),
  unique (user_id, doc_id, alvo_tipo, alvo_id)
);
create index if not exists idx_juris_pins_user_alvo on public.juris_user_pins(user_id, alvo_tipo, alvo_id);

-- 5) Alertas de normas (preferência por usuário) ------------------------------
create table if not exists public.juris_user_norma_alertas (
  user_id uuid primary key references auth.users(id) on delete cascade,
  office_id uuid not null references public.offices(id) on delete cascade,
  ativo boolean not null default true,
  orgaos text[] not null default '{ANS,CFO,CRO}',
  termos text[] not null default '{}',
  updated_at timestamptz not null default now()
);

-- Auto-fill de office_id + paywall + RLS por usuário nas 4 tabelas privadas ----
do $$
declare t text;
begin
  foreach t in array array['juris_user_reviews','juris_user_searches','juris_user_pins','juris_user_norma_alertas'] loop
    execute format('drop trigger if exists trg_office_id on public.%I', t);
    execute format('create trigger trg_office_id before insert on public.%I for each row execute function public.set_office_id_from_user()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists office_paid_gate on public.%I', t);
    execute format('create policy office_paid_gate on public.%I as restrictive for all to authenticated '
                   'using (public.office_has_access(office_id) or public.is_super_admin()) '
                   'with check (public.office_has_access(office_id) or public.is_super_admin())', t);
    execute format('drop policy if exists %I_own on public.%I', t, t);
    -- PRIVADO: cada advogado só vê e mexe no que é dele (nem admin do escritório vê)
    execute format('create policy %I_own on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t, t);
  end loop;
end $$;

-- 6) Busca ---------------------------------------------------------------------
-- Retorna os documentos que casam com a consulta (sintaxe websearch: "frase exata", OR, -excluir),
-- com trecho destacado e o status de conferência DO PRÓPRIO usuário (RLS da reviews garante).
drop function if exists public.juris_search(text, text, text, text, date, date, boolean, int, int);
create or replace function public.juris_search(
  p_q text,
  p_source text default null,
  p_tipo text default null,            -- 'precedente' (acordao+decisao+sumula) | 'norma' | tipo exato | null
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
                else websearch_to_tsquery('portuguese', public.f_unaccent(p_q)) end as tsq
  )
  select d.doc_id, d.source_id, d.court, d.document_type, d.organ, d.case_number, d.decision_number,
         d.class_name, d.rapporteur, d.judgment_date, d.publication_date, d.title, d.summary,
         d.official_url, d.metadata,
         case when q.tsq is null then left(coalesce(d.summary, d.full_text, ''), 240)
              else ts_headline('portuguese', public.f_unaccent(coalesce(d.summary, left(d.full_text, 20000), '')), q.tsq,
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

-- Outros registros do mesmo processo no STJ (espelho ↔ inteiro teor ↔ DOU), pelo nº de registro.
create or replace function public.juris_same_process(p_doc_id text)
returns setof public.juris_documents
language sql
stable
security invoker
set search_path = public
as $$
  select d.* from public.juris_documents d
  where d.doc_id <> p_doc_id
    and (d.metadata->>'numeroRegistro') is not null
    and (d.metadata->>'numeroRegistro') = (select metadata->>'numeroRegistro' from public.juris_documents where doc_id = p_doc_id)
  order by coalesce(d.judgment_date, d.publication_date) desc nulls last
  limit 20;
$$;
grant execute on function public.juris_same_process(text) to authenticated;

-- 7) Alertas de normas novas: chamada pela sincronização (service role) após inserir -----
-- Para cada usuário com alerta ativo, cria uma notificação por ato novo cujo órgão (ANS/CFO/CRO)
-- ou termos livres casem com o título/ementa/órgão emissor. Idempotente por (user, doc).
create or replace function public.juris_notify_normas(p_doc_ids text[])
returns int
language plpgsql
security definer
set search_path = public
as $$
declare n int := 0;
begin
  insert into public.notifications (user_id, office_id, title, message, type, data, read)
  select a.user_id, a.office_id,
         'Norma nova: ' || coalesce(left(d.title, 120), d.doc_id),
         left(coalesce(d.summary, ''), 400),
         'norma',
         jsonb_build_object('doc_id', d.doc_id, 'official_url', d.official_url, 'source_id', d.source_id,
                            'organ', d.organ, 'publication_date', d.publication_date, 'route', '/jurisprudencia?doc=' || d.doc_id),
         false
  from public.juris_documents d
  join public.juris_user_norma_alertas a on a.ativo
  where d.doc_id = any(p_doc_ids)
    and d.document_type = 'ato_normativo'
    and (
      ('ANS' = any(a.orgaos) and (d.organ ilike '%Saúde Suplementar%' or d.organ = 'ANS' or d.source_id = 'ans_publicacoes'))
      or ('CFO' = any(a.orgaos) and (d.organ ilike '%Conselho Federal de Odontologia%' or d.organ = 'CFO' or d.source_id = 'cfo_atos'))
      or ('CRO' = any(a.orgaos) and d.organ ilike '%Conselho Regional de Odontologia%')
      or exists (select 1 from unnest(a.termos) t
                 where length(trim(t)) >= 3
                   and public.f_unaccent(coalesce(d.title,'') || ' ' || coalesce(d.summary,'') || ' ' || coalesce(d.organ,'')) ilike '%' || public.f_unaccent(trim(t)) || '%')
    )
    and not exists (select 1 from public.notifications x
                    where x.user_id = a.user_id and x.type = 'norma' and x.data->>'doc_id' = d.doc_id);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.juris_notify_normas(text[]) from public, anon, authenticated;

-- 8) Trava de conferência: a URL informada tem de ser a URL oficial registrada (mesma regra do kit) ----
create or replace function public.juris_reviews_check_url()
returns trigger
language plpgsql
set search_path = public
as $$
declare oficial text;
begin
  select official_url into oficial from public.juris_documents where doc_id = new.doc_id;
  if oficial is null then
    raise exception 'registro % não existe no acervo', new.doc_id;
  end if;
  if new.status = 'VERIFIED' and rtrim(trim(new.official_url_informada), '/') <> rtrim(trim(oficial), '/') then
    raise exception 'URL informada difere da URL oficial registrada; abra a fonte oficial e cole a mesma URL';
  end if;
  return new;
end $$;
drop trigger if exists trg_juris_reviews_check_url on public.juris_user_reviews;
create trigger trg_juris_reviews_check_url before insert or update on public.juris_user_reviews
  for each row execute function public.juris_reviews_check_url();
