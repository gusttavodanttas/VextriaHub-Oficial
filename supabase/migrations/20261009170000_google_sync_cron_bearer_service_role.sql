-- google-sync-15min: manda o service_role legado (vault) no Authorization/apikey,
-- como os outros robôs já fazem. A function usa essa chave no caminho do robô em
-- vez da `sb_secret_…` injetada pela plataforma, que o PostgREST rejeita de vez em
-- quando com PGRST303 (JWT expirado): 16 de 95 chamadas em 24 h de 09/10/2026,
-- todas invisíveis ao alerta porque a function respondia 200. Ver
-- supabase/functions/_shared/robo.ts.
select cron.schedule(
  'google-sync-15min',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/google-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
      'x-robot-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'robot_secret')),
    body := '{}'::jsonb, timeout_milliseconds := 60000);
  $$
);
