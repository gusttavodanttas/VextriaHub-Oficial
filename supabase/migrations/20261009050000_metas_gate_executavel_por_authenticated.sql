-- ============================================================================
-- Aba Metas bloqueada para todo usuário logado (Parte 27, achado nº 1)
-- ============================================================================
-- A policy RESTRITIVA metas.office_goals_module_gate (20260904150000) chama
-- public.office_has_goals_module(office_id), e a mesma migration revogou
-- EXECUTE dessa função de `authenticated`. Policy roda como o usuário que
-- consulta: todo select/insert/update em `metas` por um usuário logado
-- falha com 42501 "permission denied for function office_has_goals_module"
-- — nem Premium nem cortesia conseguem abrir a aba. Só o super admin passa,
-- porque is_super_admin() vem antes no `or`.
--
-- Não doeu até 09/10 porque o restore de 08/10 reabriu a ACL de tudo; a
-- reaplicação (20261009010000) repôs o revoke e reexpôs o bug.
--
-- A função é SECURITY DEFINER e só devolve um booleano por escritório, lido
-- de offices/office_subscriptions — pode ser executada por `authenticated`.
-- `anon` continua sem acesso.
-- ============================================================================

grant execute on function public.office_has_goals_module(uuid) to authenticated;
revoke execute on function public.office_has_goals_module(uuid) from public, anon;
