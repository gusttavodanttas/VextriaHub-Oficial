-- ============================================================================
-- Nova análise (2026-09-04, parte 2): novo achado — 82 warnings
-- `multiple_permissive_policies` no advisor de performance. Cada policy
-- PERMISSIVE extra numa mesma tabela/ação é avaliada em toda linha/consulta e
-- OR'ada com as demais — várias tabelas acumularam policies redundantes ao
-- longo de migrations sucessivas.
--
-- Só as PROVADAMENTE redundantes entram aqui — cada uma comparada por lógica
-- booleana, não por inspeção visual (ver docs/ANALISE_PLATAFORMA_SET2026.md
-- para o raciocínio completo de cada uma). Casos com condições genuinamente
-- diferentes (exclusoes_pendentes, offices, monitored_oabs, user_permissions)
-- ficaram de fora de propósito — consolidar ali exigiria reescrever a
-- condição (juntar os OR num único texto), não só remover uma policy solta.
-- ============================================================================

-- tarefa_comentarios / tarefa_subtarefas: "service role acesso total ..." checa
-- auth.role() = 'service_role', mas esse role tem BYPASSRLS=true no Postgres —
-- a RLS nem roda pra ele. Pra qualquer outro role a condição nunca é
-- verdadeira. Morta desde que foi criada, nas duas tabelas.
drop policy if exists "service role acesso total comentarios" on public.tarefa_comentarios;
drop policy if exists "service role acesso total subtarefas" on public.tarefa_subtarefas;

-- plan_configs: plans_manage_admin (ALL, using/check is_super_admin()) é
-- duplicata exata de plan_configs_write (ALL, mesma condição nos dois lados).
-- E plan_configs_read (SELECT using(true)) anulava na prática o filtro de
-- plans_select_public (is_active=true) — qualquer um lia planos
-- descontinuados/internos via anon key; super_admin continua vendo tudo pela
-- policy ALL (que cobre SELECT também).
drop policy if exists "plans_manage_admin" on public.plan_configs;
drop policy if exists "plan_configs_read" on public.plan_configs;

-- monitoramento_termos: mon_insert/mon_select/mon_update checam só
-- "office_id = ANY(get_user_office_ids())", que já é o primeiro termo do OR de
-- monitoramento_office_scope (mesma condição OR is_super_admin()) — subconjunto
-- estrito, nunca adicionam acesso que a outra não desse.
drop policy if exists "mon_insert" on public.monitoramento_termos;
drop policy if exists "mon_select" on public.monitoramento_termos;
drop policy if exists "mon_update" on public.monitoramento_termos;

-- notifications: notifications_insert_self (uid=user_id) é subconjunto
-- estrito de notif_insert (service_role OR uid=user_id).
drop policy if exists "notifications_insert_self" on public.notifications;

-- profiles: profiles_select_admin (is_super_admin()) duplica exatamente a
-- cobertura de SELECT que "SuperAdmin total access profiles" (ALL, mesma
-- condição) já dá.
drop policy if exists "profiles_select_admin" on public.profiles;
