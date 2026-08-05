-- P0 de segurança (re-auditoria v2, ago/2026). Rodar no SQL Editor.
-- Fecha: (1) policy tautológica de office_users, (2) user_permissions sem RLS,
-- (3) bypass de acesso grátis via 'pendente', (4) USING(true) em publicacoes/termos.

-- ─────────────────────────────────────────────────────────────────────────
-- P0 #1 — office_users: remover a policy legada tautológica (office_id=office_id,
-- sempre true) que reabre a auto-promoção cross-tenant e ANULA o role_guard.
-- Recria o conjunto correto de policies (select/insert/update/delete).
drop policy if exists "Office admins podem gerenciar usuários do escritório" on public.office_users;

drop policy if exists "office_users_select" on public.office_users;
create policy "office_users_select" on public.office_users for select to authenticated
  using (user_id = auth.uid() or office_id = any(public.get_user_office_ids()) or public.is_super_admin());

drop policy if exists "office_users_insert" on public.office_users;
create policy "office_users_insert" on public.office_users for insert to authenticated
  with check (public.is_super_admin() or public.is_office_admin(office_id));

drop policy if exists "office_users_update" on public.office_users;
create policy "office_users_update" on public.office_users for update to authenticated
  using (public.is_super_admin() or public.is_office_admin(office_id))
  with check (public.is_super_admin() or public.is_office_admin(office_id));

drop policy if exists "office_users_delete" on public.office_users;
create policy "office_users_delete" on public.office_users for delete to authenticated
  using (public.is_super_admin() or public.is_office_admin(office_id));

-- ─────────────────────────────────────────────────────────────────────────
-- P0 #2 — user_permissions: habilitar RLS (não havia no repo). Usuário lê as
-- próprias; admin do escritório lê/gerencia as do office; super_admin tudo.
-- Escrita NUNCA pelo próprio alvo (evita auto-conceder permissão).
alter table public.user_permissions enable row level security;

drop policy if exists "user_permissions_select" on public.user_permissions;
create policy "user_permissions_select" on public.user_permissions for select to authenticated
  using (user_id = auth.uid() or public.is_office_admin(office_id) or public.is_super_admin());

drop policy if exists "user_permissions_write" on public.user_permissions;
create policy "user_permissions_write" on public.user_permissions for all to authenticated
  using (public.is_office_admin(office_id) or public.is_super_admin())
  with check (public.is_office_admin(office_id) or public.is_super_admin());

-- ─────────────────────────────────────────────────────────────────────────
-- P0 #3 — fim do bypass do 'pendente': acesso só com trial válido, ativa,
-- cortesia ou vitalício. 'pendente'/'atrasada'/'cancelada' NÃO dão acesso
-- (paga pra ativar). Fecha o "re-setup renova 3 dias grátis pra sempre".
create or replace function public.office_has_access(p_office uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select s.is_lifetime
        or s.status in ('ativa','cortesia')
        or (s.status = 'trial' and (s.trial_ends_at is null or s.trial_ends_at >= current_date))
    from public.office_subscriptions s
    where s.office_id = p_office
  ), false);
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- P0 #4 — publicacoes / monitoramento_termos: derrubar a policy aberta
-- USING(true) (fix_rls.sql) e escopar por escritório (super_admin passa;
-- o paid_gate RESTRICTIVE continua valendo por cima).
drop policy if exists "Publicacoes Access" on public.publicacoes;
drop policy if exists "Acesso por escritório ou dono" on public.publicacoes;
create policy "publicacoes_office_scope" on public.publicacoes for all to authenticated
  using (office_id = any(public.get_user_office_ids()) or public.is_super_admin())
  with check (office_id = any(public.get_user_office_ids()) or public.is_super_admin());

drop policy if exists "Monitoramento Access" on public.monitoramento_termos;
create policy "monitoramento_office_scope" on public.monitoramento_termos for all to authenticated
  using (office_id = any(public.get_user_office_ids()) or public.is_super_admin())
  with check (office_id = any(public.get_user_office_ids()) or public.is_super_admin());
