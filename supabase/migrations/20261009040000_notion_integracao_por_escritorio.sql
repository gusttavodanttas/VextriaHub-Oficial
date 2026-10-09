-- Integração com o Notion POR ESCRITÓRIO (revenda).
--
-- Controle em 3 camadas:
--   1. Plano:        plan_configs.allow_notion (o super admin liga/desliga por plano).
--   2. Exceção:      offices.notion_access = 'plano' | 'liberado' | 'bloqueado' (só super admin muda).
--   3. Escritório:   office_integrations.enabled (o admin do escritório liga/desliga, se permitido).
--
-- Sincronização: triggers em processos/clientes enfileiram mudanças em notion_sync_queue
-- (só quando o escritório está com o Notion ativo). A edge function notion-sync esvazia a fila
-- a cada 5 min (cron) e puxa as edições feitas no Notion de volta, gravando via
-- notion_apply_change(), que liga o flag vextria.skip_notion para não reenfileirar.
-- Tokens ficam em office_integration_secrets (RLS sem policy = só service_role).
--
-- Idempotente: pode ser reaplicada.

set lock_timeout = '10s';

-- ───────────────────────── 1. Vínculo com páginas do Notion ─────────────────────────
alter table public.processos add column if not exists notion_page_id text;
alter table public.clientes  add column if not exists notion_page_id text;
create unique index if not exists processos_notion_page_id_uidx on public.processos(notion_page_id) where notion_page_id is not null;
create unique index if not exists clientes_notion_page_id_uidx  on public.clientes(notion_page_id)  where notion_page_id is not null;

-- ───────────────────────── 2. Chave por plano e exceção por escritório ─────────────────────────
alter table public.plan_configs add column if not exists allow_notion boolean not null default false;
update public.plan_configs set allow_notion = true where plan_type ilike 'PREMIUM%' and not allow_notion;

alter table public.offices add column if not exists notion_access text not null default 'plano';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'offices_notion_access_check') then
    alter table public.offices add constraint offices_notion_access_check check (notion_access in ('plano','liberado','bloqueado'));
  end if;
end $$;

create or replace function public.protect_office_privileges()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user in ('postgres','service_role','supabase_admin')
     or coalesce(auth.jwt() ->> 'role','') = 'service_role'
     or public.is_super_admin() then
    return new;
  end if;
  if new.max_users        is distinct from old.max_users         then raise exception 'Alteração de max_users não autorizada'; end if;
  if new.plan             is distinct from old.plan              then raise exception 'Alteração de plano não autorizada'; end if;
  if new.access_type      is distinct from old.access_type       then raise exception 'Alteração de access_type não autorizada'; end if;
  if new.access_granted_by is distinct from old.access_granted_by then raise exception 'Alteração de concessão de acesso não autorizada'; end if;
  if new.access_granted_at is distinct from old.access_granted_at then raise exception 'Alteração de concessão de acesso não autorizada'; end if;
  if new.access_note      is distinct from old.access_note       then raise exception 'Alteração de nota de acesso não autorizada'; end if;
  if new.active           is distinct from old.active            then raise exception 'Alteração de status ativo não autorizada'; end if;
  if new.created_by       is distinct from old.created_by        then raise exception 'Alteração de proprietário não autorizada'; end if;
  if new.notion_access    is distinct from old.notion_access     then raise exception 'Alteração do acesso ao Notion não autorizada'; end if;
  return new;
end; $$;

-- ───────────────────────── 3. Conexão por escritório ─────────────────────────
create table if not exists public.office_integrations (
  id             uuid primary key default gen_random_uuid(),
  office_id      uuid not null references public.offices(id) on delete cascade,
  provider       text not null check (provider in ('notion')),
  enabled        boolean not null default false,
  status         text not null default 'desconectado' check (status in ('desconectado','conectado','erro')),
  workspace_id   text,
  workspace_name text,
  database_ids   jsonb not null default '{}'::jsonb,   -- {"processos": "...", "clientes": "..."}
  connected_by   uuid references auth.users(id) on delete set null,
  connected_at   timestamptz,
  last_sync_at   timestamptz,
  last_error     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (office_id, provider)
);
alter table public.office_integrations enable row level security;

drop policy if exists office_integrations_select on public.office_integrations;
create policy office_integrations_select on public.office_integrations for select to authenticated
  using (public.user_belongs_to_office(office_id) or public.is_super_admin());
drop policy if exists office_integrations_insert on public.office_integrations;
create policy office_integrations_insert on public.office_integrations for insert to authenticated
  with check (public.is_office_admin(office_id) or public.is_super_admin());
drop policy if exists office_integrations_update on public.office_integrations;
create policy office_integrations_update on public.office_integrations for update to authenticated
  using (public.is_office_admin(office_id) or public.is_super_admin())
  with check (public.is_office_admin(office_id) or public.is_super_admin());
drop policy if exists office_integrations_delete on public.office_integrations;
create policy office_integrations_delete on public.office_integrations for delete to authenticated
  using (public.is_office_admin(office_id) or public.is_super_admin());

create table if not exists public.office_integration_secrets (
  integration_id uuid primary key references public.office_integrations(id) on delete cascade,
  access_token   text,
  refresh_token  text,
  bot_id         text,
  updated_at     timestamptz not null default now()
);
alter table public.office_integration_secrets add column if not exists bot_id text;
alter table public.office_integration_secrets enable row level security;   -- sem policy = só service_role
revoke all on public.office_integration_secrets from anon, authenticated;

create table if not exists public.notion_oauth_states (
  state        text primary key,
  user_id      uuid not null,
  office_id    uuid not null,
  redirect_uri text,
  created_at   timestamptz not null default now()
);
alter table public.notion_oauth_states enable row level security;          -- sem policy
revoke all on public.notion_oauth_states from anon, authenticated;

-- ───────────────────────── 4. Regras de permissão ─────────────────────────
create or replace function public.office_notion_allowed(p_office uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare v_access text; v_type text; v_name text; v_life boolean; v_status text; v_allow boolean;
begin
  select notion_access, access_type::text into v_access, v_type from public.offices where id = p_office;
  if not found then return false; end if;
  if v_access = 'bloqueado' then return false; end if;
  if v_access = 'liberado' then return true; end if;
  if v_type in ('lifetime','courtesy') then return true; end if;
  select plan_name, coalesce(is_lifetime,false), coalesce(status,'') into v_name, v_life, v_status
    from public.office_subscriptions where office_id = p_office;
  if not found then return false; end if;
  if v_life or v_status = 'cortesia' then return true; end if;
  if v_status not in ('ativa','trial') then return false; end if;
  select allow_notion into v_allow from public.plan_configs where plan_name = v_name and is_active limit 1;
  if found then return v_allow; end if;
  return v_name ilike '%premium%';
end; $$;

create or replace function public.office_notion_active(p_office uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.office_notion_allowed(p_office) and coalesce((
    select i.enabled and i.status = 'conectado' from public.office_integrations i
    where i.office_id = p_office and i.provider = 'notion'), false);
$$;

create or replace function public.guard_office_integrations()
returns trigger language plpgsql set search_path = public as $$
declare v_priv boolean := current_user in ('postgres','service_role','supabase_admin')
                         or coalesce(auth.jwt() ->> 'role','') = 'service_role';
begin
  new.updated_at := now();
  if new.enabled and new.provider = 'notion' and not public.office_notion_allowed(new.office_id) then
    raise exception 'O plano deste escritório não inclui a integração com o Notion.' using errcode = 'check_violation';
  end if;
  if v_priv or public.is_super_admin() then return new; end if;
  if tg_op = 'INSERT' then
    new.status := 'desconectado'; new.workspace_id := null; new.workspace_name := null;
    new.database_ids := '{}'::jsonb; new.connected_at := null; new.last_sync_at := null; new.last_error := null;
  elsif new.status is distinct from old.status or new.workspace_id is distinct from old.workspace_id
       or new.workspace_name is distinct from old.workspace_name or new.database_ids is distinct from old.database_ids
       or new.connected_by is distinct from old.connected_by or new.connected_at is distinct from old.connected_at
       or new.last_sync_at is distinct from old.last_sync_at or new.last_error is distinct from old.last_error
       or new.office_id is distinct from old.office_id or new.provider is distinct from old.provider then
    raise exception 'Somente a opção Ligado/Desligado pode ser alterada pelo escritório.';
  end if;
  return new;
end; $$;

drop trigger if exists trg_guard_office_integrations on public.office_integrations;
create trigger trg_guard_office_integrations before insert or update on public.office_integrations
  for each row execute function public.guard_office_integrations();

-- ───────────────────────── 5. RPCs do super admin ─────────────────────────
create or replace function public.admin_set_office_notion_access(p_office uuid, p_access text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_super_admin() then raise exception 'Apenas super admin.'; end if;
  if p_access not in ('plano','liberado','bloqueado') then raise exception 'Valor inválido: use plano, liberado ou bloqueado.'; end if;
  update public.offices set notion_access = p_access, updated_at = now() where id = p_office;
  if p_access = 'bloqueado' then
    update public.office_integrations set enabled = false where office_id = p_office and provider = 'notion';
  end if;
end; $$;

create or replace function public.admin_notion_overview()
returns table(office_id uuid, escritorio text, plano text, status_assinatura text, excecao text,
              permitido boolean, ligado boolean, conexao text, workspace text, ultima_sync timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_super_admin() then raise exception 'Apenas super admin.'; end if;
  return query
  select o.id, o.name, s.plan_name, s.status, o.notion_access, public.office_notion_allowed(o.id),
         coalesce(i.enabled,false), coalesce(i.status,'desconectado'), i.workspace_name, i.last_sync_at
  from public.offices o
  left join public.office_subscriptions s on s.office_id = o.id
  left join public.office_integrations i on i.office_id = o.id and i.provider = 'notion'
  order by o.name;
end; $$;

revoke execute on function public.admin_set_office_notion_access(uuid, text) from public, anon;
revoke execute on function public.admin_notion_overview() from public, anon;
grant  execute on function public.admin_set_office_notion_access(uuid, text) to authenticated;
grant  execute on function public.admin_notion_overview() to authenticated;
revoke execute on function public.office_notion_allowed(uuid) from public, anon;
revoke execute on function public.office_notion_active(uuid) from public, anon;
grant  execute on function public.office_notion_allowed(uuid) to authenticated;
grant  execute on function public.office_notion_active(uuid) to authenticated;

-- ───────────────────────── 6. Status para o card do app ─────────────────────────
create or replace function public.notion_status()
returns table(office_id uuid, permitido boolean, ligado boolean, status text, workspace_name text,
              last_sync_at timestamptz, last_error text, pode_gerenciar boolean, pendentes integer)
language plpgsql stable security definer set search_path = public as $$
declare v_office uuid;
begin
  select coalesce(
    (select p.office_id from public.profiles p where p.user_id = auth.uid()),
    (select ou.office_id from public.office_users ou where ou.user_id = auth.uid() and ou.active order by ou.joined_at limit 1)
  ) into v_office;
  if v_office is null then return; end if;
  return query
  select v_office, public.office_notion_allowed(v_office), coalesce(i.enabled,false),
         coalesce(i.status,'desconectado'), i.workspace_name, i.last_sync_at, i.last_error,
         (public.is_office_admin(v_office) or public.is_super_admin()),
         (select count(*)::int from public.notion_sync_queue q where q.office_id = v_office)
  from (select 1) x
  left join public.office_integrations i on i.office_id = v_office and i.provider = 'notion';
end; $$;

-- ───────────────────────── 7. Fila de sincronização ─────────────────────────
create table if not exists public.notion_sync_queue (
  id             bigserial primary key,
  office_id      uuid not null references public.offices(id) on delete cascade,
  entity         text not null check (entity in ('processo','cliente')),
  entity_id      uuid not null,
  op             text not null check (op in ('upsert','delete')),
  notion_page_id text,
  mode           text not null default 'full' check (mode in ('full','fill')),  -- fill = carga inicial: só preenche campos vazios no Notion
  attempts       integer not null default 0,
  last_error     text,
  created_at     timestamptz not null default now(),
  unique (entity, entity_id)
);
alter table public.notion_sync_queue add column if not exists mode text not null default 'full' check (mode in ('full','fill'));
create index if not exists notion_sync_queue_office_idx on public.notion_sync_queue(office_id, created_at);
alter table public.notion_sync_queue enable row level security;            -- sem policy
revoke all on public.notion_sync_queue from anon, authenticated;

revoke execute on function public.notion_status() from public, anon;
grant  execute on function public.notion_status() to authenticated;

create or replace function public.notion_enqueue()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_office uuid;
  v_id     uuid;
  v_entity text := case tg_table_name when 'processos' then 'processo' else 'cliente' end;
  v_op     text := 'upsert';
  v_page   text;
  v_ignore text[] := array['updated_at','sincronizado_em','notion_page_id','data_ultima_atualizacao'];
begin
  if coalesce(current_setting('vextria.skip_notion', true), '') = '1' then return null; end if;
  if tg_op = 'DELETE' then v_office := old.office_id; v_id := old.id;
  else v_office := new.office_id; v_id := new.id; end if;
  if v_office is null or not public.office_notion_active(v_office) then return null; end if;

  if tg_op = 'DELETE' then
    v_op := 'delete'; v_page := old.notion_page_id;
    if v_page is null then return null; end if;
  elsif tg_op = 'UPDATE' then
    if (to_jsonb(new) - v_ignore) = (to_jsonb(old) - v_ignore) then return null; end if;
    if coalesce(new.deletado, false) then v_op := 'delete'; end if;
    v_page := new.notion_page_id;
  else
    if coalesce(new.deletado, false) then return null; end if;
    v_page := new.notion_page_id;
  end if;

  insert into public.notion_sync_queue (office_id, entity, entity_id, op, notion_page_id)
  values (v_office, v_entity, v_id, v_op, v_page)
  on conflict (entity, entity_id) do update
    set op = excluded.op, notion_page_id = coalesce(excluded.notion_page_id, notion_sync_queue.notion_page_id),
        office_id = excluded.office_id, mode = 'full', attempts = 0, last_error = null, created_at = now();
  return null;
end; $$;
revoke execute on function public.notion_enqueue() from public, anon, authenticated;

create or replace trigger trg_notion_enqueue after insert or update or delete on public.processos
  for each row execute function public.notion_enqueue();
create or replace trigger trg_notion_enqueue after insert or update or delete on public.clientes
  for each row execute function public.notion_enqueue();

-- Carga inicial (chamada pelo callback ao conectar e pelo botão "Sincronizar tudo").
create or replace function public.notion_enqueue_all(p_office uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer := 0; m integer := 0;
begin
  if not (current_user in ('postgres','service_role','supabase_admin')
          or coalesce(auth.jwt() ->> 'role','') = 'service_role'
          or public.is_office_admin(p_office) or public.is_super_admin()) then
    raise exception 'Sem permissão.';
  end if;
  insert into public.notion_sync_queue (office_id, entity, entity_id, op, notion_page_id, mode)
  select office_id, 'cliente', id, 'upsert', notion_page_id, 'fill' from public.clientes
   where office_id = p_office and not coalesce(deletado,false)
  on conflict (entity, entity_id) do nothing;
  get diagnostics n = row_count;
  insert into public.notion_sync_queue (office_id, entity, entity_id, op, notion_page_id, mode)
  select office_id, 'processo', id, 'upsert', notion_page_id, 'fill' from public.processos
   where office_id = p_office and not coalesce(deletado,false)
  on conflict (entity, entity_id) do nothing;
  get diagnostics m = row_count;
  return n + m;
end; $$;
revoke execute on function public.notion_enqueue_all(uuid) from public, anon;
grant  execute on function public.notion_enqueue_all(uuid) to authenticated;

-- ───────────────────────── 8. Escrita vinda do Notion (só service_role) ─────────────────────────
-- p_entity: 'processo' | 'cliente'. p_id nulo = criar. p_data: colunas permitidas (texto/data/uuid).
-- Retorna o id do registro. Não reenfileira (vextria.skip_notion = 1 na transação).
create or replace function public.notion_apply_change(p_office uuid, p_entity text, p_id uuid, p_data jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id   uuid := p_id;
  v_user uuid;
  v_allowed text[];
  v_cols text := ''; v_vals text := ''; v_set text := '';
  k text; v jsonb; v_table text;
begin
  if not (current_user in ('postgres','service_role','supabase_admin')
          or coalesce(auth.jwt() ->> 'role','') = 'service_role') then
    raise exception 'Somente o serviço de sincronização pode usar esta função.';
  end if;
  perform set_config('vextria.skip_notion', '1', true);

  if p_entity = 'processo' then
    v_table := 'processos';
    v_allowed := array['numero_processo','titulo','cliente_id','tribunal','comarca','vara','sistema_tribunal','instancia',
                       'fase_processual','tipo_processo','parte_autora','requerido','status','proximo_prazo','observacoes',
                       'notion_page_id','sincronizado_em','deletado'];
  elsif p_entity = 'cliente' then
    v_table := 'clientes';
    v_allowed := array['nome','email','telefone','cpf_cnpj','status','observacoes','notion_page_id','deletado'];
  else
    raise exception 'Entidade inválida: %', p_entity;
  end if;

  for k, v in select * from jsonb_each(p_data) loop
    if not (k = any(v_allowed)) then continue; end if;
    if v_id is null then
      v_cols := v_cols || format('%I,', k);
      v_vals := v_vals || format('(jsonb_populate_record(null::public.%I, %L::jsonb)).%I,', v_table, jsonb_build_object(k, v), k);
    else
      v_set := v_set || format('%I = (jsonb_populate_record(null::public.%I, %L::jsonb)).%I,', k, v_table, jsonb_build_object(k, v), k);
    end if;
  end loop;

  if v_id is null then
    select connected_by into v_user from public.office_integrations where office_id = p_office and provider = 'notion';
    if v_user is null then
      select ou.user_id into v_user from public.office_users ou where ou.office_id = p_office and ou.active order by ou.joined_at limit 1;
    end if;
    execute format('insert into public.%I (%s office_id, user_id) values (%s %L::uuid, %L::uuid) returning id',
                   v_table, v_cols, v_vals, p_office, v_user) into v_id;
  elsif v_set <> '' then
    execute format('update public.%I set %s updated_at = now() where id = %L::uuid and office_id = %L::uuid',
                   v_table, v_set, v_id, p_office);
  end if;
  return v_id;
end; $$;
revoke execute on function public.notion_apply_change(uuid, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.notion_apply_change(uuid, text, uuid, jsonb) to service_role;
grant execute on function public.notion_enqueue_all(uuid) to service_role;
grant all on public.notion_sync_queue, public.notion_oauth_states, public.office_integration_secrets, public.office_integrations to service_role;
grant usage, select on sequence public.notion_sync_queue_id_seq to service_role;

-- ───────────────────────── 9. Cron (a cada 5 min) ─────────────────────────
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- cron.schedule com o mesmo nome substitui o job existente (pg_cron >= 1.4).
    perform cron.schedule('notion-sync-5min', '*/5 * * * *', $cron$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/notion-sync',
        headers := jsonb_build_object(
          'Content-Type','application/json',
          'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
          'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
          'x-robot-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'robot_secret')),
        body := '{}'::jsonb,
        timeout_milliseconds := 120000)
      where exists (select 1 from public.office_integrations
                    where provider = 'notion' and enabled and status = 'conectado');
    $cron$);
  end if;
end $$;

-- ───────────────────────── 10. Limpeza de apoio da importação manual ─────────────────────────
drop schema if exists notion_sync cascade;
