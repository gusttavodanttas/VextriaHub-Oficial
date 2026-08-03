-- Auto-confirma o e-mail de um usuário CONVIDADO, pra ele entrar sem clicar no
-- e-mail de confirmação. Segurança: só confirma se existe convite PENDENTE e
-- não-expirado pro e-mail — cadastro normal (sem convite) segue exigindo
-- confirmação. Chamada pelo Register em modo convite (anon, logo após signUp).
-- Aplicar via SQL Editor.

create or replace function public.confirm_invited_user(p_email text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.invitations
    where lower(email) = lower(p_email)
      and status = 'pending'
      and (expires_at is null or expires_at > now())
  ) then
    return false;  -- sem convite pendente → não confirma (cadastro normal)
  end if;

  update auth.users
     set email_confirmed_at = coalesce(email_confirmed_at, now())
   where lower(email) = lower(p_email);

  return true;
end;
$$;

revoke all on function public.confirm_invited_user(text) from public;
grant execute on function public.confirm_invited_user(text) to anon, authenticated;
