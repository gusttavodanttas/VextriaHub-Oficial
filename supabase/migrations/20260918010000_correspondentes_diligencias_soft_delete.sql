-- Achado do relatório "Raio-X VextriaHub" (Financeiro & Relatórios): excluir
-- correspondente/diligência era DELETE físico — irreversível, diferente do
-- padrão soft-delete (deletado boolean) usado no resto do app. Sem isso, as
-- duas tabelas também não tinham como aparecer na Lixeira pra restaurar/purgar.
alter table public.correspondentes add column if not exists deletado boolean not null default false;
alter table public.diligencias add column if not exists deletado boolean not null default false;

create index if not exists idx_correspondentes_deletado on public.correspondentes(deletado);
create index if not exists idx_diligencias_deletado on public.diligencias(deletado);

-- correspondentes_delete (já existente) restringe o DELETE físico a admin —
-- "excluir correspondente é ação de admin", comentário original da migration
-- que criou a tabela. Migrando a app pra soft-delete via UPDATE, a policy de
-- UPDATE existente (qualquer membro do escritório) abriria a "exclusão" pra
-- todo mundo se nada mais fosse feito. RESTRICTIVE + WITH CHECK sobre o valor
-- NOVO de deletado (USING não enxerga o valor novo) preserva a mesma regra —
-- mesmo idioma já usado em 20260909010000_fix_soft_delete_permission_split.sql
-- pra clientes/processos/atendimentos.
drop policy if exists "correspondentes_soft_delete_admin_only" on public.correspondentes;
create policy "correspondentes_soft_delete_admin_only" on public.correspondentes as restrictive for update
  using (true)
  with check (
    deletado = false
    OR is_office_admin(office_id) OR is_super_admin()
  );

-- Diligências continuam "operacionais — qualquer membro do escritório gerencia"
-- (mesma regra da policy diligencias_delete já existente): nenhuma restrição
-- extra na transição de deletado, só o soft-delete em si.
