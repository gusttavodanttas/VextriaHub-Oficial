-- Completa o portao de pagamento (office_paid_gate) nas tabelas de DADOS do escritorio que
-- faltavam - mesma policy RESTRICTIVE dos outros 14. So passa se o escritorio tem acesso
-- (ou super admin). NAO inclui tabelas de infra (office_subscriptions, profiles, office_users,
-- invitations, notifications, billing_events, office_teams, user_permissions, etc.), que precisam
-- ser lidas mesmo por escritorio inadimplente (senao ele nem carrega a tela de pagamento).
do $gate$
declare t text;
begin
  foreach t in array array[
    'processos_encontrados','movimentacoes_processo','processos_descartados',
    'audiencia_tipos','consultivo_categorias','tipos_ato_prazo'
  ] loop
    execute format('drop policy if exists office_paid_gate on public.%I', t);
    execute format('create policy office_paid_gate on public.%I as restrictive for all to authenticated using (office_has_access(office_id) or is_super_admin())', t);
  end loop;
end $gate$;
