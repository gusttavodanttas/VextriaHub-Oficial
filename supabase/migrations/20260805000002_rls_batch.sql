-- Lote de RLS (re-auditoria v3). Fecha achados MÉDIA de multi-tenant. Rodar no SQL Editor.
-- (1) movimentacoes_processo (nega tudo por bug de coluna), (2) notifications office-wide,
-- (3) invitations INSERT por membro comum, (4) offices UPDATE por membro comum,
-- (5) bucket uploads sem escopo (sobrescrita cross-tenant).

-- ───────────────────────────────────────────────────────────────────────────
-- (1) movimentacoes_processo: as policies usavam `profiles.id = auth.uid()`, mas o
-- vínculo é `profiles.user_id` → subquery vazia → RLS NEGAVA TUDO (feature quebrada).
-- Reescreve com get_user_office_ids() (helper) + fallback pelo processo. super_admin passa.
drop policy if exists "movimentacoes_select" on public.movimentacoes_processo;
create policy "movimentacoes_select" on public.movimentacoes_processo for select to authenticated using (
  office_id = any(public.get_user_office_ids())
  or processo_id in (select id from public.processos where office_id = any(public.get_user_office_ids()))
  or public.is_super_admin()
);
drop policy if exists "movimentacoes_insert" on public.movimentacoes_processo;
create policy "movimentacoes_insert" on public.movimentacoes_processo for insert to authenticated with check (
  office_id = any(public.get_user_office_ids())
  or processo_id in (select id from public.processos where office_id = any(public.get_user_office_ids()))
);
drop policy if exists "movimentacoes_update" on public.movimentacoes_processo;
create policy "movimentacoes_update" on public.movimentacoes_processo for update to authenticated using (
  office_id = any(public.get_user_office_ids()) or public.is_super_admin()
);
drop policy if exists "movimentacoes_delete" on public.movimentacoes_processo;
create policy "movimentacoes_delete" on public.movimentacoes_processo for delete to authenticated using (
  office_id = any(public.get_user_office_ids()) or public.is_super_admin()
);

-- ───────────────────────────────────────────────────────────────────────────
-- (2) notifications: derruba a policy office-wide (membro lia notificação dos colegas).
-- Ficam só as por-usuário (view/update own do 20260417 + insert self do P1) + delete own.
drop policy if exists "Isolamento por escritório" on public.notifications;
drop policy if exists "Admin do escritório gerencia tudo" on public.notifications;
drop policy if exists "notifications_delete_own" on public.notifications;
create policy "notifications_delete_own" on public.notifications for delete to authenticated
  using (auth.uid() = user_id);

-- ───────────────────────────────────────────────────────────────────────────
-- (3) invitations: só admin/owner (ou super_admin) cria convite — antes um 'user'
-- comum criava convite com role 'admin' pro próprio escritório (cúmplice).
drop policy if exists "inv_insert" on public.invitations;
create policy "inv_insert" on public.invitations for insert to authenticated
  with check (public.is_super_admin() or public.is_office_admin(office_id));

-- ───────────────────────────────────────────────────────────────────────────
-- (4) offices: só admin/owner (ou super) altera o escritório — antes qualquer membro
-- renomeava/alterava dados do escritório.
drop policy if exists "offices_update_admin" on public.offices;
create policy "offices_update_admin" on public.offices for update to authenticated
  using (public.is_super_admin() or public.is_office_admin(id))
  with check (public.is_super_admin() or public.is_office_admin(id));

-- ───────────────────────────────────────────────────────────────────────────
-- (5) bucket uploads: escrita/sobrescrita só do PRÓPRIO arquivo. Caminhos do app:
-- avatars/<uid>-<ts>.ext e logos/<officeId>-<ts>.ext → o dono é o prefixo do nome.
-- Leitura pública segue igual (imagens servidas por URL).
drop policy if exists "uploads_auth_insert" on storage.objects;
create policy "uploads_auth_insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'uploads' and (
      public.is_super_admin()
      or ((storage.foldername(name))[1] = 'avatars' and storage.filename(name) like auth.uid()::text || '-%')
      or ((storage.foldername(name))[1] = 'logos' and exists (
            select 1 from public.office_users ou
            where ou.user_id = auth.uid() and ou.active and ou.role in ('admin','owner')
              and storage.filename(name) like ou.office_id::text || '-%'))
    )
  );
drop policy if exists "uploads_auth_update" on storage.objects;
create policy "uploads_auth_update" on storage.objects for update to authenticated
  using (
    bucket_id = 'uploads' and (
      public.is_super_admin()
      or ((storage.foldername(name))[1] = 'avatars' and storage.filename(name) like auth.uid()::text || '-%')
      or ((storage.foldername(name))[1] = 'logos' and exists (
            select 1 from public.office_users ou
            where ou.user_id = auth.uid() and ou.active and ou.role in ('admin','owner')
              and storage.filename(name) like ou.office_id::text || '-%'))
    )
  );
