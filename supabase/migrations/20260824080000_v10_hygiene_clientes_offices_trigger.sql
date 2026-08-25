-- v10 higiene:
-- 1. Status de cliente gravado com casing misto ('ativo' e 'Ativo') — normaliza pra minúsculo
--    (o KPI já virou case-insensitive, mas isto conserta também qualquer filtro case-sensitive).
update public.clientes set status = 'ativo' where status = 'Ativo';

-- 2. offices_insert_auth era WITH CHECK (auth.uid() IS NOT NULL) → qualquer logado inseria linhas
--    arbitrárias em offices. O app cria escritório só via ensure_office_for_user (SECURITY DEFINER,
--    bypassa RLS) e NÃO faz insert direto em offices (verificado no front). Amarra ao criador.
drop policy if exists offices_insert_auth on public.offices;
create policy offices_insert_auth on public.offices
  for insert to public
  with check (auth.uid() = created_by);

-- 3. Defense-in-depth: a função de TRIGGER nova sync_office_plan_from_subscription (SECURITY DEFINER)
--    aparecia como executável via /rpc por anon/authenticated (advisor). Triggers não dependem de
--    EXECUTE — revoga de PUBLIC (mesmo padrão dos outros triggers já endurecidos).
-- (revoga de public E anon/authenticated — o Supabase concede explícito a esses papéis)
revoke execute on function public.sync_office_plan_from_subscription() from public, anon, authenticated;
