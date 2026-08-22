-- Cron da ponte Zap→Hub: a cada 15 min puxa leads qualificados das contas Zap
-- vinculadas e insere no CRM do Hub. Clona o comando de uma cron que já usa
-- x-robot-secret (trocando só o nome da função) p/ não hardcodar o segredo.
-- Pré-requisito no rebuild: a cron 'trial-reminder-diario' já existir.
select cron.schedule(
  'zap-pull-leads',
  '*/15 * * * *',
  replace(
    (select command from cron.job where jobname = 'trial-reminder-diario' limit 1),
    'trial-reminder', 'zap-bridge'
  )
);
