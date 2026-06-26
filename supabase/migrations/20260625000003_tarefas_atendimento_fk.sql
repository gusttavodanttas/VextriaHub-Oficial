-- Vínculo opcional de tarefa com atendimento
ALTER TABLE public.tarefas
  ADD COLUMN IF NOT EXISTS atendimento_id UUID
  REFERENCES public.atendimentos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS tarefas_atendimento_id_idx ON public.tarefas (atendimento_id);
