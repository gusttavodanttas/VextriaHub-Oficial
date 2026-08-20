-- Lote P1 da re-auditoria v4. Rodar no SQL Editor.
-- (1) Ex-membro DESATIVADO (active=false) ainda acessava 4 tabelas periféricas: as policies
--     usavam `office_id IN (select office_id from office_users where user_id=auth.uid())` SEM
--     `and active=true` → advogado desligado seguia lendo/escrevendo dados do ex-escritório.
--     Troca por public.get_user_office_ids() (que filtra active=true), igual ao núcleo.
-- (2) DROP da tabela `subscribers` (legado Stripe): tinha escrita aberta (USING(true)/WITH CHECK(true))
--     → qualquer autenticado lia/alterava linhas alheias (email + stripe_customer_id). Stripe foi
--     removido, a cobrança é Asaas e NADA no código lê `subscribers` (só aparece no types.ts gerado).

-- ── (1) tarefa_comentarios ──
drop policy if exists "membros veem comentarios do escritorio" on public.tarefa_comentarios;
create policy "membros veem comentarios do escritorio" on public.tarefa_comentarios for select
  using (office_id = any(public.get_user_office_ids()));
drop policy if exists "membros inserem comentarios no escritorio" on public.tarefa_comentarios;
create policy "membros inserem comentarios no escritorio" on public.tarefa_comentarios for insert
  with check (office_id = any(public.get_user_office_ids()) and user_id = auth.uid());

-- ── (1) tarefa_subtarefas ──
drop policy if exists "membros veem subtarefas do escritorio" on public.tarefa_subtarefas;
create policy "membros veem subtarefas do escritorio" on public.tarefa_subtarefas for select
  using (office_id = any(public.get_user_office_ids()));
drop policy if exists "membros inserem subtarefas no escritorio" on public.tarefa_subtarefas;
create policy "membros inserem subtarefas no escritorio" on public.tarefa_subtarefas for insert
  with check (office_id = any(public.get_user_office_ids()));
drop policy if exists "membros atualizam subtarefas do escritorio" on public.tarefa_subtarefas;
create policy "membros atualizam subtarefas do escritorio" on public.tarefa_subtarefas for update
  using (office_id = any(public.get_user_office_ids()));

-- ── (1) audiencia_tipos ──
drop policy if exists "tipos_select_proprio_escritorio" on public.audiencia_tipos;
create policy "tipos_select_proprio_escritorio" on public.audiencia_tipos for select
  using (office_id = any(public.get_user_office_ids()));
drop policy if exists "tipos_insert_proprio_escritorio" on public.audiencia_tipos;
create policy "tipos_insert_proprio_escritorio" on public.audiencia_tipos for insert
  with check (office_id = any(public.get_user_office_ids()));
drop policy if exists "tipos_update_proprio_escritorio" on public.audiencia_tipos;
create policy "tipos_update_proprio_escritorio" on public.audiencia_tipos for update
  using (office_id = any(public.get_user_office_ids()));
drop policy if exists "tipos_delete_proprio_escritorio" on public.audiencia_tipos;
create policy "tipos_delete_proprio_escritorio" on public.audiencia_tipos for delete
  using (office_id = any(public.get_user_office_ids()));

-- ── (1) processos_encontrados ──
drop policy if exists "encontrados_office_all" on public.processos_encontrados;
create policy "encontrados_office_all" on public.processos_encontrados for all to authenticated
  using (office_id = any(public.get_user_office_ids()))
  with check (office_id = any(public.get_user_office_ids()));

-- ── (2) DROP da tabela subscribers (legado Stripe com furo de escrita) ──
drop table if exists public.subscribers cascade;
