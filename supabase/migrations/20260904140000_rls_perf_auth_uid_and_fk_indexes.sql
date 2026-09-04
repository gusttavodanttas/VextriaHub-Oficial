-- ============================================================================
-- DESEMPENHO DE RLS: auth.uid() cacheado por consulta + índices em FK sem
-- cobertura (correção P3 da análise de set/2026)
-- ============================================================================
-- O advisor de desempenho do Supabase aponta dois padrões repetidos:
--
-- 1) 33 políticas chamam auth.uid()/auth.jwt()/auth.role() cru na expressão.
--    O Postgres reavalia essas funções LINHA A LINHA (não são tratadas como
--    initplan). Envolver em (select auth.uid()) faz o planner cachear o
--    resultado uma vez por consulta — mesma regra, mesmo comportamento,
--    só mais rápido. É a otimização de RLS com melhor retorno que existe;
--    https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
--
-- 2) 56 chaves estrangeiras sem índice de cobertura. Hoje o volume de dados
--    esconde (poucos escritórios reais em produção); numa tabela grande,
--    cada join ou delete em cascata vira varredura completa.
--
-- GERADO PROGRAMATICAMENTE a partir de pg_policies e pg_constraint (não
-- digitado à mão) — evita erro de transcrição numa migration que mexe direto
-- na RLS. As expressões abaixo são a MESMA lógica das políticas atuais, só
-- com auth.<fn>() reescrito; nenhuma regra de acesso muda.
--
-- Six tabelas com RLS ligada e sem NENHUMA política (google_integrations,
-- google_oauth_states, zap_synced_leads, process_search_log,
-- trial_reminder_log, google_calendar_map) ficam de fora de propósito: são
-- seguras (negam tudo ao cliente, só o service role entra) e não têm auth.*
-- pra otimizar.
-- ============================================================================

begin;

-- ── 1) auth.uid()/jwt()/role() cacheado por consulta (33 políticas) ────────


alter policy "atendimentos_insert" on public.atendimentos
  with check (
    ((user_id = (select auth.uid())) AND ((office_id IS NULL) OR user_belongs_to_office(office_id)))
  );

alter policy "audiencias_insert" on public.audiencias
  with check (
    ((user_id = (select auth.uid())) AND ((office_id IS NULL) OR user_belongs_to_office(office_id) OR (processo_id IN ( SELECT shared_processo_ids_editavel() AS shared_processo_ids_editavel))))
  );

alter policy "clientes_insert" on public.clientes
  with check (
    ((user_id = (select auth.uid())) AND ((office_id IS NULL) OR user_belongs_to_office(office_id)))
  );

alter policy "consultivos_insert" on public.consultivos
  with check (
    ((user_id = (select auth.uid())) AND ((office_id IS NULL) OR user_belongs_to_office(office_id)))
  );

alter policy "service role only email_digest_log" on public.email_digest_log
  using (
    ((select auth.role()) = 'service_role'::text)
  )
  with check (
    ((select auth.role()) = 'service_role'::text)
  );

alter policy "excl_insert_own" on public.exclusoes_pendentes
  with check (
    ((select auth.uid()) = user_id)
  );

alter policy "excl_select_own" on public.exclusoes_pendentes
  using (
    ((select auth.uid()) = user_id)
  );

alter policy "financeiro_insert" on public.financeiro
  with check (
    ((user_id = (select auth.uid())) AND ((office_id IS NULL) OR user_belongs_to_office(office_id)))
  );

alter policy "admins can delete invitations" on public.invitations
  using (
    (EXISTS ( SELECT 1
   FROM office_users
  WHERE ((office_users.office_id = invitations.office_id) AND (office_users.user_id = (select auth.uid())) AND (office_users.role = 'admin'::app_role) AND (office_users.active = true))))
  );

alter policy "metas_insert" on public.metas
  with check (
    ((user_id = (select auth.uid())) AND ((office_id IS NULL) OR user_belongs_to_office(office_id)))
  );

alter policy "notif_insert" on public.notifications
  with check (
    (((select auth.role()) = 'service_role'::text) OR ((select auth.uid()) = user_id))
  );

alter policy "notif_select" on public.notifications
  using (
    ((select auth.uid()) = user_id)
  );

alter policy "notif_update" on public.notifications
  using (
    ((select auth.uid()) = user_id)
  );

alter policy "notifications_delete_own" on public.notifications
  using (
    ((select auth.uid()) = user_id)
  );

alter policy "notifications_insert_self" on public.notifications
  with check (
    ((select auth.uid()) = user_id)
  );

alter policy "office_users_select" on public.office_users
  using (
    ((user_id = (select auth.uid())) OR (office_id = ANY (get_user_office_ids())) OR is_super_admin())
  );

alter policy "offices_insert_auth" on public.offices
  with check (
    ((select auth.uid()) = created_by)
  );

alter policy "processos_insert" on public.processos
  with check (
    ((user_id = (select auth.uid())) AND ((office_id IS NULL) OR user_belongs_to_office(office_id)))
  );

alter policy "office members can view each other profiles" on public.profiles
  using (
    (office_id IN ( SELECT office_users.office_id
   FROM office_users
  WHERE ((office_users.user_id = (select auth.uid())) AND (office_users.active = true))))
  );

alter policy "profiles_insert_own" on public.profiles
  with check (
    (((select auth.uid()) = user_id) AND ((role = 'user'::app_role) OR is_super_admin()))
  );

alter policy "profiles_select_own" on public.profiles
  using (
    ((select auth.uid()) = user_id)
  );

alter policy "profiles_update_own" on public.profiles
  using (
    ((select auth.uid()) = user_id)
  )
  with check (
    (((select auth.uid()) = user_id) AND ((role <> 'super_admin'::app_role) OR is_super_admin()))
  );

alter policy "autor atualiza proprio comentario" on public.tarefa_comentarios
  using (
    (user_id = (select auth.uid()))
  );

alter policy "membros inserem comentarios no escritorio" on public.tarefa_comentarios
  with check (
    ((office_id = ANY (get_user_office_ids())) AND (user_id = (select auth.uid())))
  );

alter policy "service role acesso total comentarios" on public.tarefa_comentarios
  using (
    ((select auth.role()) = 'service_role'::text)
  );

alter policy "service role acesso total subtarefas" on public.tarefa_subtarefas
  using (
    ((select auth.role()) = 'service_role'::text)
  );

alter policy "tarefas_insert" on public.tarefas
  with check (
    ((user_id = (select auth.uid())) AND ((office_id IS NULL) OR user_belongs_to_office(office_id) OR (processo_id IN ( SELECT shared_processo_ids_editavel() AS shared_processo_ids_editavel))))
  );

alter policy "timesheets_insert" on public.timesheets
  with check (
    ((user_id = (select auth.uid())) AND ((office_id IS NULL) OR user_belongs_to_office(office_id)))
  );

alter policy "office members can manage tipos_ato" on public.tipos_ato_prazo
  using (
    (office_id IN ( SELECT office_users.office_id
   FROM office_users
  WHERE ((office_users.user_id = (select auth.uid())) AND (office_users.active = true))))
  );

alter policy "unp_insert_own" on public.user_notification_prefs
  with check (
    (user_id = (select auth.uid()))
  );

alter policy "unp_select_own" on public.user_notification_prefs
  using (
    (user_id = (select auth.uid()))
  );

alter policy "unp_update_own" on public.user_notification_prefs
  using (
    (user_id = (select auth.uid()))
  )
  with check (
    (user_id = (select auth.uid()))
  );

alter policy "user_permissions_select" on public.user_permissions
  using (
    ((user_id = (select auth.uid())) OR is_office_admin(office_id) OR is_super_admin())
  );

-- ── 2) Índices de cobertura para FK sem índice (56 tabelas×coluna) ─────────

create index if not exists idx_atendimentos_cliente_id on public.atendimentos (cliente_id);
create index if not exists idx_atendimentos_office_id on public.atendimentos (office_id);
create index if not exists idx_atendimentos_responsavel_id on public.atendimentos (responsavel_id);
create index if not exists idx_atendimentos_user_id on public.atendimentos (user_id);
create index if not exists idx_audiencias_cliente_id on public.audiencias (cliente_id);
create index if not exists idx_audiencias_processo_id on public.audiencias (processo_id);
create index if not exists idx_audiencias_responsavel_id on public.audiencias (responsavel_id);
create index if not exists idx_clientes_team_id on public.clientes (team_id);
create index if not exists idx_consultivo_categorias_office_id on public.consultivo_categorias (office_id);
create index if not exists idx_consultivos_cliente_id on public.consultivos (cliente_id);
create index if not exists idx_consultivos_office_id on public.consultivos (office_id);
create index if not exists idx_consultivos_responsavel_id on public.consultivos (responsavel_id);
create index if not exists idx_consultivos_user_id on public.consultivos (user_id);
create index if not exists idx_correspondentes_user_id on public.correspondentes (user_id);
create index if not exists idx_diligencias_audiencia_id on public.diligencias (audiencia_id);
create index if not exists idx_diligencias_user_id on public.diligencias (user_id);
create index if not exists idx_exclusoes_pendentes_aprovado_por on public.exclusoes_pendentes (aprovado_por);
create index if not exists idx_exclusoes_pendentes_office_id on public.exclusoes_pendentes (office_id);
create index if not exists idx_exclusoes_pendentes_user_id on public.exclusoes_pendentes (user_id);
create index if not exists idx_financeiro_cliente_id on public.financeiro (cliente_id);
create index if not exists idx_financeiro_processo_id on public.financeiro (processo_id);
create index if not exists idx_invitations_invited_by on public.invitations (invited_by);
create index if not exists idx_invitations_office_id on public.invitations (office_id);
create index if not exists idx_metas_office_id on public.metas (office_id);
create index if not exists idx_metas_team_id on public.metas (team_id);
create index if not exists idx_metas_user_id on public.metas (user_id);
create index if not exists idx_monitoramento_termos_office_id on public.monitoramento_termos (office_id);
create index if not exists idx_notifications_office_id on public.notifications (office_id);
create index if not exists idx_notifications_user_id on public.notifications (user_id);
create index if not exists idx_office_access_changes_changed_by on public.office_access_changes (changed_by);
create index if not exists idx_office_access_changes_office_id on public.office_access_changes (office_id);
create index if not exists idx_office_team_members_office_id on public.office_team_members (office_id);
create index if not exists idx_office_team_members_user_id on public.office_team_members (user_id);
create index if not exists idx_office_teams_office_id on public.office_teams (office_id);
create index if not exists idx_office_users_invited_by on public.office_users (invited_by);
create index if not exists idx_offices_access_granted_by on public.offices (access_granted_by);
create index if not exists idx_offices_created_by on public.offices (created_by);
create index if not exists idx_prazos_responsavel_id on public.prazos (responsavel_id);
create index if not exists idx_process_shares_shared_by on public.process_shares (shared_by);
create index if not exists idx_processos_cliente_id on public.processos (cliente_id);
create index if not exists idx_processos_responsavel_id on public.processos (responsavel_id);
create index if not exists idx_processos_team_id on public.processos (team_id);
create index if not exists idx_publicacoes_cliente_id on public.publicacoes (cliente_id);
create index if not exists idx_publicacoes_processo_id on public.publicacoes (processo_id);
create index if not exists idx_publicacoes_user_id on public.publicacoes (user_id);
create index if not exists idx_tarefas_atendimento_id on public.tarefas (atendimento_id);
create index if not exists idx_tarefas_cliente_id on public.tarefas (cliente_id);
create index if not exists idx_tarefas_processo_id on public.tarefas (processo_id);
create index if not exists idx_tarefas_responsavel_id on public.tarefas (responsavel_id);
create index if not exists idx_timesheets_cliente_id on public.timesheets (cliente_id);
create index if not exists idx_timesheets_office_id on public.timesheets (office_id);
create index if not exists idx_timesheets_processo_id on public.timesheets (processo_id);
create index if not exists idx_timesheets_user_id on public.timesheets (user_id);
create index if not exists idx_tipos_ato_prazo_office_id on public.tipos_ato_prazo (office_id);
create index if not exists idx_user_permissions_user_id on public.user_permissions (user_id);
create index if not exists idx_zap_synced_leads_cliente_id on public.zap_synced_leads (cliente_id);

commit;
