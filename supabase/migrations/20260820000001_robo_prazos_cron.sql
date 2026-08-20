-- ============================================================================
-- AGENDAMENTO DO ROBÔ DE AVISO DE PRAZO (cron) — envia o digest de prazos por e-mail
-- ============================================================================
-- Este cron FALTAVA no repositório: o robo-prazos-diario existia SÓ no banco vivo
-- (11:00 UTC), então um rebuild a partir das migrations NÃO recriava o disparo e os
-- avisos de prazo fatal sumiriam em silêncio (a mesma classe do incidente de jul/2026).
-- Versionado aqui para nunca mais depender só do estado vivo.
--
-- Roda 11:00 UTC (~08:00 BRT), 4h APÓS o robo-publicacoes (07:00 UTC) — garante que o
-- prazo criado a partir da publicação já está na tabela `prazos` quando o e-mail sai.
--
-- ⚠️ TEMPLATE — este SQL espelha o cron que JÁ está vivo em prod; rodá-lo é idempotente
-- (unschedule + reschedule com os mesmos valores). Substitua <PROJECT_REF>,
-- <SERVICE_ROLE_KEY> e <ROBOT_SECRET> pelos valores reais e rode no SQL Editor.
-- NÃO commitar os valores reais. Deploy da função antes (se necessário):
--   npx supabase functions deploy robo-prazos-diario --no-verify-jwt --project-ref mzhnlhfxfoigkqgxseeu
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remove agendamento anterior se existir (idempotente)
select cron.unschedule('robo-prazos-diario')
where exists (select 1 from cron.job where jobname = 'robo-prazos-diario');

-- Diária às 11:00 UTC (~08:00 Brasília), DEPOIS do robo-publicacoes (07:00 UTC)
select cron.schedule(
  'robo-prazos-diario',
  '0 11 * * *',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/robo-prazos-diario',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>',
      'apikey', '<SERVICE_ROLE_KEY>',
      'x-robot-secret', '<ROBOT_SECRET>'
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);

-- Conferir / remover:
--   select jobname, schedule from cron.job where jobname = 'robo-prazos-diario';
--   select cron.unschedule('robo-prazos-diario');
