-- ============================================================
-- Correção de isolamento multi-tenant (auditoria ago/2026)
-- ============================================================

-- 1) P1: convite reescrevível -> escalonamento de privilégio.
-- Trigger impede o convidado (não-admin) de alterar role/office_id/email/token
-- do próprio convite. Admin do office e service_role seguem livres; status pode mudar (aceitar).
create or replace function public.protect_invitation_columns()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if current_user in ('postgres','service_role','supabase_admin')
     or coalesce(auth.jwt() ->> 'role','') = 'service_role' then
    return new;
  end if;
  if public.is_super_admin() or public.is_office_admin(old.office_id) then
    return new;
  end if;
  if new.role is distinct from old.role
     or new.office_id is distinct from old.office_id
     or lower(coalesce(new.email,'')) is distinct from lower(coalesce(old.email,''))
     or coalesce(new.token::text,'') is distinct from coalesce(old.token::text,'') then
    raise exception 'Nao e permitido alterar papel, escritorio ou e-mail do convite';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_invitation_columns on public.invitations;
create trigger trg_protect_invitation_columns
  before update on public.invitations
  for each row execute function public.protect_invitation_columns();

-- 2) P2: user_permissions — remove a policy fraca antiga (membro comum se autoconcedia).
-- Ficam user_permissions_write (admin) e user_permissions_select (proprio/admin).
drop policy if exists "office members can manage user_permissions" on public.user_permissions;

-- 3) P2: movimentacoes_processo — remove policy antiga por profiles.office_id (ex-membro lia/escrevia).
-- Ficam movimentacoes_select/insert/update/delete (get_user_office_ids, com active).
drop policy if exists "Movimentacoes do escritorio" on public.movimentacoes_processo;

-- 4) P2: processos_descartados — troca a unica policy (profiles.office_id) por get_user_office_ids.
drop policy if exists "Users can manage own office discards" on public.processos_descartados;
create policy processos_descartados_all on public.processos_descartados
  for all
  using (office_id = any(public.get_user_office_ids()) or public.is_super_admin())
  with check (office_id = any(public.get_user_office_ids()) or public.is_super_admin());

-- 5) P2: clientes_select — 3a clausula (id em processos.cliente_id) permitia ler cliente
-- de outro escritorio via processo com cliente_id forjado. Escopa ao proprio office.
drop policy if exists clientes_select on public.clientes;
create policy clientes_select on public.clientes
  for select
  using (
    public.is_office_admin(office_id)
    or (user_id in ( select public.team_visible_user_ids(clientes.office_id) ))
    or (
      office_id = any(public.get_user_office_ids())
      and id in (
        select p.cliente_id from public.processos p
        where p.cliente_id is not null
          and p.office_id = any(public.get_user_office_ids())
      )
    )
  );

-- 6) P3: consultivo_categorias — adiciona escopo por get_user_office_ids (exclui ex-membro).
drop policy if exists "office members can manage categorias" on public.consultivo_categorias;
create policy consultivo_categorias_all on public.consultivo_categorias
  for all
  using (office_id = any(public.get_user_office_ids()) or public.is_super_admin())
  with check (office_id = any(public.get_user_office_ids()) or public.is_super_admin());
