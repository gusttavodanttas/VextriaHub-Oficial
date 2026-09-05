-- ============================================================================
-- Nova análise (2026-09-04, parte 2): completa a correção nº 6 (RLS perf).
-- ============================================================================
-- O script que gerou 20260904191908_rls_perf_auth_uid_and_fk_indexes.sql varreu
-- pg_policies do schema `public` procurando por auth.uid()/auth.jwt()/auth.role()
-- sem `(select ...)`. Duas lacunas ficaram de fora:
--   1. `public.invitations` usa `auth.email()` (não coberto pelo padrão de busca).
--   2. `storage.objects` está em outro schema, fora do escopo da varredura.
-- Achado ao reler os advisors de performance em produção: o warning
-- `auth_rls_initplan` continuava apontando as duas policies de `invitations`.
-- A de storage não aparece no advisor (schema fora do lint padrão), achada só
-- ao rodar a mesma busca manualmente contra pg_policy sem o filtro de schema.
-- ============================================================================

alter policy "inv_select" on public.invitations
  using (((email = (select auth.email())) OR (office_id = ANY (get_user_office_ids())) OR is_super_admin()));

alter policy "inv_update" on public.invitations
  using (((email = (select auth.email())) OR is_super_admin()));

alter policy "uploads_auth_insert" on storage.objects
  with check (
    (bucket_id = 'uploads'::text) AND (
      is_super_admin()
      OR (((storage.foldername(name))[1] = 'avatars'::text) AND (storage.filename(name) ~~ (((select auth.uid()))::text || '-%'::text)))
      OR (((storage.foldername(name))[1] = 'logos'::text) AND (EXISTS (
        SELECT 1 FROM office_users ou
        WHERE ((ou.user_id = (select auth.uid())) AND ou.active AND ((ou.role)::text = ANY (ARRAY['admin'::text, 'owner'::text])) AND (storage.filename(objects.name) ~~ ((ou.office_id)::text || '-%'::text)))
      )))
    )
  );

alter policy "uploads_auth_update" on storage.objects
  using (
    (bucket_id = 'uploads'::text) AND (
      is_super_admin()
      OR (((storage.foldername(name))[1] = 'avatars'::text) AND (storage.filename(name) ~~ (((select auth.uid()))::text || '-%'::text)))
      OR (((storage.foldername(name))[1] = 'logos'::text) AND (EXISTS (
        SELECT 1 FROM office_users ou
        WHERE ((ou.user_id = (select auth.uid())) AND ou.active AND ((ou.role)::text = ANY (ARRAY['admin'::text, 'owner'::text])) AND (storage.filename(objects.name) ~~ ((ou.office_id)::text || '-%'::text)))
      )))
    )
  );
