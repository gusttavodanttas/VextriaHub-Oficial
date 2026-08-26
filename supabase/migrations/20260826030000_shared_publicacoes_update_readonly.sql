-- Fecha o único efeito colateral do compartilhamento de processos.
-- publicacoes_update referencia (SELECT id FROM processos) sob RLS; ao estender
-- processos_select aos parceiros (migration 20260826020000), um parceiro com
-- permissão 'ver' passava a poder MUTAR (marcar lida/arquivar/urgência) as
-- publicações do dono, porque casava pelo processo compartilhado.
--
-- Correção cirúrgica: excluir do caminho de UPDATE os processos compartilhados
-- COMIGO (shared_processo_ids). O SELECT continua amplo (o parceiro acompanha as
-- publicações do processo). O comportamento do DONO fica byte-a-byte idêntico:
-- um processo próprio nunca aparece em shared_processo_ids() (não dá para
-- compartilhar consigo mesmo). Testado ao vivo: parceiro VÊ 2 publicações e o
-- UPDATE afeta 0 linhas (RLS barra).
drop policy if exists publicacoes_update on public.publicacoes;
create policy publicacoes_update on public.publicacoes for update
  using (
    is_office_admin(office_id)
    or ((processo_id is not null)
        and (processo_id in (select processos.id from processos))
        and (processo_id not in (select shared_processo_ids())))
    or ((user_id is not null) and (user_id in (select team_visible_user_ids(publicacoes.office_id))))
  );
