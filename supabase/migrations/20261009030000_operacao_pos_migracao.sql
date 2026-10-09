-- ============================================================================
-- Operação pós-migração: pausa do robô do Zap, retenção do log do pg_cron e
-- alerta in-app quando uma chamada automática (robô) responde com erro
-- ============================================================================
-- Parte 26 da análise, passo 6 do plano. Idempotente.

-- 1) zap-pull-leads: PAUSADO (não apagado). O bridge do VextriaZap apontava
--    para um projeto que não existe mais (DNS falha) — 96 chamadas/dia para
--    nada. Reativar quando o bridge voltar:
--      select cron.alter_job(jobid, active := true) from cron.job where jobname = 'zap-pull-leads';
select cron.alter_job(jobid, active := false) from cron.job where jobname = 'zap-pull-leads';

-- 2) Retenção de 30 dias em cron.job_run_details (o pg_cron não limpa sozinho;
--    são ~100 linhas/dia com os jobs de 15 min).
select cron.unschedule('limpar-cron-log') where exists (select 1 from cron.job where jobname = 'limpar-cron-log');
select cron.schedule(
  'limpar-cron-log',
  '0 3 * * *',
  $$ delete from cron.job_run_details where end_time < now() - interval '30 days' $$
);

-- 3) Alerta de robô com erro. As chamadas dos crons saem por pg_net; a resposta
--    fica em net._http_response por 6 h (pg_net.ttl). A cada hora, toda resposta
--    nova com status >= 400, sem status, timeout ou erro de transporte vira UMA
--    notificação in-app (tabela notifications, type 'error') para cada super
--    admin do sistema, registrada em robo_alertas_log para não repetir.
create table if not exists public.robo_alertas_log (
  response_id bigint primary key,
  status_code integer,
  resumo text,
  created_at timestamptz not null default now()
);
comment on table public.robo_alertas_log is
  'Respostas de pg_net já convertidas em alerta (evita notificar duas vezes). Só o service role/cron escreve; RLS sem policy de propósito.';
alter table public.robo_alertas_log enable row level security;
revoke all on public.robo_alertas_log from anon, authenticated;

select cron.unschedule('robo-alertas-horario') where exists (select 1 from cron.job where jobname = 'robo-alertas-horario');
select cron.schedule(
  'robo-alertas-horario',
  '5 * * * *',
  $$
  with falhas as (
    select r.id, r.status_code,
           left(coalesce(nullif(r.error_msg, ''), nullif(r.content, ''), case when r.timed_out then 'timeout' else 'sem conteúdo' end), 200) as resumo
    from net._http_response r
    where r.created > now() - interval '70 minutes'
      and (r.status_code is null or r.status_code >= 400 or r.timed_out or r.error_msg is not null)
      and not exists (select 1 from public.robo_alertas_log l where l.response_id = r.id)
  ), registradas as (
    insert into public.robo_alertas_log (response_id, status_code, resumo)
    select id, status_code, resumo from falhas
    on conflict (response_id) do nothing
    returning response_id, status_code, resumo
  )
  insert into public.notifications (user_id, office_id, title, message, type, data)
  select p.user_id, null,
         'Robô com erro',
         'Uma chamada automática respondeu ' || coalesce(reg.status_code::text, 'sem resposta') || ': ' || reg.resumo,
         'error',
         jsonb_build_object('action_url', '/admin?tab=dashboard', 'action_label', 'Ver administração', 'response_id', reg.response_id)
  from registradas reg
  cross join (select user_id from public.profiles where role = 'super_admin') p;
  $$
);
