
-- Add missing columns to processos table for a better Capa
ALTER TABLE public.processos 
ADD COLUMN IF NOT EXISTS requerido TEXT,
ADD COLUMN IF NOT EXISTS segredo_justica BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS justica_gratuita BOOLEAN DEFAULT false;

-- Create a table for process movements (Timeline)
CREATE TABLE IF NOT EXISTS public.movimentacoes_processo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE,
    processo_id UUID REFERENCES public.processos(id) ON DELETE CASCADE NOT NULL,
    data_movimentacao TIMESTAMP WITH TIME ZONE NOT NULL,
    descricao TEXT NOT NULL,
    detalhes TEXT,
    tipo TEXT, -- 'andamento', 'publicacao', 'decisao', etc.
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.movimentacoes_processo ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view movements of their processes"
    ON public.movimentacoes_processo FOR SELECT
    USING (
        processo_id IN (
            SELECT id FROM public.processos 
            WHERE office_id = public.movimentacoes_processo.office_id 
               OR user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert movements for their processes"
    ON public.movimentacoes_processo FOR INSERT
    WITH CHECK (
        processo_id IN (
            SELECT id FROM public.processos 
            WHERE office_id = public.movimentacoes_processo.office_id 
               OR user_id = auth.uid()
        )
    );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_movimentacoes_processo_id ON public.movimentacoes_processo(processo_id);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_data ON public.movimentacoes_processo(data_movimentacao DESC);
