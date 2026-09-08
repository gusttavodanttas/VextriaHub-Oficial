-- Achado da parte 1 do relatorio (secao "Banco"), nunca corrigido: confirm_invited_user
-- e SECURITY DEFINER chamavel por anon de proposito (roda ANTES do login, no fluxo de
-- cadastro por convite) e nunca teve limite de tentativas. O token e um uuid v4
-- (~122 bits de entropia), entao forca bruta pura ja e inviavel na pratica -- mas nada
-- impedia um script martelando a funcao (custo de CPU/IO em auth.users a cada chamada,
-- e falta de defesa em profundidade caso o token algum dia fique mais fraco/curto).
--
-- Rate-limit pela chave que um atacante controla -- o e-mail, nao o chamador, que e
-- sempre anon nesse fluxo. Mesmo padrao ja usado em authorize_process_search: tabela de
-- log so gravada/lida pela propria RPC SECURITY DEFINER, RLS ligada sem nenhuma policy
-- (nega acesso direto por PostgREST). Zero mudanca de comportamento pra um convite
-- legitimo: o fluxo normal chama a funcao 1 vez.

create table if not exists public.confirm_invited_user_attempts (
  id bigint generated always as identity primary key,
  email text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_confirm_invited_user_attempts_email_time
  on public.confirm_invited_user_attempts (lower(email), created_at desc);

-- Tabela interna (só a RPC SECURITY DEFINER escreve/lê). RLS ligada sem policy = nega
-- todo acesso direto via PostgREST, inclusive pro service_role via API (não é usada
-- fora desta função).
alter table public.confirm_invited_user_attempts enable row level security;

create or replace function public.confirm_invited_user(p_email text, p_token text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempts int;
begin
  if p_token is null or length(btrim(p_token)) = 0 then
    return false;  -- sem token → não auto-confirma (fallback: confirmação por e-mail)
  end if;

  insert into public.confirm_invited_user_attempts(email) values (lower(p_email));

  -- Limpeza probabilística (1% das chamadas) — sem precisar de um cron novo só pra isto.
  if random() < 0.01 then
    delete from public.confirm_invited_user_attempts where created_at < now() - interval '1 day';
  end if;

  select count(*) into v_attempts from public.confirm_invited_user_attempts
   where lower(email) = lower(p_email) and created_at > now() - interval '15 minutes';

  if v_attempts > 20 then
    return false;  -- rate limited — mesma resposta de token inválido, não vaza o motivo
  end if;

  if not exists (
    select 1 from public.invitations
    where lower(email) = lower(p_email)
      and token::text = p_token          -- token é uuid; compara como texto (sem risco de cast)
      and status = 'pending'
      and (expires_at is null or expires_at > now())
  ) then
    return false;
  end if;

  update auth.users
     set email_confirmed_at = coalesce(email_confirmed_at, now())
   where lower(email) = lower(p_email);

  return true;
end;
$$;

revoke all on function public.confirm_invited_user(text, text) from public;
grant execute on function public.confirm_invited_user(text, text) to anon, authenticated;
