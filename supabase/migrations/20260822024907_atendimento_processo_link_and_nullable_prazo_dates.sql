-- Atendimento/reuniao pode ser vinculado a um PROCESSO (opcional). O cliente/lead continua
-- obrigatorio (lead = linha em clientes com status de lead) -> cliente_id cobre os dois.
alter table public.atendimentos
  add column if not exists processo_id uuid references public.processos(id) on delete set null;
create index if not exists idx_atendimentos_processo_id on public.atendimentos(processo_id);

-- Prazo MANUAL nao tem data de disponibilizacao/intimacao (essas so existem em prazo vindo de
-- publicacao/intimacao). Tornar nullable para nao forcar data inventada.
alter table public.prazos alter column data_disponibilizacao drop not null;
alter table public.prazos alter column data_intimacao drop not null;
