-- ============================================================================
-- Compartilhamento de processos entre escritórios parceiros
-- ----------------------------------------------------------------------------
-- Um escritório (DONO) compartilha UM processo com outro escritório (PARCEIRO),
-- com permissão 'ver' (só leitura) ou 'editar' (registrar andamentos, tarefas,
-- prazos e audiências). O parceiro passa a enxergar o processo e seus filhos de
-- COLABORAÇÃO — sem ver o financeiro/timesheet internos do dono.
--
-- Princípios de segurança (multi-tenant):
--  * A visibilidade do parceiro é concedida APENAS para os processo_ids que
--    estiverem em process_shares (função SECURITY DEFINER shared_processo_ids),
--    somada por OR às policies existentes. Não afrouxa nada do isolamento atual:
--    quem não tem share continua vendo exatamente o que via antes.
--  * O office_paid_gate (RESTRICTIVE) permanece ancorado no office_id do DONO da
--    linha. Logo o parceiro só enxerga enquanto o DONO estiver adimplente, e não
--    ganha acesso à plataforma para os dados próprios (esses seguem barrados pelo
--    gate do próprio escritório) — não há "carona" de assinatura.
--  * Compartilhar/revogar é ação de ADMIN do escritório dono (is_office_admin).
--  * Financeiro e timesheets do dono continuam privados (não entram no share).
-- ============================================================================

-- 1) Tabela de compartilhamentos ---------------------------------------------
create table if not exists public.process_shares (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid not null references public.processos(id) on delete cascade,
  owner_office_id uuid not null references public.offices(id) on delete cascade,
  shared_office_id uuid not null references public.offices(id) on delete cascade,
  -- Snapshot dos nomes: cada lado mostra o nome do outro escritório sem precisar
  -- ler a linha de offices do outro (que a RLS de offices esconde).
  owner_office_name text,
  shared_office_name text,
  permission text not null default 'ver' check (permission in ('ver','editar')),
  shared_by uuid references auth.users(id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint process_shares_not_self check (owner_office_id <> shared_office_id),
  constraint process_shares_unique unique (processo_id, shared_office_id)
);

create index if not exists idx_process_shares_shared_office on public.process_shares(shared_office_id);
create index if not exists idx_process_shares_processo on public.process_shares(processo_id);
create index if not exists idx_process_shares_owner_office on public.process_shares(owner_office_id);

alter table public.process_shares enable row level security;

-- 2) Funções auxiliares (SECURITY DEFINER — sem recursão com as policies) -----
create or replace function public.shared_processo_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select processo_id from public.process_shares
  where shared_office_id = any(public.get_user_office_ids())
$$;

create or replace function public.shared_processo_ids_editavel()
returns setof uuid language sql stable security definer set search_path = public as $$
  select processo_id from public.process_shares
  where shared_office_id = any(public.get_user_office_ids())
    and permission = 'editar'
$$;

-- 3) RLS da própria process_shares -------------------------------------------
-- Vê: admin do DONO, qualquer membro do PARCEIRO (para "Compartilhados comigo")
-- e super admin.
drop policy if exists process_shares_select on public.process_shares;
create policy process_shares_select on public.process_shares for select
  using (
    public.is_office_admin(owner_office_id)
    or (shared_office_id = any(public.get_user_office_ids()))
    or public.is_super_admin()
  );

-- Cria/edita/remove: só admin do escritório DONO (ou super admin).
drop policy if exists process_shares_insert on public.process_shares;
create policy process_shares_insert on public.process_shares for insert
  with check ( public.is_office_admin(owner_office_id) or public.is_super_admin() );

drop policy if exists process_shares_update on public.process_shares;
create policy process_shares_update on public.process_shares for update
  using ( public.is_office_admin(owner_office_id) or public.is_super_admin() )
  with check ( public.is_office_admin(owner_office_id) or public.is_super_admin() );

drop policy if exists process_shares_delete on public.process_shares;
create policy process_shares_delete on public.process_shares for delete
  using ( public.is_office_admin(owner_office_id) or public.is_super_admin() );

-- 4) Estende a visibilidade dos processos e filhos aos parceiros --------------
-- Em cada policy abaixo o único trecho NOVO é a última linha (o OR do share);
-- o resto é idêntico ao que já existia.

-- processos: SELECT ganha "ou está compartilhado comigo".
drop policy if exists processos_select on public.processos;
create policy processos_select on public.processos for select
  using (
    public.is_office_admin(office_id)
    or (coalesce(responsavel_id, user_id) in (select team_visible_user_ids(office_id)))
    or (team_id in (select coordinated_team_ids(office_id)))
    or (id in (select shared_processo_ids()))
  );
-- processos UPDATE/DELETE: sem alteração — o cabeçalho do processo (cliente,
-- office, team, número) só o DONO edita/apaga.

-- prazos ---------------------------------------------------------------------
drop policy if exists prazos_select on public.prazos;
create policy prazos_select on public.prazos for select
  using (
    public.is_office_admin(office_id)
    or (responsavel_id in (select team_visible_user_ids(office_id)))
    or (processo_id in (select shared_processo_ids()))
  );
drop policy if exists prazos_insert on public.prazos;
create policy prazos_insert on public.prazos for insert
  with check (
    (office_id is null)
    or public.user_belongs_to_office(office_id)
    or (processo_id in (select shared_processo_ids_editavel()))
  );
drop policy if exists prazos_update on public.prazos;
create policy prazos_update on public.prazos for update
  using (
    public.is_office_admin(office_id)
    or (responsavel_id in (select team_visible_user_ids(office_id)))
    or (processo_id in (select shared_processo_ids_editavel()))
  );
-- prazos_delete: sem alteração (parceiro não apaga prazo do dono).

-- audiencias -----------------------------------------------------------------
drop policy if exists audiencias_select on public.audiencias;
create policy audiencias_select on public.audiencias for select
  using (
    public.is_office_admin(office_id)
    or (coalesce(responsavel_id, user_id) in (select team_visible_user_ids(office_id)))
    or (processo_id in (select shared_processo_ids()))
  );
drop policy if exists audiencias_insert on public.audiencias;
create policy audiencias_insert on public.audiencias for insert
  with check (
    (user_id = auth.uid())
    and (
      (office_id is null)
      or public.user_belongs_to_office(office_id)
      or (processo_id in (select shared_processo_ids_editavel()))
    )
  );
drop policy if exists audiencias_update on public.audiencias;
create policy audiencias_update on public.audiencias for update
  using (
    public.is_office_admin(office_id)
    or (coalesce(responsavel_id, user_id) in (select team_visible_user_ids(office_id)))
    or (processo_id in (select shared_processo_ids_editavel()))
  );
-- audiencias_delete: sem alteração.

-- tarefas --------------------------------------------------------------------
drop policy if exists tarefas_select on public.tarefas;
create policy tarefas_select on public.tarefas for select
  using (
    public.is_office_admin(office_id)
    or (coalesce(responsavel_id, user_id) in (select team_visible_user_ids(office_id)))
    or (processo_id in (select shared_processo_ids()))
  );
drop policy if exists tarefas_insert on public.tarefas;
create policy tarefas_insert on public.tarefas for insert
  with check (
    (user_id = auth.uid())
    and (
      (office_id is null)
      or public.user_belongs_to_office(office_id)
      or (processo_id in (select shared_processo_ids_editavel()))
    )
  );
drop policy if exists tarefas_update on public.tarefas;
create policy tarefas_update on public.tarefas for update
  using (
    public.is_office_admin(office_id)
    or (coalesce(responsavel_id, user_id) in (select team_visible_user_ids(office_id)))
    or (processo_id in (select shared_processo_ids_editavel()))
  );
-- tarefas_delete: sem alteração.

-- atendimentos (só leitura para o parceiro) ----------------------------------
drop policy if exists atendimentos_select on public.atendimentos;
create policy atendimentos_select on public.atendimentos for select
  using (
    public.is_office_admin(office_id)
    or (coalesce(responsavel_id, user_id) in (select team_visible_user_ids(office_id)))
    or (processo_id in (select shared_processo_ids()))
  );
-- atendimentos insert/update/delete: sem alteração (o parceiro registra trabalho
-- via andamentos, não via CRM/atendimento do dono).

-- movimentacoes_processo (andamentos) — a espinha da colaboração --------------
drop policy if exists movimentacoes_select on public.movimentacoes_processo;
create policy movimentacoes_select on public.movimentacoes_processo for select
  using (
    (office_id = any(get_user_office_ids()))
    or (processo_id in (select processos.id from processos where processos.office_id = any(get_user_office_ids())))
    or (processo_id in (select shared_processo_ids()))
    or is_super_admin()
  );
drop policy if exists movimentacoes_insert on public.movimentacoes_processo;
create policy movimentacoes_insert on public.movimentacoes_processo for insert
  with check (
    (office_id = any(get_user_office_ids()))
    or (processo_id in (select processos.id from processos where processos.office_id = any(get_user_office_ids())))
    or (processo_id in (select shared_processo_ids_editavel()))
  );
drop policy if exists movimentacoes_update on public.movimentacoes_processo;
create policy movimentacoes_update on public.movimentacoes_processo for update
  using (
    (office_id = any(get_user_office_ids()))
    or (processo_id in (select shared_processo_ids_editavel()))
    or is_super_admin()
  );
-- movimentacoes_delete: sem alteração.

-- 5) RPC de compartilhamento por e-mail --------------------------------------
-- Resolve o escritório parceiro pelo e-mail (do escritório OU do administrador),
-- valida que quem chama é admin do dono, e grava/atualiza o share. Devolve o nome
-- do parceiro para a UI confirmar. Admin-gated e SECURITY DEFINER.
create or replace function public.share_processo_with_office(
  p_processo_id uuid,
  p_email text,
  p_permission text default 'ver'
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_owner_office uuid;
  v_owner_name text;
  v_target_office uuid;
  v_target_name text;
  v_perm text := lower(coalesce(p_permission, 'ver'));
begin
  if v_perm not in ('ver', 'editar') then
    raise exception 'Permissão inválida (use ver ou editar).' using errcode = '22023';
  end if;

  select p.office_id, o.name into v_owner_office, v_owner_name
  from public.processos p join public.offices o on o.id = p.office_id
  where p.id = p_processo_id;

  if v_owner_office is null then
    raise exception 'Processo não encontrado.' using errcode = 'P0002';
  end if;

  if not (public.is_office_admin(v_owner_office) or public.is_super_admin()) then
    raise exception 'Apenas administradores do escritório podem compartilhar processos.' using errcode = '42501';
  end if;

  -- 1º: casa pelo e-mail do próprio escritório.
  select o.id, o.name into v_target_office, v_target_name
  from public.offices o
  where lower(o.email) = lower(trim(p_email)) and o.active
  limit 1;

  -- 2º: casa pelo e-mail de um administrador ativo de algum escritório.
  if v_target_office is null then
    select o.id, o.name into v_target_office, v_target_name
    from auth.users u
    join public.office_users ou on ou.user_id = u.id and ou.active and ou.role in ('admin', 'super_admin')
    join public.offices o on o.id = ou.office_id and o.active
    where lower(u.email) = lower(trim(p_email))
    limit 1;
  end if;

  if v_target_office is null then
    raise exception 'Nenhum escritório encontrado com esse e-mail. Peça ao parceiro o e-mail de cadastro do escritório (ou do administrador dele).' using errcode = 'P0002';
  end if;

  if v_target_office = v_owner_office then
    raise exception 'Esse e-mail é do seu próprio escritório.' using errcode = '22023';
  end if;

  insert into public.process_shares(
    processo_id, owner_office_id, shared_office_id, owner_office_name, shared_office_name, permission, shared_by
  )
  values (p_processo_id, v_owner_office, v_target_office, v_owner_name, v_target_name, v_perm, auth.uid())
  on conflict (processo_id, shared_office_id)
  do update set permission = excluded.permission, updated_at = now(), shared_by = auth.uid(),
                owner_office_name = excluded.owner_office_name, shared_office_name = excluded.shared_office_name;

  return jsonb_build_object('ok', true, 'office_id', v_target_office, 'office_name', v_target_name, 'permission', v_perm);
end;
$$;

revoke all on function public.share_processo_with_office(uuid, text, text) from public;
grant execute on function public.share_processo_with_office(uuid, text, text) to authenticated;
