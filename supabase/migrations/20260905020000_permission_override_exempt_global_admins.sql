-- usePermissions.tsx (front-end) nunca aplica overrides de user_permissions a
-- quem tem role global 'admin'/'super_admin' -- so a permissoes de membro
-- comum. O helper permission_override() criado na migration anterior nao
-- replicava essa regra; corrige para o backend casar exatamente o que o
-- front-end ja fazia (nenhum super_admin/admin tem override hoje, entao isto
-- e preventivo, nao corrige uma falha ja observada).
create or replace function public.permission_override(p_office uuid, p_key text)
returns boolean language sql stable security definer set search_path = public as $$
  select up.granted from public.user_permissions up
  where up.office_id = p_office and up.user_id = (select auth.uid()) and up.permission_key = p_key
    and not exists (
      select 1 from public.profiles p
      where p.user_id = (select auth.uid()) and p.role in ('admin', 'super_admin')
    )
  limit 1;
$$;
