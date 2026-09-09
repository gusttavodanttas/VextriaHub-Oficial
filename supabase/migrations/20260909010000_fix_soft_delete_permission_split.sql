-- Achado registrado na parte 8: o toggle "Excluir" de clientes/processos/
-- atendimentos nunca teve efeito, porque a exclusao nessas 3 tabelas e sempre
-- soft-delete via UPDATE (deletado=true), e as policies RESTRICTIVE do D.1
-- mapeavam canDelete* para a acao DELETE do Postgres -- que a app nunca
-- exercita ali. Quem de fato bloqueava/liberava era canEdit* (e, em
-- atendimentos, tambem canManageAgenda).
--
-- Correcao: separa "estou editando um campo normal" de "estou marcando como
-- excluido" dentro da propria policy de UPDATE, usando WITH CHECK sobre o
-- valor NOVO de deletado/deletado_pendente (USING nao enxerga o valor novo,
-- por isso vira `true` nas duas pontas -- toda a decisao migra pro WITH
-- CHECK, que Postgres AVALIA CONTRA A LINHA RESULTANTE e, se falhar, lanca
-- erro -- nao e' silencioso como um USING que bloqueia). Resultado:
--   - edicao normal (deletado permanece false)   -> continua exigindo canEdit* (e canManageAgenda em atendimentos), como sempre foi.
--   - transicao pra deletado/deletado_pendente=true -> passa a exigir canDelete*, independente de canEdit*.
-- Verificado ao vivo (BEGIN/ROLLBACK) nas 3 tabelas, 11 cenarios: canEdit=false
-- nao bloqueia mais o soft-delete; canDelete=false agora bloqueia de verdade;
-- edicao normal continua exigindo canEdit* (e canManageAgenda) como antes.

drop policy if exists "perm_update_clientes_canEditClients_narrow" on public.clientes;
create policy "perm_update_clientes_canEditClients_narrow" on public.clientes as restrictive for update
  using (true)
  with check (
    (deletado = true OR deletado_pendente = true)
    OR coalesce(permission_override(office_id, 'canEditClients'), true)
  );
create policy "perm_update_clientes_canDeleteClients_narrow" on public.clientes as restrictive for update
  using (true)
  with check (
    NOT (deletado = true OR deletado_pendente = true)
    OR coalesce(permission_override(office_id, 'canDeleteClients'), true)
  );

drop policy if exists "perm_update_processos_canEditProcesses_narrow" on public.processos;
create policy "perm_update_processos_canEditProcesses_narrow" on public.processos as restrictive for update
  using (true)
  with check (
    (deletado = true OR deletado_pendente = true)
    OR coalesce(permission_override(office_id, 'canEditProcesses'), true)
  );
create policy "perm_update_processos_canDeleteProcesses_narrow" on public.processos as restrictive for update
  using (true)
  with check (
    NOT (deletado = true OR deletado_pendente = true)
    OR coalesce(permission_override(office_id, 'canDeleteProcesses'), true)
  );

drop policy if exists "perm_update_atendimentos_canEditAtendimentos_narrow" on public.atendimentos;
create policy "perm_update_atendimentos_canEditAtendimentos_narrow" on public.atendimentos as restrictive for update
  using (true)
  with check (
    (deletado = true OR deletado_pendente = true)
    OR coalesce(permission_override(office_id, 'canEditAtendimentos'), true)
  );
drop policy if exists "perm_update_atendimentos_canManageAgenda_narrow" on public.atendimentos;
create policy "perm_update_atendimentos_canManageAgenda_narrow" on public.atendimentos as restrictive for update
  using (true)
  with check (
    (deletado = true OR deletado_pendente = true)
    OR coalesce(permission_override(office_id, 'canManageAgenda'), true)
  );
create policy "perm_update_atendimentos_canDeleteAtendimentos_narrow" on public.atendimentos as restrictive for update
  using (true)
  with check (
    NOT (deletado = true OR deletado_pendente = true)
    OR coalesce(permission_override(office_id, 'canDeleteAtendimentos'), true)
  );
