-- Subtarefas / checklist dentro de uma tarefa.
CREATE TABLE IF NOT EXISTS public.tarefa_subtarefas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id   UUID NOT NULL REFERENCES public.tarefas(id) ON DELETE CASCADE,
  office_id   UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  titulo      TEXT NOT NULL,
  concluida   BOOLEAN NOT NULL DEFAULT FALSE,
  ordem       INTEGER NOT NULL DEFAULT 0,
  deletado    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tarefa_subtarefas_tarefa_id_idx ON public.tarefa_subtarefas (tarefa_id);
CREATE INDEX IF NOT EXISTS tarefa_subtarefas_office_id_idx ON public.tarefa_subtarefas (office_id);

ALTER TABLE public.tarefa_subtarefas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "membros veem subtarefas do escritorio"
  ON public.tarefa_subtarefas FOR SELECT
  USING (office_id IN (SELECT office_id FROM public.office_users WHERE user_id = auth.uid()));

CREATE POLICY "membros inserem subtarefas no escritorio"
  ON public.tarefa_subtarefas FOR INSERT
  WITH CHECK (office_id IN (SELECT office_id FROM public.office_users WHERE user_id = auth.uid()));

CREATE POLICY "membros atualizam subtarefas do escritorio"
  ON public.tarefa_subtarefas FOR UPDATE
  USING (office_id IN (SELECT office_id FROM public.office_users WHERE user_id = auth.uid()));

CREATE POLICY "service role acesso total subtarefas"
  ON public.tarefa_subtarefas FOR ALL
  USING (auth.role() = 'service_role');
