-- Recorrência encadeada e desfecho/resultado para atendimentos.
alter table public.atendimentos add column if not exists recorrencia_grupo text;
alter table public.atendimentos add column if not exists recorrencia_regra text;
alter table public.atendimentos add column if not exists recorrencia_restantes integer;
alter table public.atendimentos add column if not exists resultado text;
