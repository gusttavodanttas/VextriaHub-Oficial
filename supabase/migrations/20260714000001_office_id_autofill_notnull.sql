-- Blindagem multi-tenant: garante que office_id nunca fique órfão.
--
-- Contexto: 9 tabelas de dados tinham office_id NULLABLE e o preenchimento
-- era feito no front (71 arquivos). Bastava uma tela esquecer para criar um
-- registro órfão — invisível para o dono do escritório, sem erro (falha
-- silenciosa). Auditoria de 2026-07-14 confirmou 0 órfãos vivos (o front vinha
-- acertando), mas o mecanismo era frágil. Isto resolve no banco, de vez.
--
-- IMPORTANTE: este projeto NÃO usa tracking de migration (supabase_migrations
-- não existe). Este arquivo é DOCUMENTAÇÃO — o que vale é rodar no SQL Editor.

-- ── PARTE 1: auto-preenchimento (rede de segurança) ─────────────────────────
-- Em todo INSERT, se office_id vier nulo, preenche com o escritório do usuário
-- autenticado. Roda ANTES do WITH CHECK do RLS (que valida o valor final).
create or replace function public.set_office_id_from_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.office_id is null then
    new.office_id := (select office_id from public.profiles where user_id = auth.uid());
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
  tabelas text[] := array[
    'processos','clientes','tarefas','audiencias','atendimentos',
    'consultivos','financeiro','metas','timesheets'
  ];
begin
  foreach t in array tabelas loop
    execute format('drop trigger if exists trg_office_id on public.%I', t);
    execute format(
      'create trigger trg_office_id before insert on public.%I '
      'for each row execute function public.set_office_id_from_user()', t);
  end loop;
end $$;

-- ── PARTE 2: NOT NULL (fail-loud) — aplicar após testar o app com a Parte 1 ──
-- Com 0 órfãos, entra sem backfill. Insert sem escritório passa a FALHAR alto
-- em vez de virar órfão silencioso. Reversível: alter ... drop not null.
do $$
declare
  t text;
  tabelas text[] := array[
    'processos','clientes','tarefas','audiencias','atendimentos',
    'consultivos','financeiro','metas','timesheets'
  ];
begin
  foreach t in array tabelas loop
    execute format('alter table public.%I alter column office_id set not null', t);
  end loop;
end $$;
