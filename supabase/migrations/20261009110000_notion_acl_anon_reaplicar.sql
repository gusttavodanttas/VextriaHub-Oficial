-- ============================================================================
-- Notion: reaplicar a ACL que o repositório declara (Parte 27, achado nº 2)
-- ============================================================================
-- A migration 20261009043000_notion_integracao_por_escritorio.sql revoga
-- EXECUTE de `anon` em office_notion_allowed/office_notion_active, mas os
-- objetos foram criados no projeto pvesofbrctfipdyqyloq pelo SQL Editor,
-- sem registro em supabase_migrations, e no banco as duas funções seguem
-- executáveis por `anon` (advisor "anon_security_definer_function_executable").
-- São SECURITY DEFINER e revelam, por id de escritório, se o Notion está
-- liberado. Nada a ver com o fluxo público: só usuário logado e as
-- functions (service role) chamam.
--
-- Idempotente.
-- ============================================================================

revoke execute on function public.office_notion_allowed(uuid) from public, anon;
revoke execute on function public.office_notion_active(uuid)  from public, anon;
grant  execute on function public.office_notion_allowed(uuid) to authenticated, service_role;
grant  execute on function public.office_notion_active(uuid)  to authenticated, service_role;
