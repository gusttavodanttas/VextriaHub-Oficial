-- ============================================================================
-- Crons dos robôs sem URL de projeto fixa (migração para o projeto novo)
-- ============================================================================
-- A 20260904160000_crons_vault_secrets.sql tirou os SEGREDOS do texto dos 8
-- crons, mas deixou a URL do projeto fixa ('https://mzhnlhfxfoigkqgxseeu...').
-- Numa migração de projeto, o `db push` recriava os robôs chamando as edge
-- functions do projeto ANTIGO — sem erro nenhum na hora, só o robô errado.
--
-- Esta migration recria os mesmos 8 jobs (mesmos nomes, horários, cabeçalhos
-- e segredos) lendo a URL base também do vault, no secret `project_url`
-- (ex.: 'https://<ref>.supabase.co', sem barra no final). Cadastro único por
-- projeto, no SQL Editor, junto dos outros dois:
--   select vault.create_secret('https://<ref>.supabase.co', 'project_url', 'URL base do projeto (crons)');
--   select vault.create_secret('<service_role_key>', 'service_role_key', 'crons');
--   select vault.create_secret('<robot_secret>',     'robot_secret',     'crons');
-- Os secrets do vault são criptografados com a chave do projeto: NÃO viajam
-- num dump de dados — precisam ser recriados em cada projeto.
-- Idempotente (unschedule-se-existe + schedule), como a anterior.
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

-- ── robo-oab-diario (06:00 UTC) ──
select cron.unschedule('robo-oab-diario') where exists (select 1 from cron.job where jobname = 'robo-oab-diario');
select cron.schedule(
  'robo-oab-diario',
  '0 6 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/robo-oab-diario',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);

-- ── robo-crm-diario (06:10 UTC) ──
select cron.unschedule('robo-crm-diario') where exists (select 1 from cron.job where jobname = 'robo-crm-diario');
select cron.schedule(
  'robo-crm-diario',
  '10 6 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/robo-crm-diario',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
      'x-robot-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'robot_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);

-- ── robo-publicacoes-diario (07:00 UTC) ──
select cron.unschedule('robo-publicacoes-diario') where exists (select 1 from cron.job where jobname = 'robo-publicacoes-diario');
select cron.schedule(
  'robo-publicacoes-diario',
  '0 7 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/robo-publicacoes-diario',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
      'x-robot-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'robot_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);

-- ── robo-prazos-diario (11:00 UTC) ──
select cron.unschedule('robo-prazos-diario') where exists (select 1 from cron.job where jobname = 'robo-prazos-diario');
select cron.schedule(
  'robo-prazos-diario',
  '0 11 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/robo-prazos-diario',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
      'x-robot-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'robot_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);

-- ── asaas-reconcile-diario (06:20 UTC) ──
select cron.unschedule('asaas-reconcile-diario') where exists (select 1 from cron.job where jobname = 'asaas-reconcile-diario');
select cron.schedule(
  'asaas-reconcile-diario',
  '20 6 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/asaas-reconcile',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-robot-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'robot_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);

-- ── trial-reminder-diario (12:00 UTC) ──
-- Nunca teve CREATE nesta pasta (só existia ao vivo). Versionada aqui pela
-- primeira vez — as duas próximas (google-sync, zap-pull-leads) dependiam
-- dela existir e por isso deixam de clonar o `command` alheio.
select cron.unschedule('trial-reminder-diario') where exists (select 1 from cron.job where jobname = 'trial-reminder-diario');
select cron.schedule(
  'trial-reminder-diario',
  '0 12 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/trial-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-robot-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'robot_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);

-- ── google-sync-15min (a cada 15 min) ──
select cron.unschedule('google-sync-15min') where exists (select 1 from cron.job where jobname = 'google-sync-15min');
select cron.schedule(
  'google-sync-15min',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/google-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-robot-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'robot_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);

-- ── zap-pull-leads (a cada 15 min) ──
select cron.unschedule('zap-pull-leads') where exists (select 1 from cron.job where jobname = 'zap-pull-leads');
select cron.schedule(
  'zap-pull-leads',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/zap-bridge',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-robot-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'robot_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
