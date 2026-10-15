-- ============================================================================
-- Reaplica as permissões de EXECUTE das funções SECURITY DEFINER (pós-restore)
-- ============================================================================
-- O restore do backup pelo painel (projeto pvesofbrctfipdyqyloq, 08/10/2026)
-- recriou as 44 funções de `public` com a ACL PADRÃO do Supabase — EXECUTE
-- para public/anon/authenticated — e descartou os REVOKE/GRANT que 20
-- migrations anteriores tinham aplicado (Partes 1, 7 e 14 da análise). O
-- advisor de segurança passou a apontar 40 funções SECURITY DEFINER
-- executáveis por `anon`. Esta migration reúne, em ordem cronológica, cada
-- REVOKE/GRANT dessas migrations, de forma idempotente (REVOKE em privilégio
-- já ausente é no-op; função inexistente é ignorada).
--
-- Regras resultantes (iguais às de antes da migração):
--   • triggers: ninguém chama por RPC (só o próprio trigger);
--   • helpers de RLS e cotas: só `authenticated` + `service_role`;
--   • medidores de IA, limites de plano, authorize_process_search,
--     sync_office_plan_from_subscription: só `service_role`;
--   • confirm_invited_user(text, text): `anon` + `authenticated` (o cadastro
--     por convite chama antes de ter sessão; tem rate limit próprio);
--   • delete_office, share_processo_with_office, google_status,
--     my_office_has_zap, apply_signup_plan, permission_override: `authenticated`.
-- ============================================================================

-- 1) Nenhuma função de trigger executável por RPC (20260821215541).
do $harden$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prorettype = 'pg_catalog.trigger'::regtype
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
  end loop;
end $harden$;

-- 2) Funções só do service_role (medição de IA, limites de plano, autorização
--    de busca, sincronização de plano).
do $svc$
declare sig text;
begin
  foreach sig in array array[
    'public.ai_consumir(uuid, integer, integer, integer, integer)',
    'public.ai_registrar_tokens(uuid, bigint, bigint)',
    'public.authorize_process_search(uuid, text, text, integer)',
    'public.office_oab_limit(uuid)',
    'public.office_plan_limits(uuid)',
    'public.office_has_goals_module(uuid)',
    'public.sync_office_plan_from_subscription()'
  ] loop
    begin
      execute format('revoke execute on function %s from public, anon, authenticated', sig);
    exception when undefined_function then
      raise notice 'função ausente, ignorada: %', sig;
    end;
  end loop;
end $svc$;

-- 3) Helpers de RLS/cotas e RPCs de usuário logado: só authenticated + service_role
--    (20260909040000 + 20260802000002 + 20260822063000 + 20260822070000 +
--     20260824010500 + 20260826020000 + 20260905010000).
do $auth$
declare sig text;
begin
  foreach sig in array array[
    'public.can_manage_member(uuid, uuid)',
    'public.coordinated_team_ids(uuid)',
    'public.ensure_office_for_user()',
    'public.get_user_office_ids()',
    'public.is_office_admin(uuid)',
    'public.is_super_admin()',
    'public.my_oab_quota()',
    'public.office_has_access(uuid)',
    'public.share_processo_with_office(uuid, text, text)',
    'public.shared_processo_ids()',
    'public.shared_processo_ids_editavel()',
    'public.team_visible_user_ids(uuid)',
    'public.user_belongs_to_office(uuid)',
    'public.delete_office(uuid, text)',
    'public.google_status()',
    'public.my_office_has_zap()',
    'public.apply_signup_plan(text)',
    'public.permission_override(uuid, text)'
  ] loop
    begin
      execute format('revoke execute on function %s from public, anon', sig);
      execute format('grant execute on function %s to authenticated', sig);
      execute format('grant execute on function %s to service_role', sig);
    exception when undefined_function then
      raise notice 'função ausente, ignorada: %', sig;
    end;
  end loop;
end $auth$;

-- 4) confirm_invited_user: chamada ANTES de existir sessão (cadastro por convite),
--    por isso anon continua liberado; o rate limit da 20260908010000 segue valendo.
do $inv$
begin
  revoke all on function public.confirm_invited_user(text, text) from public;
  grant execute on function public.confirm_invited_user(text, text) to anon, authenticated, service_role;
exception when undefined_function then
  raise notice 'confirm_invited_user(text, text) ausente';
end $inv$;

-- Conferência (esperado: 0 linhas além de confirm_invited_user):
--   select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute');
