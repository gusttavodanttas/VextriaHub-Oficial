-- Correção da migração anterior: funções nascem com EXECUTE para PUBLIC (anon herda daí).
-- Para tirar de anon de fato, revoga de PUBLIC e reconcede explicitamente aos papéis que usam.
-- apply_signup_plan só faz sentido autenticado; confirm_invited_user segue anon de propósito.
revoke execute on function public.apply_signup_plan(text) from public;
revoke execute on function public.apply_signup_plan(text) from anon;
grant execute on function public.apply_signup_plan(text) to authenticated;
grant execute on function public.apply_signup_plan(text) to service_role;
