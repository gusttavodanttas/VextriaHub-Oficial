-- ============================================================================
-- notion_page_id em processos e clientes
-- ============================================================================
-- Migration aplicada direto no projeto pvesofbrctfipdyqyloq em 09/10/2026
-- (03:33 UTC) por outra sessão, registrada em supabase_migrations como
-- 20261009033312 "add_notion_page_id_to_processos_clientes". Este arquivo
-- reproduz exatamente as instruções gravadas no banco, para o repositório
-- refletir o schema em produção. Idempotente (if not exists) — reaplicar
-- não faz nada.
--
-- Chave de sincronização com as bases Processos e Clientes do Notion; o
-- casamento também é feito por número CNJ (processos) e nome normalizado
-- (clientes). Índices únicos parciais: a coluna pode ficar nula.
-- ============================================================================

alter table public.processos add column if not exists notion_page_id text;
alter table public.clientes add column if not exists notion_page_id text;
create unique index if not exists processos_notion_page_id_uidx on public.processos(notion_page_id) where notion_page_id is not null;
create unique index if not exists clientes_notion_page_id_uidx on public.clientes(notion_page_id) where notion_page_id is not null;
comment on column public.processos.notion_page_id is 'ID da página correspondente na base Processos do Notion (chave de sincronização; casamento também por número CNJ)';
comment on column public.clientes.notion_page_id is 'ID da página correspondente na base Clientes do Notion (chave de sincronização; casamento também por nome normalizado)';
