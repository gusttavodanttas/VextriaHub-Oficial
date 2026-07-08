-- Confirmação (aceite) de prazos sugeridos automaticamente pelo robô.
-- Enquanto `confirmado_em` for nulo, o prazo nascido de uma publicação é
-- tratado na UI como "Sugestão do robô" (revisar / aceitar / descartar).
alter table public.prazos add column if not exists confirmado_em timestamptz;
alter table public.prazos add column if not exists confirmado_por uuid;

-- Prazos criados manualmente pelo usuário nunca são sugestões: só os que têm
-- publicacao_id entram na triagem, então não é preciso backfill.
create index if not exists idx_prazos_confirmado_em on public.prazos(confirmado_em);
