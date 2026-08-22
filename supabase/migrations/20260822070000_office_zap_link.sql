-- Vínculo escritório (Hub) ↔ conta do Vextria Zap (user_id no projeto do Zap).
-- É o GATE da ponte: só escritórios com vínculo ATIVO usam a integração — e o
-- super-admin só ativa quando a assinatura do Zap está em dia (verificação via
-- edge bridge). Tenant do Zap = user_id; do Hub = office_id.
create table if not exists public.office_zap_link (
  office_id    uuid primary key references public.offices(id) on delete cascade,
  zap_user_id  uuid not null,          -- user_id (dono) no projeto VextriaZap
  zap_email    text,                   -- e-mail da conta Zap (referência do admin)
  active       boolean not null default true,
  linked_by    uuid,
  linked_at    timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table public.office_zap_link enable row level security;

-- Só super-admin gerencia; membros NÃO leem a tabela (evita expor zap_user_id/email).
drop policy if exists "ozl_admin_all" on public.office_zap_link;
create policy "ozl_admin_all" on public.office_zap_link
  for all using (is_super_admin()) with check (is_super_admin());

-- Gate p/ a UI: o escritório atual tem Zap ativo? (não expõe os ids, só o boolean)
create or replace function public.my_office_has_zap()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.office_zap_link ozl
    where ozl.active and ozl.office_id = any(public.get_user_office_ids())
  );
$$;
revoke execute on function public.my_office_has_zap() from public, anon;
grant execute on function public.my_office_has_zap() to authenticated;
