-- ============================================================================
-- AGENDAMENTO DO ROBÔ DE PUBLICAÇÕES (cron) — busca intimações com o app fechado
-- ============================================================================
-- Pré-requisitos (uma vez):
--   1) Deploy das funções:
--        supabase functions deploy fetch-by-oab
--        supabase functions deploy calculate-prazo
--        supabase functions deploy robo-publicacoes-diario
--   2) ROBOT_SECRET já definido (mesmo dos outros robôs).
--
-- Rode este SQL UMA VEZ, substituindo <PROJECT_REF>, <SERVICE_ROLE_KEY> e <ROBOT_SECRET>.
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('robo-publicacoes-diario') where exists (
  select 1 from cron.job where jobname = 'robo-publicacoes-diario'
);

-- Diária às 07:00 UTC (~04:00 Brasília), após o robô de processos
select cron.schedule(
  'robo-publicacoes-diario',
  '0 7 * * *',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/robo-publicacoes-diario',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>',
      'apikey', '<SERVICE_ROLE_KEY>',
      'x-robot-secret', '<ROBOT_SECRET>'
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- Conferir / remover:
--   select * from cron.job;
--   select cron.unschedule('robo-publicacoes-diario');
