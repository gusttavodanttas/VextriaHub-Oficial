-- Enforcement server-side do acesso por pagamento (escolha do dono: BLOQUEAR
-- leitura + escrita para escritório inadimplente). Adiciona uma policy
-- RESTRICTIVE (AND com as policies existentes de visibilidade) exigindo
-- office_has_access(office_id) nas tabelas de dados do inquilino.
-- service_role (robôs/edge functions) IGNORA RLS → continua funcionando.
-- super_admin passa sempre (OR is_super_admin()). Aplicar via SQL Editor.
--
-- ⚠️ Bloqueio total: um escritório 'atrasada'/'cancelada' perde acesso de LEITURA
-- aos próprios dados até regularizar. Salvaguarda: 'pendente' tem acesso até o
-- vencimento (gerar cobrança não tranca na hora). Se ficar agressivo demais,
-- troque para bloquear só ESCRITA: remova a linha `using (...)` de cada policy
-- (deixe só o `with check (...)`).

-- 1) office_has_access: pendente com vencimento no futuro ainda tem acesso.
create or replace function public.office_has_access(p_office uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((
    select s.is_lifetime
        or s.status in ('ativa','cortesia')
        or (s.status = 'trial'    and (s.trial_ends_at is null or s.trial_ends_at >= current_date))
        or (s.status = 'pendente' and (s.next_due_date  is null or s.next_due_date  >= current_date))
    from public.office_subscriptions s
    where s.office_id = p_office
  ), false);
$$;

-- 2) policy restritiva de pagamento nas tabelas de dados (só nas que têm office_id)
do $$
declare t text;
begin
  foreach t in array array[
    'processos','clientes','tarefas','prazos','audiencias','atendimentos',
    'consultivos','financeiro','metas','timesheets','publicacoes',
    'monitoramento_termos','tarefa_comentarios','tarefa_subtarefas'
  ] loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = t and column_name = 'office_id'
    ) then
      execute format('alter table public.%I enable row level security', t);
      execute format('drop policy if exists office_paid_gate on public.%I', t);
      execute format(
        'create policy office_paid_gate on public.%I as restrictive for all to authenticated '
        || 'using (public.office_has_access(office_id) or public.is_super_admin()) '
        || 'with check (public.office_has_access(office_id) or public.is_super_admin())',
        t
      );
    end if;
  end loop;
end $$;

-- 3) limpeza: tabela do Stripe órfã (nada mais lê após a migração p/ Asaas)
drop table if exists public.stripe_checkouts cascade;
