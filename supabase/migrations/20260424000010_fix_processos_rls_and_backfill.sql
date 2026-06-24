-- Migration: Corrigir RLS de processos e backfill de office_id
-- Versão: 20260424000010
-- Problema: processos com office_id=NULL são bloqueados pelo RLS mesmo que
-- pertençam ao usuário via user_id. Este script:
-- 1. Faz backfill de office_id nos processos que estão sem
-- 2. Atualiza o RLS para aceitar processos via user_id como fallback

BEGIN;

-- ========================================================
-- PASSO 1: Backfill de office_id nos processos órfãos
-- Atualiza processos que têm user_id mas NÃO têm office_id,
-- vinculando ao primeiro escritório ativo do usuário
-- ========================================================
UPDATE public.processos p
SET 
  office_id = ou.office_id,
  updated_at = NOW()
FROM public.office_users ou
WHERE 
  p.user_id = ou.user_id
  AND p.office_id IS NULL
  AND ou.active = true;

-- Log quantos foram atualizados (visível no Supabase migration log)
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfill concluído: % processos atualizados com office_id', updated_count;
END $$;

-- ========================================================
-- PASSO 2: Corrigir a política RLS de processos
-- A política atual só permite acesso via office_id.
-- A nova política aceita TAMBÉM processos onde user_id = auth.uid()
-- ========================================================

-- Remover políticas conflitantes existentes
DROP POLICY IF EXISTS "Isolamento por escritório" ON public.processos;
DROP POLICY IF EXISTS "SuperAdmin acesso total" ON public.processos;
DROP POLICY IF EXISTS "Membros do escritório podem ver processos" ON public.processos;
DROP POLICY IF EXISTS "processos_select_policy" ON public.processos;
DROP POLICY IF EXISTS "processos_insert_policy" ON public.processos;
DROP POLICY IF EXISTS "processos_update_policy" ON public.processos;
DROP POLICY IF EXISTS "processos_delete_policy" ON public.processos;

-- Garantir que RLS está habilitado
ALTER TABLE public.processos ENABLE ROW LEVEL SECURITY;

-- Política SELECT: acesso via escritório OU via user_id direto
CREATE POLICY "processos_select_policy" ON public.processos
  FOR SELECT
  USING (
    -- Acesso via escritório (caminho normal)
    (office_id IS NOT NULL AND public.user_belongs_to_office(office_id))
    OR
    -- Acesso via user_id direto (registros legados / sem office_id)
    (user_id = auth.uid())
    OR
    -- Super Admin pode ver tudo
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );

-- Política INSERT: só pode inserir em escritórios que pertence
CREATE POLICY "processos_insert_policy" ON public.processos
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (
      office_id IS NULL
      OR public.user_belongs_to_office(office_id)
      OR EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'super_admin')
    )
  );

-- Política UPDATE: pode atualizar processos do seu escritório ou seus próprios
CREATE POLICY "processos_update_policy" ON public.processos
  FOR UPDATE
  USING (
    (office_id IS NOT NULL AND public.user_belongs_to_office(office_id))
    OR (user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

-- Política DELETE/SOFT DELETE: mesmo que UPDATE
CREATE POLICY "processos_delete_policy" ON public.processos
  FOR DELETE
  USING (
    (office_id IS NOT NULL AND public.user_belongs_to_office(office_id))
    OR (user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

COMMIT;
