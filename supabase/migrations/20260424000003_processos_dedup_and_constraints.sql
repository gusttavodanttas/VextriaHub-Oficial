-- Migration: De-duplication and Data Hardening for Processos
-- Version: 20260424000003

-- 1. Marcar duplicatas como deletadas
-- Mantém apenas o registro mais antigo por processo dentro de cada escritório
WITH Duplicates AS (
    SELECT id, 
           ROW_NUMBER() OVER (
               PARTITION BY office_id, numero_processo 
               ORDER BY created_at ASC
           ) as row_num
    FROM public.processos
    WHERE deletado = false OR deletado IS NULL
)
UPDATE public.processos
SET deletado = true,
    updated_at = NOW()
WHERE id IN (
    SELECT id FROM Duplicates WHERE row_num > 1
);

-- 2. Adicionar restrição de unicidade (Índice parcial)
-- Garante que um escritório não possa ter dois processos ativos com o mesmo número
CREATE UNIQUE INDEX IF NOT EXISTS idx_processos_unique_numero_office 
ON public.processos (office_id, numero_processo) 
WHERE (deletado = false OR deletado IS NULL);

-- 3. Sanitização de títulos corrompidos
-- Corrige títulos que vieram com lixo do parser (muito longos ou com padrões de erro)
UPDATE public.processos
SET titulo = SUBSTRING(numero_processo FROM 1 FOR 7) || '-' || 
             SUBSTRING(numero_processo FROM 8 FOR 2) || '.' || 
             SUBSTRING(numero_processo FROM 10 FOR 4) || '.' || 
             SUBSTRING(numero_processo FROM 14 FOR 1) || '.' || 
             SUBSTRING(numero_processo FROM 15 FOR 2) || '.' || 
             SUBSTRING(numero_processo FROM 17 FOR 4),
    updated_at = NOW()
WHERE (LENGTH(titulo) > 120 OR titulo LIKE '%FINALIDADE:%' OR titulo LIKE '%Destinatários:%')
  AND LENGTH(numero_processo) = 20;

-- 4. Garantir colunas essenciais
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'processos' AND column_name = 'data_distribuicao') THEN
        ALTER TABLE public.processos ADD COLUMN data_distribuicao DATE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'processos' AND column_name = 'requerido') THEN
        ALTER TABLE public.processos ADD COLUMN requerido TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'processos' AND column_name = 'justica_gratuita') THEN
        ALTER TABLE public.processos ADD COLUMN justica_gratuita BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'processos' AND column_name = 'segredo_justica') THEN
        ALTER TABLE public.processos ADD COLUMN segredo_justica BOOLEAN DEFAULT false;
    END IF;
END $$;

-- 5. Comentário de auditoria
COMMENT ON INDEX idx_processos_unique_numero_office IS 'Garante unicidade de processos ativos por escritório para evitar duplicidades na importação.';
