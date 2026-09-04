-- ============================================================================
-- Item 4 do plano de ação (docs/ANALISE_PLATAFORMA_SET2026.md): crons pelo vault
-- ============================================================================
-- Problema: as migrations de cron (robo_oab, robo_crm, robo_publicacoes,
-- robo_prazos, asaas_reconcile) eram TEMPLATES com <SERVICE_ROLE_KEY> e
-- <ROBOT_SECRET> literais no texto — só funcionavam depois de alguém substituir
-- os placeholders à mão e rodar no SQL Editor. Duas outras (google_sync,
-- zap_pull_leads) nem tinham segredo: clonavam o `command` de uma cron
-- ('trial-reminder-diario') que precisa já existir — e essa, por sua vez,
-- nunca teve CREATE nesta pasta, só existia ao vivo em produção. Resultado:
-- um rebuild das migrations do zero (disaster recovery) recriava os 8 robôs
-- QUEBRADOS EM SILÊNCIO (chamando URL/token literal ou falhando por falta de
-- job-fonte) — nenhum erro na hora do `db push`, só o robô nunca rodando.
--
-- Correção: os dois segredos reais (SUPABASE_SERVICE_ROLE_KEY e ROBOT_SECRET)
-- foram migrados para o `supabase_vault` (extensão já habilitada neste
-- projeto) UMA VEZ, fora de qualquer migration:
--   select vault.create_secret('<valor-real>', 'service_role_key', '...');
--   select vault.create_secret('<valor-real>', 'robot_secret', '...');
-- (`vault.decrypted_secrets` só é legível por `postgres`/`service_role` — os
-- mesmos que já podiam ler `cron.job.command` antes; não abre superfície nova.)
--
-- Esta migration passa a ser a ÚNICA fonte de verdade dos 8 `cron.schedule`,
-- todos lendo o segredo em tempo de execução via subquery no vault em vez de
-- tê-lo no texto. Populando os dois secrets do vault (passo único, análogo ao
-- já existente `supabase secrets set` das edge functions), o `db push` num
-- projeto novo recria os 8 robôs funcionando — nenhum precisa mais de outro
-- já existir, e nenhum segredo real fica no repositório.
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
    url := 'https://mzhnlhfxfoigkqgxseeu.supabase.co/functions/v1/robo-oab-diario',
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
    url := 'https://mzhnlhfxfoigkqgxseeu.supabase.co/functions/v1/robo-crm-diario',
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
    url := 'https://mzhnlhfxfoigkqgxseeu.supabase.co/functions/v1/robo-publicacoes-diario',
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
    url := 'https://mzhnlhfxfoigkqgxseeu.supabase.co/functions/v1/robo-prazos-diario',
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
    url := 'https://mzhnlhfxfoigkqgxseeu.supabase.co/functions/v1/asaas-reconcile',
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
    url := 'https://mzhnlhfxfoigkqgxseeu.supabase.co/functions/v1/trial-reminder',
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
    url := 'https://mzhnlhfxfoigkqgxseeu.supabase.co/functions/v1/google-sync',
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
    url := 'https://mzhnlhfxfoigkqgxseeu.supabase.co/functions/v1/zap-bridge',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-robot-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'robot_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
