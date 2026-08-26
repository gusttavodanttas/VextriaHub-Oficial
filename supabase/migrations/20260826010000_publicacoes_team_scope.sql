-- Visão por equipe das publicações (decisão do usuário): cada membro vê só o dele,
-- coordenador vê a equipe, admin vê tudo — o MESMO modelo de processos/tarefas.
-- A policy ampla publicacoes_office_scope (PERMISSIVE, ALL, office_id ∈ get_user_office_ids())
-- vencia por OR e deixava TODO membro do escritório ver TODAS as publicações. Removida.
-- As granulares assumem: publicacoes_select/update (is_office_admin OR processo visível OR
-- user em team_visible_user_ids), publicacoes_insert (user_belongs_to_office), publicacoes_delete.
-- O robô escreve via service_role (bypassa RLS), então a captura não é afetada.
-- Testado ao vivo: admin mantém as 90 publicações; outro escritório vê 0 (isolamento intacto).
drop policy if exists publicacoes_office_scope on public.publicacoes;
