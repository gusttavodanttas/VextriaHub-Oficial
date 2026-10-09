-- ============================================================================
-- TETO DE IA POR ESCRITÓRIO (item 7 do plano da análise, Parte 26)
-- ============================================================================
-- Hoje o teto de uso da IA é GLOBAL: os segredos AI_LIMITE_CHAMADAS_MES e
-- AI_LIMITE_VOZ_CARACTERES_MES das edge functions valem para todo escritório.
-- Esta migration cria `ai_limites`, uma linha opcional por escritório que
-- sobrescreve o global:
--
--   limite_chamadas / limite_voz_caracteres
--     NULL  → usa o padrão global (segredo da function)
--     0     → ilimitado
--     N > 0 → teto do mês para este escritório
--
-- Só o super admin escreve (painel Escritórios); membros do escritório leem
-- a própria linha (para a tela de uso). As functions leem via service role e
-- passam o valor resolvido para ai_consumir(), que continua sendo a única
-- porta de incremento do contador em ai_usage.
-- ============================================================================

begin;

create table if not exists public.ai_limites (
  office_id              uuid        primary key references public.offices(id) on delete cascade,
  limite_chamadas        integer     check (limite_chamadas is null or limite_chamadas >= 0),
  limite_voz_caracteres  bigint      check (limite_voz_caracteres is null or limite_voz_caracteres >= 0),
  observacao             text,
  atualizado_em          timestamptz not null default now(),
  atualizado_por         uuid
);

comment on table public.ai_limites is
  'Teto mensal de IA por escritório. NULL = padrão global das edge functions; 0 = ilimitado. Escrita só pelo super admin.';

alter table public.ai_limites enable row level security;

drop policy if exists ai_limites_select on public.ai_limites;
create policy ai_limites_select on public.ai_limites
  for select to authenticated
  using (public.user_belongs_to_office(office_id) or public.is_super_admin());

drop policy if exists ai_limites_insert_super on public.ai_limites;
create policy ai_limites_insert_super on public.ai_limites
  for insert to authenticated
  with check (public.is_super_admin());

drop policy if exists ai_limites_update_super on public.ai_limites;
create policy ai_limites_update_super on public.ai_limites
  for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists ai_limites_delete_super on public.ai_limites;
create policy ai_limites_delete_super on public.ai_limites
  for delete to authenticated
  using (public.is_super_admin());

revoke all on public.ai_limites from anon;

-- Carimba quem/quando alterou (o cliente não precisa mandar esses campos).
create or replace function public.ai_limites_carimbar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.atualizado_em := now();
  new.atualizado_por := auth.uid();
  return new;
end;
$$;
revoke execute on function public.ai_limites_carimbar() from public, anon, authenticated;

drop trigger if exists ai_limites_carimbar on public.ai_limites;
create trigger ai_limites_carimbar
  before insert or update on public.ai_limites
  for each row execute function public.ai_limites_carimbar();

commit;
