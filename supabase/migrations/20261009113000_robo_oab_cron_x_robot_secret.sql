-- ============================================================================
-- robo-oab-diario: o cron passa a mandar x-robot-secret (como os outros robôs)
-- ============================================================================
-- Na primeira rodada diária do projeto novo (09/10, 06:00 UTC) o robo-oab-diario
-- respondeu 401 {"ok":false,"error":"unauthorized"}. O job manda só
-- "Authorization: Bearer <service_role_key do vault>" e a function autoriza
-- quando esse Bearer é IGUAL ao SUPABASE_SERVICE_ROLE_KEY do ambiente dela ou
-- quando x-robot-secret bate com ROBOT_SECRET. O Bearer passou pelo gateway
-- (JWT válido, verify_jwt) mas não bateu string a string com o env — os
-- outros quatro robôs diários (crm, publicações, asaas, prazos) mandam o
-- x-robot-secret e rodaram normalmente.
--
-- Mesma chamada, só acrescenta o header. cron.schedule com o mesmo nome
-- substitui o job (pg_cron >= 1.4). Idempotente.
-- ============================================================================

do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('robo-oab-diario', '0 6 * * *', $cron$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/robo-oab-diario',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
          'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
          'x-robot-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'robot_secret')),
        body := '{}'::jsonb,
        timeout_milliseconds := 60000);
    $cron$);
  end if;
end $$;
