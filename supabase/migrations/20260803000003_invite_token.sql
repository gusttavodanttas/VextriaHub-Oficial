-- Token de convite: fecha a brecha do auto-confirm. O link do convite passa a
-- carregar um token único; o auto-confirm (confirm_invited_user) só dispara se o
-- token bater com o convite pendente. Sem token (ou errado) → cai na confirmação
-- por e-mail normal (prova de posse do e-mail).
-- Substitui a versão de 1 argumento de 20260803000002. Aplicar via SQL Editor
-- (roda sozinha: cria a coluna, faz backfill e recria a função na forma final).

-- 1) coluna token (idempotente) + backfill dos convites existentes
alter table public.invitations add column if not exists token text;
update public.invitations set token = gen_random_uuid()::text where token is null;
alter table public.invitations alter column token set default gen_random_uuid()::text;
alter table public.invitations alter column token set not null;

-- 2) confirm_invited_user agora exige o token (remove a versão antiga de 1 arg)
drop function if exists public.confirm_invited_user(text);

create or replace function public.confirm_invited_user(p_email text, p_token text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_token is null or length(btrim(p_token)) = 0 then
    return false;  -- sem token → não auto-confirma (fallback: confirmação por e-mail)
  end if;

  if not exists (
    select 1 from public.invitations
    where lower(email) = lower(p_email)
      and token = p_token
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
