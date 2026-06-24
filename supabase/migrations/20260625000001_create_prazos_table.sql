-- Tabela de prazos processuais calculados automaticamente
-- Gerada a partir de publicações capturadas via OAB/DJEN
-- Regras: CPC arts. 219-224 e Lei 9.099/95 (Juizado Especial)

CREATE TABLE IF NOT EXISTS public.prazos (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id             UUID NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  publicacao_id         UUID UNIQUE REFERENCES public.publicacoes(id) ON DELETE CASCADE,
  numero_processo       TEXT,
  tipo_prazo            TEXT NOT NULL DEFAULT 'Desconhecido',
  data_disponibilizacao DATE NOT NULL,
  data_intimacao        DATE NOT NULL,
  data_fim_prazo        DATE,
  dias_uteis            INTEGER,
  base_legal            TEXT,
  eh_juizado            BOOLEAN NOT NULL DEFAULT FALSE,
  dias_corridos         BOOLEAN NOT NULL DEFAULT FALSE,
  calculado_em          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para consultas comuns
CREATE INDEX IF NOT EXISTS prazos_office_id_idx        ON public.prazos (office_id);
CREATE INDEX IF NOT EXISTS prazos_data_fim_prazo_idx   ON public.prazos (data_fim_prazo) WHERE data_fim_prazo IS NOT NULL;
CREATE INDEX IF NOT EXISTS prazos_numero_processo_idx  ON public.prazos (numero_processo);

-- RLS
ALTER TABLE public.prazos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuarios veem prazos do proprio escritorio"
  ON public.prazos FOR SELECT
  USING (
    office_id IN (
      SELECT office_id FROM public.office_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "usuarios inserem prazos no proprio escritorio"
  ON public.prazos FOR INSERT
  WITH CHECK (
    office_id IN (
      SELECT office_id FROM public.office_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "usuarios atualizam prazos do proprio escritorio"
  ON public.prazos FOR UPDATE
  USING (
    office_id IN (
      SELECT office_id FROM public.office_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "service role acesso total prazos"
  ON public.prazos FOR ALL
  USING (auth.role() = 'service_role');

-- View auxiliar: prazos próximos do vencimento (≤ 7 dias úteis)
CREATE OR REPLACE VIEW public.prazos_urgentes AS
SELECT
  p.*,
  pub.titulo AS publicacao_titulo,
  pub.status AS publicacao_status,
  (p.data_fim_prazo - CURRENT_DATE) AS dias_restantes
FROM public.prazos p
LEFT JOIN public.publicacoes pub ON pub.id = p.publicacao_id
WHERE
  p.data_fim_prazo IS NOT NULL
  AND p.data_fim_prazo >= CURRENT_DATE
  AND (p.data_fim_prazo - CURRENT_DATE) <= 7
ORDER BY p.data_fim_prazo ASC;
