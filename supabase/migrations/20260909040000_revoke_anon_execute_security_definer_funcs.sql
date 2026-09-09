-- Achado 2 da rodada 2 da analise (docs/ANALISE_PLATAFORMA_SET2026.md, Parte 13):
-- 13 funcoes SECURITY DEFINER executaveis por `anon` (usuario NAO
-- autenticado) sem necessidade -- confirmado lendo corpo por corpo: a
-- maioria falha fechada pra auth.uid() nulo (retorna false/vazio, ou lanca
-- excecao), mas duas vazam informacao pra quem nem esta logado:
--   - office_has_access(office_id): retorna true/false se a assinatura do
--     escritorio esta ativa -- expoe status comercial de um escritorio via
--     UUID, sem autenticacao nenhuma.
--   - share_processo_with_office(processo_id, email, permissao): a
--     mensagem de erro difere se o processo existe ("Apenas administradores
--     podem compartilhar") ou nao ("Processo nao encontrado") -- oraculo de
--     existencia de UUID de processo pra quem nao esta logado.
-- As outras 11 nao vazam nada hoje (auth.uid() nulo sempre reprova a
-- condicao), mas expor SECURITY DEFINER pra anon sem necessidade e
-- superficie de ataque desnecessaria -- mesmo espirito das migrations
-- hygiene_anon_revoke_uploads_bucket / hygiene_signup_plan_revoke_public,
-- so que essas 13 escaparam por terem sido criadas depois.
--
-- confirm_invited_user fica de fora de proposito (unica que PRECISA ser
-- anon -- fluxo de confirmacao de convite antes do login).
--
-- Revoga de PUBLIC (de onde anon herda) e reconcede so pra quem usa de
-- verdade: authenticated (chamadas normais da app) e service_role (crons,
-- edge functions).

do $revoke$
declare
  sig text;
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
    'public.user_belongs_to_office(uuid)'
  ] loop
    execute format('revoke execute on function %s from public', sig);
    execute format('revoke execute on function %s from anon', sig);
    execute format('grant execute on function %s to authenticated', sig);
    execute format('grant execute on function %s to service_role', sig);
  end loop;
end $revoke$;

-- Achado 3: enforce_office_seat_limit e funcao de TRIGGER (dispara em
-- INSERT/UPDATE de office_users, nunca via RPC direto) -- escapou da
-- limpeza generica de revoke_trigger_exec_public por ter sido criada
-- depois dessa migration. Triggers continuam funcionando normalmente
-- (o executor do Postgres nao passa pelo ACL de EXECUTE pra disparar um
-- trigger); so fecha a chamada direta via /rest/v1/rpc.
revoke execute on function public.enforce_office_seat_limit() from public, anon, authenticated;
