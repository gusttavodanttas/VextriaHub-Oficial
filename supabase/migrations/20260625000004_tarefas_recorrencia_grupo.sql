-- Agrupamento de ocorrências de uma recorrência (para detectar série acabando)
ALTER TABLE public.tarefas ADD COLUMN IF NOT EXISTS recorrencia_grupo UUID;
ALTER TABLE public.tarefas ADD COLUMN IF NOT EXISTS recorrencia_regra TEXT;
CREATE INDEX IF NOT EXISTS tarefas_recorrencia_grupo_idx ON public.tarefas (recorrencia_grupo);
