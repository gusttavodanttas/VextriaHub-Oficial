-- DR (v12): get_user_office_ids() — a helper de isolamento multi-tenant MAIS usada
-- (dezenas de policies) — vivia só no banco, sem CREATE em nenhuma migration do repo.
-- Um rebuild do zero referenciaria uma função inexistente e quebraria a RLS inteira.
-- Este CREATE OR REPLACE é idempotente (igual ao que já está vivo) e VERSIONA a função
-- no repo. Definição capturada de pg_get_functiondef no banco de produção.
CREATE OR REPLACE FUNCTION public.get_user_office_ids()
 RETURNS uuid[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT ARRAY(
    SELECT office_id FROM public.office_users WHERE user_id = auth.uid() AND active = true
  )
$function$;
