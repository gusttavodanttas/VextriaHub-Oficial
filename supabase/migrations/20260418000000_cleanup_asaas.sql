-- =============================================================================
-- MIGRATION: Day 3 - Cleanup Asaas
-- Data: 18 de Abril de 2026
-- Objetivo: Remover tabelas e referências Asaas obsoletas
-- =============================================================================

-- 1. Drop checkout_logs table (depende de asaas_checkouts)
DROP TABLE IF EXISTS public.checkout_logs CASCADE;

-- 2. Drop asaas_webhooks table (depende de asaas_checkouts)
DROP TABLE IF EXISTS public.asaas_webhooks CASCADE;

-- 3. Drop asaas_checkouts table (principal)
DROP TABLE IF EXISTS public.asaas_checkouts CASCADE;

-- =============================================================================
-- Verificação: Confirmar que tabelas Asaas foram removidas
-- =============================================================================
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public' AND table_name LIKE 'asaas%';
-- Resultado esperado: (0 registros)
