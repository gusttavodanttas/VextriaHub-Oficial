-- v10/M1: o acesso "pendente" acabava no fim do TRIAL, não no 1º VENCIMENTO. Quem assina perto do
-- fim do trial e paga por boleto (que vence depois) ficava bloqueado no meio — cliente que fez tudo
-- certo perde acesso. Adiciona carência: uma assinatura 'pendente' com a 1ª fatura ainda não vencida
-- (next_due_date >= hoje) mantém o acesso. Quando a fatura vence sem pagamento, o webhook põe
-- 'atrasada' e o acesso cai (a carência só vale para 'pendente', não 'atrasada').
-- Testado ao vivo: Oscar (pendente, trial 29/ago, vencimento 25/set) mantém acesso até 25/set;
-- Guilherme (atrasada) segue bloqueado; cortesia/trial inalterados.
create or replace function public.office_has_access(p_office uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce((
    select s.is_lifetime or s.status in ('ativa','cortesia')
        or (s.trial_ends_at is not null and s.trial_ends_at >= current_date and s.status in ('trial','pendente'))
        or (s.status = 'pendente' and s.next_due_date is not null and s.next_due_date >= current_date)
    from public.office_subscriptions s where s.office_id = p_office
  ), false);
$function$;
