-- BUG em produção (Novo Caso → Judicial a protocolar): criar o 2º processo SEM número
-- falhava com 23505. Causa: existiam DOIS índices únicos em (office_id, numero_processo):
--   * idx_processos_unique_numero_office → WHERE deletado=false AND numero_processo <> ''  (correto, da migration 20260821000001)
--   * processos_office_numero_unique      → WHERE deletado=false AND office_id IS NOT NULL  (antigo: tratava '' como número → só cabia 1 "a protocolar")
-- A migration 20260821000001 consertou só o primeiro; o irmão antigo continuou bloqueando.
-- Fix: derruba o índice antigo redundante. A unicidade de números REAIS segue garantida
-- pelo idx_processos_unique_numero_office (mesma cobertura para numero_processo <> '').
-- Verificado ao vivo: inserir um 2º processo com numero_processo='' passa a ser aceito.
drop index if exists public.processos_office_numero_unique;
