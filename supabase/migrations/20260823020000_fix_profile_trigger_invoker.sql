-- CRÍTICO (reauditoria v8): o trigger protect_profile_privileges era SECURITY DEFINER
-- (dono=postgres). Dentro de uma função SECURITY DEFINER, current_user é sempre o DONO
-- (postgres) → o `if current_user in ('postgres',...)` do começo era SEMPRE verdadeiro →
-- o trigger NUNCA bloqueava. Resultado (confirmado ao vivo): qualquer usuário autenticado
-- conseguia PATCH profiles {role:'super_admin'} e virar super-admin (takeover total), e
-- também reescrever o próprio office_id (vazamento cross-tenant via google-sync).
--
-- Fix: SECURITY INVOKER → current_user vira o CHAMADOR real:
--   - authenticated (PATCH direto do usuário) → NÃO bypassa → bloqueia role/office_id
--   - service_role / postgres / migrações → bypassa (correto)
--   - funções SECURITY DEFINER de onboarding (ensure_office_for_user, confirm_invited_user)
--     rodam como postgres → dentro delas current_user=postgres → bypassa (troca legítima ok)
-- Também estende a proteção ao office_id (antes só role).
-- Testado ao vivo: regular->super BLOQUEADO, regular->office_id BLOQUEADO,
-- regular->full_name PERMITIDO, super-admin->role PERMITIDO.
create or replace function public.protect_profile_privileges()
returns trigger language plpgsql security invoker set search_path to 'public' as $function$
begin
  if current_user in ('postgres','service_role','supabase_admin')
     or coalesce(auth.jwt() ->> 'role','') = 'service_role' then
    return new;
  end if;
  if new.role is distinct from old.role then
    if not exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role = 'super_admin') then
      raise exception 'Alteração de papel (role) não autorizada';
    end if;
  end if;
  if new.office_id is distinct from old.office_id then
    if not exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role = 'super_admin') then
      raise exception 'Alteração de escritório (office_id) não autorizada';
    end if;
  end if;
  return new;
end; $function$;