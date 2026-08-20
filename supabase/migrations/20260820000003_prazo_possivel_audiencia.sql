-- Item 5 (abordagem A): "possível audiência". O calculate-prazo marca o prazo quando o teor
-- da publicação fala de audiência e SUGERE data/hora/tipo. O front mostra um selo + botão
-- "Agendar audiência" pré-preenchido; o usuário confirma num clique. NUNCA agenda sozinho —
-- data de audiência errada = ato processual perdido. Rodar no SQL Editor.
alter table public.prazos
  add column if not exists possivel_audiencia boolean not null default false,
  add column if not exists audiencia_data_sugerida date,
  add column if not exists audiencia_hora_sugerida text,
  add column if not exists audiencia_tipo_sugerido text;
