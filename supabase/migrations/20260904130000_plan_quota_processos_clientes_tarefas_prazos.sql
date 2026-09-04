-- ============================================================================
-- COTA DE PROCESSOS/CLIENTES/TAREFAS/PRAZOS POR PLANO (correção P1 da análise
-- de set/2026 — "os limites de plano são vendidos e não são cobrados")
-- ============================================================================
-- plan_configs anuncia "até 30 processos" (Básico), "até 100" (Intermediário),
-- "até 300" (Avançado). O único enforcement até aqui era um botão desabilitado
-- em NovoProcessoDialog.tsx — clientes, tarefas e prazos nem isso tinham. A
-- trava caía com uma chamada direta ao PostgREST, pela importação, ou pela
-- própria IA (ai-advisor insere com service role sem checar limite nenhum).
--
-- Segue o MESMO padrão do enforce_oab_quota (20260822054917), já em produção:
-- teto editável em plan_configs, resolvido por office_subscriptions.plan_name,
-- trava no INSERT via trigger.
--
-- Verificado ao vivo antes de escrever esta migration: nenhum escritório hoje
-- ultrapassa os tetos abaixo (o único com volume real é cortesia = ilimitado),
-- então não há cláusula de carência para escritório já acima do teto — se isso
-- mudar até o deploy, rode a consulta comentada no fim do arquivo antes.
--
-- ESCOPO: só INSERT, como o enforce_oab_quota. Restaurar da Lixeira (UPDATE
-- deletado=false) NÃO passa por este trigger — mesma lacuna que já existe no
-- padrão, documentada aqui para não ser "descoberta" como bug depois.
-- ============================================================================

begin;

-- 1) Teto por plano em plan_configs (mesmo padrão de max_oabs) — NULL = sem teto.
alter table public.plan_configs add column if not exists max_processos integer;
alter table public.plan_configs add column if not exists max_clientes  integer;
alter table public.plan_configs add column if not exists max_tarefas   integer;
alter table public.plan_configs add column if not exists max_prazos    integer;

-- Semente: mesmos números do usePlanFeatures.tsx (client) — a fonte visual do
-- "até N processos" na página de preços e no catálogo. NULL = ilimitado (Premium).
update public.plan_configs set max_processos=30,  max_clientes=100,  max_tarefas=500,   max_prazos=200
  where plan_type like 'BASIC%'      or plan_type like 'B_SICO%';
update public.plan_configs set max_processos=100, max_clientes=500,  max_tarefas=2000,  max_prazos=1000
  where plan_type like 'PRO%';
update public.plan_configs set max_processos=300, max_clientes=2000, max_tarefas=10000, max_prazos=5000
  where plan_type like 'ENTERPRISE%';
update public.plan_configs set max_processos=null, max_clientes=null, max_tarefas=null, max_prazos=null
  where plan_type like 'PREMIUM%';

-- ────────────────────────────────────────────────────────────────────────────
-- office_plan_limits: teto efetivo do escritório para as 4 chaves, num jsonb só.
-- Resolução IDÊNTICA ao office_oab_limit (cortesia/vitalício = sem teto; match
-- exato do plan_name ativo em plan_configs; rede por palavra-chave do tier p/
-- plano custom renomeado; sem assinatura ainda ou fora de 'ativa' = trial).
-- Os números do fallback por palavra-chave e do trial são os MESMOS do
-- usePlanFeatures.tsx — nunca cai pra ilimitado por falta de match.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.office_plan_limits(p_office uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_name text; v_life boolean; v_status text;
  v_processos int; v_clientes int; v_tarefas int; v_prazos int;
  v_trial jsonb := '{"processos":10,"clientes":20,"tarefas":50,"prazos":20}'::jsonb;
  v_ilimitado jsonb := '{"processos":null,"clientes":null,"tarefas":null,"prazos":null}'::jsonb;
begin
  select plan_name, coalesce(is_lifetime, false), coalesce(status, '')
    into v_name, v_life, v_status
  from public.office_subscriptions
  where office_id = p_office;

  if not found then return v_trial; end if;
  if v_life or v_status = 'cortesia' then return v_ilimitado; end if;
  if v_status <> 'ativa' then return v_trial; end if; -- trial/pendente/atrasada/cancelada

  select max_processos, max_clientes, max_tarefas, max_prazos
    into v_processos, v_clientes, v_tarefas, v_prazos
  from public.plan_configs
  where plan_name = v_name and is_active
  limit 1;

  if found then
    return jsonb_build_object(
      'processos', v_processos, 'clientes', v_clientes,
      'tarefas', v_tarefas, 'prazos', v_prazos
    );
  end if;

  return case
    when v_name ilike '%premium%' then v_ilimitado
    when v_name ilike '%avan%'    then '{"processos":300,"clientes":2000,"tarefas":10000,"prazos":5000}'::jsonb
    when v_name ilike '%interm%'  then '{"processos":100,"clientes":500,"tarefas":2000,"prazos":1000}'::jsonb
    else                                '{"processos":30,"clientes":100,"tarefas":500,"prazos":200}'::jsonb
  end;
end;
$$;
revoke execute on function public.office_plan_limits(uuid) from public, anon, authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- enforce_plan_quota: trigger genérico BEFORE INSERT, um por tabela cotada.
-- TG_ARGV[0] diz qual chave do jsonb usar; TG_TABLE_NAME diz de qual tabela
-- contar (todas têm office_id + deletado, checado antes de escrever isto).
-- Advisory lock por (escritório, tabela) fecha a corrida: duas inserções
-- concorrentes (dois membros da equipe, ou a IA e um usuário) não passam as
-- duas pelo mesmo teto — mesmo mecanismo do enforce_office_seat_limit.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.enforce_plan_quota()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chave text := TG_ARGV[0];
  v_limit int;
  v_count int;
begin
  select (public.office_plan_limits(new.office_id) ->> v_chave)::int into v_limit;
  if v_limit is null then return new; end if; -- sem teto (premium/cortesia/vitalício)

  perform pg_advisory_xact_lock(hashtext(new.office_id::text || ':' || TG_TABLE_NAME));

  execute format(
    'select count(*) from public.%I where office_id = $1 and deletado = false',
    TG_TABLE_NAME
  ) into v_count using new.office_id;

  if v_count >= v_limit then
    raise exception 'Limite do plano atingido (% de % %). Faça upgrade para adicionar mais.',
      v_count, v_limit, v_chave
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;
revoke execute on function public.enforce_plan_quota() from public, anon, authenticated;

drop trigger if exists trg_quota_processos on public.processos;
create trigger trg_quota_processos before insert on public.processos
  for each row execute function public.enforce_plan_quota('processos');

drop trigger if exists trg_quota_clientes on public.clientes;
create trigger trg_quota_clientes before insert on public.clientes
  for each row execute function public.enforce_plan_quota('clientes');

drop trigger if exists trg_quota_tarefas on public.tarefas;
create trigger trg_quota_tarefas before insert on public.tarefas
  for each row execute function public.enforce_plan_quota('tarefas');

drop trigger if exists trg_quota_prazos on public.prazos;
create trigger trg_quota_prazos before insert on public.prazos
  for each row execute function public.enforce_plan_quota('prazos');

commit;

-- ============================================================================
-- Antes de aplicar em qualquer ambiente novo (ou se muito tempo tiver passado
-- desde set/2026), rode esta consulta — SÓ LEITURA — pra confirmar que nenhum
-- escritório já ultrapassa o teto que está prestes a virar bloqueio:
--
-- select o.id, o.name, o.plan,
--   (select count(*) from processos p where p.office_id=o.id and p.deletado=false) as processos,
--   (select count(*) from clientes  c where c.office_id=o.id and c.deletado=false) as clientes,
--   (select count(*) from tarefas   t where t.office_id=o.id and t.deletado=false) as tarefas,
--   (select count(*) from prazos   pr where pr.office_id=o.id and pr.deletado=false) as prazos
-- from offices o order by processos desc;
-- ============================================================================
