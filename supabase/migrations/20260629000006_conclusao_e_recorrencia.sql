-- Auditoria de conclusão (quem concluiu e quando) + recorrência encadeada de tarefas.
-- Rode UMA VEZ no Supabase (SQL Editor).

-- Prazos: data/autor da conclusão
alter table public.prazos
  add column if not exists concluido_em timestamptz,
  add column if not exists concluido_por uuid;

-- Tarefas: data/autor da conclusão + ocorrências restantes (recorrência encadeada)
alter table public.tarefas
  add column if not exists concluida_em timestamptz,
  add column if not exists concluida_por uuid,
  add column if not exists recorrencia_restantes integer;
