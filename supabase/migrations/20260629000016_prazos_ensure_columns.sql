-- A tabela `prazos` em produção veio do CREATE mínimo do robô (OAB/DJEN).
-- Garante as colunas que a tela/dialog usam (no-op se já existirem).
alter table public.prazos add column if not exists status              text not null default 'pendente';
alter table public.prazos add column if not exists titulo             text;
alter table public.prazos add column if not exists descricao          text;
alter table public.prazos add column if not exists prioridade         text default 'media';
alter table public.prazos add column if not exists data_publicacao    date;
alter table public.prazos add column if not exists data_prazo_interno date;
alter table public.prazos add column if not exists data_vencimento    date;
alter table public.prazos add column if not exists processo_id        uuid;
alter table public.prazos add column if not exists user_id            uuid;
alter table public.prazos add column if not exists responsavel_id     uuid;
alter table public.prazos add column if not exists office_id          uuid;
-- Auditoria de conclusão (concluir/reabrir dependem destas)
alter table public.prazos add column if not exists concluido_em       timestamptz;
alter table public.prazos add column if not exists concluido_por      uuid;

-- Corrige a cópia indevida anterior: publicação NÃO é disponibilização
-- (Lei 11.419/2006 art. 4º §3º — publicação = 1º dia útil seguinte).
-- Zera data_publicacao dos prazos do robô onde foi copiada da disponibilização.
update public.prazos
set data_publicacao = null
where publicacao_id is not null
  and data_publicacao is not null
  and data_publicacao = data_disponibilizacao;

-- Título de exibição para prazos do robô sem título (usa o tipo do prazo).
update public.prazos
set titulo = coalesce(nullif(titulo, ''), tipo_prazo, 'Prazo processual')
where titulo is null or btrim(titulo) = '';
