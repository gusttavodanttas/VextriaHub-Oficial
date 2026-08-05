-- Cron de reconciliação do Asaas (rede de segurança do webhook).
-- Roda o asaas-reconcile 1x/dia: reconsulta o Asaas e corrige o status de
-- office_subscriptions, garantindo que um webhook perdido não deixe cliente
-- trancado (bloqueio total) nem pagante bloqueado.
--
-- ⚠️ TEMPLATE — rodar no SQL Editor SUBSTITUINDO <ROBOT_SECRET> pelo valor real
-- (o mesmo dos outros robôs). Requer pg_cron + pg_net habilitados. Deploy antes:
--   npx supabase functions deploy asaas-reconcile --no-verify-jwt --project-ref mzhnlhfxfoigkqgxseeu

-- Remove agendamento anterior se existir (idempotente)
select cron.unschedule('asaas-reconcile-diario')
where exists (select 1 from cron.job where jobname = 'asaas-reconcile-diario');

select cron.schedule(
  'asaas-reconcile-diario',
  '20 6 * * *',   -- 06:20 UTC (~03:20 BRT) todo dia
  $$
  select net.http_post(
    url     := 'https://mzhnlhfxfoigkqgxseeu.supabase.co/functions/v1/asaas-reconcile',
    headers := jsonb_build_object('Content-Type','application/json','x-robot-secret','<ROBOT_SECRET>'),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
