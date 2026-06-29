-- Bucket público "uploads" para fotos de perfil (avatars/) e logos de escritório (logos/)
insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', true)
on conflict (id) do nothing;

-- Leitura pública (imagens são exibidas via URL pública)
drop policy if exists "uploads_public_read" on storage.objects;
create policy "uploads_public_read"
  on storage.objects for select
  using (bucket_id = 'uploads');

-- Usuários autenticados podem enviar
drop policy if exists "uploads_auth_insert" on storage.objects;
create policy "uploads_auth_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'uploads');

-- Usuários autenticados podem sobrescrever/atualizar
drop policy if exists "uploads_auth_update" on storage.objects;
create policy "uploads_auth_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'uploads');
