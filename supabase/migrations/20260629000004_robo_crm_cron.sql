-- ============================================================================
-- AGENDAMENTO DO ROBÔ CRM DIÁRIO (cron)
-- ============================================================================
-- Pré-requisitos (uma vez):
--   1) Coluna de follow-up:
--        alter table public.clientes add column if not exists proximo_contato date;
--   2) Deploy da função: robo-crm-diario  (painel ou CLI)
--   3) Segredo já definido (mesmo do robô de processos): ROBOT_SECRET
--
-- Rode este SQL UMA VEZ, substituindo:
--   <SERVICE_ROLE_KEY> -> sua service_role key (Project Settings → API)
--   <ROBOT_SECRET>     -> o mesmo valor salvo em Edge Functions → Secrets
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('robo-crm-diario') where exists (
  select 1 from cron.job where jobname = 'robo-crm-diario'
);

-- Todo dia às 06:10 UTC (~03:10 de Brasília)
select cron.schedule(
  'robo-crm-diario',
  '10 6 * * *',
  $$
  select net.http_post(
    url     := 'https://mzhnlhfxfoigkqgxseeu.supabase.co/functions/v1/robo-crm-diario',
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
