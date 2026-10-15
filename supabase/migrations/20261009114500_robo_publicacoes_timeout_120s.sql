-- ============================================================================
-- robo-publicacoes-diario: timeout do cron de 60 s para 120 s
-- ============================================================================
-- Na rodada de 09/10 às 07:00 UTC a chamada passou dos 60 s e o pg_net
-- registrou "Timeout of 60000 ms reached" (status nulo). A function termina
-- por conta própria mesmo assim, mas o cron fica com uma resposta de erro e
-- o robo-alertas-horario avisa os super admins de uma falha que não houve.
-- A varredura de publicações consulta o PJe Comunica por OAB e cresce com o
-- número de OABs monitoradas; 120 s dá folga sem mascarar travamento real.
--
-- Mesmo comando, só o timeout_milliseconds muda. cron.schedule com o mesmo
-- nome substitui o job (pg_cron >= 1.4). Idempotente.
-- ============================================================================

do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('robo-publicacoes-diario', '0 7 * * *', $cron$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/robo-publicacoes-diario',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
          'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
          'x-robot-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'robot_secret')
        ),
        body := '{}'::jsonb, timeout_milliseconds := 120000);
    $cron$);
  end if;
end $$;
