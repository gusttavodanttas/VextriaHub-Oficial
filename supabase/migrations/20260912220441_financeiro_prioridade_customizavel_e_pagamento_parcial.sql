-- Aplicada em produção em 12/09/2026 pelo dashboard (versão 20260912220441 no
-- schema_migrations) e nunca versionada aqui; recuperada do banco em 10/10/2026.

-- Grupos de prioridade passam a ser customizáveis por escritório (armazenados em
-- offices.settings.fin_grupos_prioridade), então o valor gravado em financeiro.prioridade
-- deixa de ser restrito ao enum fixo g1/g2/g3/esperar.
alter table public.financeiro drop constraint if exists financeiro_prioridade_check;

-- Suporte a pagamento/recebimento parcial: quanto já foi efetivamente pago/recebido
-- de um lançamento. NULL = nada registrado ainda (status "pago" antigo implica valor
-- total quitado, ver helper valorPago() no app). status ganha o valor "parcial" (coluna
-- já é texto livre, sem check constraint, então não precisa de migração adicional ali).
alter table public.financeiro add column if not exists valor_pago numeric null;

comment on column public.financeiro.valor_pago is 'Valor já efetivamente pago/recebido (pagamento parcial). NULL = não iniciado ou (se status=pago) totalmente quitado antes desta coluna existir.';
comment on column public.financeiro.prioridade is 'Id do grupo de prioridade customizável do escritório (offices.settings.fin_grupos_prioridade), texto livre.';
