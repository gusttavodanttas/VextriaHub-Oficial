-- Corrige o AUTO-BLOQUEIO ao gerar cobrança (regressão do P0#3 da re-auditoria v2).
-- Um escritório com TRIAL VÁLIDO mantém acesso mesmo depois de a cobrança ser
-- criada (status vira 'pendente'), até o trial de fato acabar — assim gerar o
-- boleto não tranca a firma no meio do teste.
-- NÃO reabre o bypass de re-setup: o acesso do 'pendente' depende de trial_ends_at
-- (que o setup NÃO estende; só o super_admin, no trial, define), não de next_due_date.
-- Rodar no SQL Editor.
create or replace function public.office_has_access(p_office uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select s.is_lifetime
        or s.status in ('ativa','cortesia')
        or (s.trial_ends_at is not null
            and s.trial_ends_at >= current_date
            and s.status in ('trial','pendente'))
    from public.office_subscriptions s
    where s.office_id = p_office
  ), false);
$$;
