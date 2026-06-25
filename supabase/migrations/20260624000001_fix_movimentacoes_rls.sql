-- Fix RLS na tabela movimentacoes_processo
-- Fase 2 review (2026-06-25): RLS fix + backfill para movimentacoes. Similar ao fix de processos.
-- Verificar se office_id agora é sempre preenchido nas movimentacoes e se as policies atuais usam apenas office_id sem fallback para user_id via processos.
-- Recomendação: Auditar se esta migração ainda é relevante ou se pode ser considerada histórica.
-- Problema: a policy original verifica movimentacoes.office_id = processos.office_id,
-- o que falha quando a movimentação foi salva sem office_id (NULL).
-- A correção verifica o office_id do usuário logado via profiles.

-- 1. Remove as policies antigas
DROP POLICY IF EXISTS "Users can view movements of their processes" ON public.movimentacoes_processo;
DROP POLICY IF EXISTS "Users can insert movements for their processes" ON public.movimentacoes_processo;
DROP POLICY IF EXISTS "Users can update movements" ON public.movimentacoes_processo;
DROP POLICY IF EXISTS "Users can delete movements" ON public.movimentacoes_processo;

-- 2. Cria policies corrigidas usando office_id do usuário logado
CREATE POLICY "movimentacoes_select"
    ON public.movimentacoes_processo FOR SELECT
    USING (
        -- Movimento pertence ao mesmo escritório do usuário
        office_id IN (
            SELECT office_id FROM public.profiles WHERE id = auth.uid()
        )
        OR
        -- OU o processo ao qual pertence é do escritório do usuário
        -- (cobre movimentações antigas salvas sem office_id)
        processo_id IN (
            SELECT id FROM public.processos
            WHERE office_id IN (
                SELECT office_id FROM public.profiles WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "movimentacoes_insert"
    ON public.movimentacoes_processo FOR INSERT
    WITH CHECK (
        office_id IN (
            SELECT office_id FROM public.profiles WHERE id = auth.uid()
        )
        OR
        processo_id IN (
            SELECT id FROM public.processos
            WHERE office_id IN (
                SELECT office_id FROM public.profiles WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "movimentacoes_update"
    ON public.movimentacoes_processo FOR UPDATE
    USING (
        office_id IN (
            SELECT office_id FROM public.profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "movimentacoes_delete"
    ON public.movimentacoes_processo FOR DELETE
    USING (
        office_id IN (
            SELECT office_id FROM public.profiles WHERE id = auth.uid()
        )
    );

-- 3. Backfill: preenche office_id nulo usando o office_id do processo relacionado
UPDATE public.movimentacoes_processo m
SET office_id = p.office_id
FROM public.processos p
WHERE m.processo_id = p.id
  AND m.office_id IS NULL
  AND p.office_id IS NOT NULL;
