-- Cron de rede de segurança da integração Google Agenda: a cada 15 min sincroniza
-- os calendários conectados (empurra prazos/audiências novos/alterados/removidos).
--
-- Versão original clonava o `command` da cron 'trial-reminder-diario' via
-- `replace()` para não hardcodar o segredo — mas essa cron nunca teve CREATE
-- nesta pasta (só existia ao vivo), então num rebuild do zero o subselect
-- voltava NULL e o `cron.schedule` explodia (command é NOT NULL), travando
-- todo o replay das migrations seguintes. Placeholder inerte (mesmo padrão
-- dos outros robôs) no lugar: correção definitiva com vault na migration
-- 20260904160000_crons_vault_secrets.sql, que roda depois e reagenda todas.
select cron.schedule(
  'google-sync-15min',
  '*/15 * * * *',
  $$
  select net.http_post(
    url     := 'https://mzhnlhfxfoigkqgxseeu.supabase.co/functions/v1/google-sync',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-robot-secret', '<ROBOT_SECRET>'),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
