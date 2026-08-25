-- CRÍTICO (v11): a carência que a v10 adicionou usava next_due_date, que o admin do escritório
-- CONTROLA via asaas-billing (first_due_date do body, sem clamp) e RESETA re-chamando o setup →
-- acesso grátis eterno (bypass de paywall nas ~20 tabelas com office_paid_gate). Correção: ancorar
-- a carência no trial_ends_at, que o usuário NÃO controla (setado por apply_signup_plan com guard
-- plan_claimed; o setup preserva, não altera) e o re-setup NÃO reseta. next_due_date deixa de
-- influenciar acesso → truque do 2099 e re-setup não funcionam mais. Carência = 7 dias após o fim
-- do trial (cobre o pagamento do 1º boleto de quem assina perto do fim do teste). Plano sem trial
-- (BASIC, trial_ends null) = sem carência = paga pra acessar. atrasada/cancelada seguem bloqueados.
-- Testado ao vivo: Oscar mantém acesso; atrasada/trial-expirado/exploiter = false.
create or replace function public.office_has_access(p_office uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce((
    select s.is_lifetime or s.status in ('ativa','cortesia')
        or (s.trial_ends_at is not null and s.trial_ends_at >= current_date and s.status in ('trial','pendente'))
        or (s.status = 'pendente' and s.trial_ends_at is not null and current_date <= s.trial_ends_at + interval '7 days')
    from public.office_subscriptions s where s.office_id = p_office
  ), false);
$function$;
