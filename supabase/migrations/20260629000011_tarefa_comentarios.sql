-- Comentários em tarefas (sem anexos).
CREATE TABLE IF NOT EXISTS public.tarefa_comentarios (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id   UUID NOT NULL REFERENCES public.tarefas(id) ON DELETE CASCADE,
  office_id   UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL,
  texto       TEXT NOT NULL,
  deletado    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tarefa_comentarios_tarefa_id_idx ON public.tarefa_comentarios (tarefa_id);
CREATE INDEX IF NOT EXISTS tarefa_comentarios_office_id_idx ON public.tarefa_comentarios (office_id);

ALTER TABLE public.tarefa_comentarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "membros veem comentarios do escritorio"
  ON public.tarefa_comentarios FOR SELECT
  USING (
    office_id IN (SELECT office_id FROM public.office_users WHERE user_id = auth.uid())
  );

CREATE POLICY "membros inserem comentarios no escritorio"
  ON public.tarefa_comentarios FOR INSERT
  WITH CHECK (
    office_id IN (SELECT office_id FROM public.office_users WHERE user_id = auth.uid())
    AND user_id = auth.uid()
  );

CREATE POLICY "autor atualiza proprio comentario"
  ON public.tarefa_comentarios FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "service role acesso total comentarios"
  ON public.tarefa_comentarios FOR ALL
  USING (auth.role() = 'service_role');
