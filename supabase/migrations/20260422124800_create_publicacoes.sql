
-- Create publicacoes table
CREATE TABLE IF NOT EXISTS public.publicacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE NOT NULL,
    numero_processo TEXT NOT NULL,
    titulo TEXT NOT NULL,
    conteudo TEXT NOT NULL,
    data_publicacao DATE NOT NULL,
    status TEXT DEFAULT 'nova' CHECK (status IN ('nova', 'lida', 'arquivada', 'processada')),
    urgencia TEXT DEFAULT 'media' CHECK (urgencia IN ('baixa', 'media', 'alta')),
    tags TEXT[] DEFAULT '{}',
    cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
    processo_id UUID REFERENCES public.processos(id) ON DELETE SET NULL,
    tribunal TEXT,
    vara TEXT,
    comarca TEXT,
    instancia TEXT,
    juiz TEXT,
    tipo_acao TEXT,
    natureza TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create monitoramento_termos table
CREATE TABLE IF NOT EXISTS public.monitoramento_termos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    office_id UUID REFERENCES public.offices(id) ON DELETE CASCADE NOT NULL,
    termo TEXT NOT NULL,
    tipo TEXT DEFAULT 'oab' CHECK (tipo IN ('oab', 'nome', 'processo', 'cpf_cnpj')),
    seccional TEXT, -- For OAB
    ativo BOOLEAN DEFAULT true,
    ultima_busca TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.publicacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitoramento_termos ENABLE ROW LEVEL SECURITY;

-- Policies for publicacoes
CREATE POLICY "Offices can view their own publicacoes"
    ON public.publicacoes FOR SELECT
    USING (office_id IN (SELECT id FROM public.offices));

CREATE POLICY "Offices can insert their own publicacoes"
    ON public.publicacoes FOR INSERT
    WITH CHECK (office_id IN (SELECT id FROM public.offices));

CREATE POLICY "Offices can update their own publicacoes"
    ON public.publicacoes FOR UPDATE
    USING (office_id IN (SELECT id FROM public.offices));

CREATE POLICY "Offices can delete their own publicacoes"
    ON public.publicacoes FOR DELETE
    USING (office_id IN (SELECT id FROM public.offices));

-- Policies for monitoramento_termos
CREATE POLICY "Offices can view their own monitoramento_termos"
    ON public.monitoramento_termos FOR SELECT
    USING (office_id IN (SELECT id FROM public.offices));

CREATE POLICY "Offices can manage their own monitoramento_termos"
    ON public.monitoramento_termos FOR ALL
    USING (office_id IN (SELECT id FROM public.offices));

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_publicacoes_office_id ON public.publicacoes(office_id);
CREATE INDEX IF NOT EXISTS idx_publicacoes_numero_processo ON public.publicacoes(numero_processo);
CREATE INDEX IF NOT EXISTS idx_monitoramento_termos_office_id ON public.monitoramento_termos(office_id);
