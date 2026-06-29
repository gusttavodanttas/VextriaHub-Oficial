-- ============================================================================
-- AGENDAMENTO DO ROBÔ DIÁRIO (cron) — roda mesmo com o app fechado
-- ============================================================================
-- Pré-requisitos (uma vez):
--   1) Deploy das funções:
--        supabase functions deploy fetch-by-oab
--        supabase functions deploy robo-oab-diario
--   2) Definir o segredo do robô (mesmo valor usado pelas duas funções):
--        supabase secrets set ROBOT_SECRET=<um-valor-aleatorio-forte>
--      (SUPABASE_SERVICE_ROLE_KEY e SUPABASE_URL já existem por padrão)
--
-- Depois, rode este SQL UMA VEZ no Supabase, substituindo:
--   <PROJECT_REF>        -> ref do seu projeto (ex.: mzhnlhfxfoigkqgxseeu)
--   <SERVICE_ROLE_KEY>   -> sua service_role key (Project Settings → API)
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remove agendamento anterior (se existir) para evitar duplicidade
select cron.unschedule('robo-oab-diario') where exists (
  select 1 from cron.job where jobname = 'robo-oab-diario'
);

-- Agenda diária às 06:00 UTC (≈ 03:00 horário de Brasília)
select cron.schedule(
  'robo-oab-diario',
  '0 6 * * *',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/robo-oab-diario',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>',
      'apikey', '<SERVICE_ROLE_KEY>'
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- Para conferir / remover depois:
--   select * from cron.job;
--   select cron.unschedule('robo-oab-diario');
