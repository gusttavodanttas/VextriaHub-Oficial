-- ============================================================================
-- TETO E MEDIÇÃO DE CONSUMO DA IA (correção P1 da análise de set/2026)
-- ============================================================================
-- Hoje o Conselheiro IA e a voz usam a chave OPENAI_API_KEY da Vextria e a
-- checagem é binária: autenticado + premium entra. Sem quota, sem contador,
-- sem registro. Uma aba em loop gera custo ilimitado e, depois, não há como
-- saber QUAL escritório gastou.
--
-- Esta migration cria:
--   1. ai_usage        — consumo por escritório/mês (chamadas, tokens, voz)
--   2. ai_consumir()   — check + incremento ATÔMICOS (uma UPDATE só)
--   3. ai_registrar_tokens() — grava o custo real depois da resposta da OpenAI
--
-- Os TETOS não ficam aqui: vêm das edge functions (segredos AI_LIMITE_*),
-- para poderem ser ajustados sem migration. 0 ou ausente = ilimitado.
--
-- ⚠️ ORDEM DE DEPLOY: rode esta migration ANTES de dar deploy nas funções
-- ai-advisor e ai-voice. As funções falham ABERTO (liberam a chamada e logam)
-- se a RPC não existir — para um erro de banco nunca derrubar um recurso pago —
-- então deployar antes da migration deixaria o teto sem efeito, em silêncio.
-- ============================================================================

begin;

create table if not exists public.ai_usage (
  office_id       uuid        not null references public.offices(id) on delete cascade,
  mes             date        not null,   -- primeiro dia do mês (UTC)
  chamadas        integer     not null default 0,
  voz_caracteres  bigint      not null default 0,
  tokens_prompt   bigint      not null default 0,
  tokens_resposta bigint      not null default 0,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  primary key (office_id, mes)
);

comment on table public.ai_usage is
  'Consumo de IA por escritório e mês. Escrita SÓ pelo service role (edge functions ai-advisor/ai-voice) via ai_consumir() e ai_registrar_tokens().';

alter table public.ai_usage enable row level security;

-- Leitura: qualquer membro do escritório vê o próprio consumo (base para a tela
-- de uso). Escrita não tem policy nenhuma — cliente não grava consumo.
drop policy if exists ai_usage_select_membros on public.ai_usage;
create policy ai_usage_select_membros on public.ai_usage
  for select to authenticated
  using (public.user_belongs_to_office(office_id) or public.is_super_admin());

-- ────────────────────────────────────────────────────────────────────────────
-- ai_consumir: reserva uma chamada (e caracteres de voz) SE couber no teto.
-- Check e incremento na MESMA UPDATE — duas requisições simultâneas não passam
-- as duas pelo limite, que é o furo de qualquer "consulta e depois incrementa".
-- Teto <= 0 significa ilimitado.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.ai_consumir(
  p_office          uuid,
  p_chamadas        integer,
  p_voz_caracteres  integer,
  p_limite_chamadas integer,
  p_limite_voz      integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mes       date := date_trunc('month', now() at time zone 'utc')::date;
  v_permitido boolean := false;
  v_chamadas  integer;
  v_voz       bigint;
begin
  insert into public.ai_usage (office_id, mes)
  values (p_office, v_mes)
  on conflict (office_id, mes) do nothing;

  update public.ai_usage u
     set chamadas       = u.chamadas + p_chamadas,
         voz_caracteres = u.voz_caracteres + p_voz_caracteres,
         atualizado_em  = now()
   where u.office_id = p_office
     and u.mes = v_mes
     and (p_limite_chamadas <= 0 or u.chamadas + p_chamadas <= p_limite_chamadas)
     and (p_limite_voz      <= 0 or u.voz_caracteres + p_voz_caracteres <= p_limite_voz)
  returning u.chamadas, u.voz_caracteres into v_chamadas, v_voz;

  if found then
    v_permitido := true;
  else
    -- Estourou o teto: devolve o consumo atual para a função montar a mensagem.
    select u.chamadas, u.voz_caracteres into v_chamadas, v_voz
      from public.ai_usage u
     where u.office_id = p_office and u.mes = v_mes;
  end if;

  return jsonb_build_object(
    'permitido', v_permitido,
    'chamadas', coalesce(v_chamadas, 0),
    'voz_caracteres', coalesce(v_voz, 0)
  );
end;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- ai_registrar_tokens: custo real, gravado DEPOIS da resposta da OpenAI.
-- Não bloqueia nada — é medição, para saber quanto cada escritório consome.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.ai_registrar_tokens(
  p_office          uuid,
  p_tokens_prompt   bigint,
  p_tokens_resposta bigint
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.ai_usage
     set tokens_prompt   = tokens_prompt + coalesce(p_tokens_prompt, 0),
         tokens_resposta = tokens_resposta + coalesce(p_tokens_resposta, 0),
         atualizado_em   = now()
   where office_id = p_office
     and mes = date_trunc('month', now() at time zone 'utc')::date;
$$;

-- Só o service role chama estas duas (a partir das edge functions). Nenhum
-- cliente — nem anônimo, nem logado — pode mexer no próprio contador.
revoke execute on function public.ai_consumir(uuid, integer, integer, integer, integer) from public, anon, authenticated;
revoke execute on function public.ai_registrar_tokens(uuid, bigint, bigint)          from public, anon, authenticated;

commit;
