-- Cron de rede de segurança da integração Google Agenda: a cada 15 min sincroniza
-- os calendários conectados (empurra prazos/audiências novos/alterados/removidos).
-- Clona o comando de uma cron que já usa x-robot-secret + service_role, trocando só
-- o nome da função — assim o segredo NÃO fica hardcoded no repo (padrão do projeto).
-- Pré-requisito no rebuild: a cron 'trial-reminder-diario' já existir.
select cron.schedule(
  'google-sync-15min',
  '*/15 * * * *',
  replace(
    (select command from cron.job where jobname = 'trial-reminder-diario' limit 1),
    'trial-reminder', 'google-sync'
  )
);
