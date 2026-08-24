-- Defesa em profundidade para o vetor de TAKEOVER (achado CRÍTICO da v8): a policy de UPDATE
-- de profiles não tinha WITH CHECK — a proteção contra auto-promoção a super_admin dependia
-- SÓ do trigger protect_profile_privileges. Se uma migration futura derrubar/desabilitar o
-- trigger, o takeover global volta na hora. Este WITH CHECK bloqueia INDEPENDENTEMENTE o caso
-- catastrófico (resultar role='super_admin' sem já ser super_admin), sem quebrar o self-update
-- legítimo de quem é 'admin' de escritório (role continua 'admin' <> 'super_admin').
-- office_id e user->admin seguem cobertos pelo trigger (escalonamento contido ao próprio escritório).
-- Testado ao vivo (impersonando role=user): wc_super=false (bloqueia), wc_user=true (permite),
-- update legítimo de full_name = 1 linha (sem regressão), escalonamento a super_admin bloqueado.
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (role <> 'super_admin'::app_role or is_super_admin())
  );
