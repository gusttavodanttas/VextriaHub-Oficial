-- Permite VÁRIOS processos sem número CNJ por escritório (casos "a protocolar").
--
-- O índice único (office_id, numero_processo) where deletado=false tratava a string
-- vazia como um número normal → só cabia UM processo sem número por escritório, e o
-- upsert do front sobrescrevia o anterior em silêncio (corrigido no useProcessosV2).
-- A unicidade continua valendo para números reais.
--
-- Rodar no SQL Editor (conta contato@vextriahub.com.br, projeto mzhnlhfxfoigkqgxseeu).

drop index if exists public.idx_processos_unique_numero_office;

create unique index idx_processos_unique_numero_office
  on public.processos (office_id, numero_processo)
  where deletado = false and numero_processo <> '';
