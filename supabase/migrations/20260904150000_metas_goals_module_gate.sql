-- ============================================================================
-- GATE DO MÓDULO DE METAS NO BANCO (correção P2 da análise de set/2026 —
-- "os módulos por plano só existem no navegador")
-- ============================================================================
-- usePlanFeatures.tsx só libera hasGoalsModule no plano Premium (e
-- cortesia/vitalício, que caem em PLAN_FEATURES.premium) — trial, básico,
-- intermediário e avançado têm hasGoalsModule: false, e usePermissions
-- (canViewMetas = permissions.canViewMetas && plan.hasGoalsModule) esconde a
-- tela pra esses planos. Mas a RLS de `metas` nunca checou plano — só
-- is_office_admin(office_id) ou team_visible_user_ids(office_id) — então um
-- escritório no Básico lê e grava /rest/v1/metas direto, sem passar pela tela.
--
-- Nota: hasFinancialModule NÃO é diferenciador de plano hoje — é `true` nos 5
-- tiers em usePlanFeatures.tsx (apesar de "Módulo financeiro completo"
-- aparecer como diferencial do Avançado no catálogo). Não há restrição real
-- pra impor em `financeiro`; a inconsistência é de texto de marketing
-- (plan_configs.features / Landing.tsx), não de acesso — corrigir lá, não aqui.
--
-- Mesmo padrão do office_paid_gate (20260821214440): policy RESTRICTIVE, que
-- se soma às policies permissivas já existentes SEM substituí-las — a
-- visibilidade por time e por admin continua valendo, só ganha mais uma
-- trava por cima. `metas` já tem o office_paid_gate original (checa
-- pagamento); esta é uma SEGUNDA restrictive empilhada por cima (checa
-- módulo). `office_id` na tabela é NOT NULL, então a trava se aplica a
-- toda linha sem exceção.
--
-- Verificado ao vivo antes de escrever esta migration: nenhum escritório
-- fora de premium/cortesia/vitalício tem hoje uma linha em `metas` — a
-- trava não esconde dado nenhum que já exista.
-- ============================================================================

begin;

-- office_has_goals_module: MESMA regra do hasGoalsModule em usePlanFeatures.tsx
-- (cortesia/vitalício/premium = liberado; todo o resto = bloqueado).
create or replace function public.office_has_goals_module(p_office uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select o.access_type::text in ('lifetime', 'courtesy')
        or o.plan in ('cortesia', 'premium')
    from public.offices o
    where o.id = p_office
  ), false);
$$;
revoke execute on function public.office_has_goals_module(uuid) from public, anon, authenticated;

-- USING e WITH CHECK explícitos e idênticos (mesmo padrão do office_paid_gate
-- já aplicado nesta mesma tabela) — não depende do default implícito do
-- Postgres pra RESTRICTIVE sem WITH CHECK.
drop policy if exists office_goals_module_gate on public.metas;
create policy office_goals_module_gate on public.metas
  as restrictive
  for all
  to authenticated
  using (public.office_has_goals_module(office_id) or public.is_super_admin())
  with check (public.office_has_goals_module(office_id) or public.is_super_admin());

commit;
