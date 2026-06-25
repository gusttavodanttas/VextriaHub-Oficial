-- Tipos de audiência personalizados por escritório
CREATE TABLE IF NOT EXISTS public.audiencia_tipos (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id  UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  nome       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (office_id, nome)
);

CREATE INDEX IF NOT EXISTS audiencia_tipos_office_id_idx ON public.audiencia_tipos (office_id);

ALTER TABLE public.audiencia_tipos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tipos_select_proprio_escritorio"
  ON public.audiencia_tipos FOR SELECT
  USING (office_id IN (SELECT office_id FROM public.office_users WHERE user_id = auth.uid()));

CREATE POLICY "tipos_insert_proprio_escritorio"
  ON public.audiencia_tipos FOR INSERT
  WITH CHECK (office_id IN (SELECT office_id FROM public.office_users WHERE user_id = auth.uid()));

CREATE POLICY "tipos_update_proprio_escritorio"
  ON public.audiencia_tipos FOR UPDATE
  USING (office_id IN (SELECT office_id FROM public.office_users WHERE user_id = auth.uid()));

CREATE POLICY "tipos_delete_proprio_escritorio"
  ON public.audiencia_tipos FOR DELETE
  USING (office_id IN (SELECT office_id FROM public.office_users WHERE user_id = auth.uid()));
