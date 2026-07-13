-- Idempotência do robo-prazos-diario: 1 e-mail-resumo por advogado por dia.
-- A PK (user_id, ref_date) faz o insert falhar se já enviamos hoje → o robô pula.
create table if not exists public.email_digest_log (
  user_id  uuid not null,
  ref_date date not null,
  sent_at  timestamptz not null default now(),
  primary key (user_id, ref_date)
);

alter table public.email_digest_log enable row level security;

-- Só o robô (service_role) escreve/lê; nenhum usuário do app precisa acessar.
drop policy if exists "service role only email_digest_log" on public.email_digest_log;
create policy "service role only email_digest_log"
  on public.email_digest_log for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
