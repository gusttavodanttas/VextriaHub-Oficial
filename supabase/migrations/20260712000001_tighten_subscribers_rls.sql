-- Aperta as policies de ESCRITA da tabela public.subscribers.
--
-- Estado auditado (jul/2026): a policy de SELECT já estava correta
--   subs_user_select: USING (user_id = auth.uid() OR email = auth.email())
-- mas as de escrita estavam abertas para QUALQUER usuário autenticado:
--   subs_user_update: USING (true)        -> alterar linha de billing alheia
--   subs_user_insert: WITH CHECK (true)   -> inserir linha para qualquer user_id
--
-- As edge functions usam service_role, que IGNORA RLS — então este aperto NÃO
-- quebra nenhum fluxo legítimo (webhooks do Stripe seguem escrevendo). Ele só
-- fecha a porta para o usuário comum tocar em assinatura que não é dele.
-- O app não lê nem escreve subscribers diretamente.
--
-- ALTER POLICY preserva a policy e troca só a condição; é idempotente.

alter policy "subs_user_update" on public.subscribers
  using (user_id = auth.uid());

alter policy "subs_user_insert" on public.subscribers
  with check (user_id = auth.uid());
