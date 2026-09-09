-- Separação PJ/PF (índice de mistura patrimonial) e priorização de despesas
-- (G1/G2/G3/Esperar) no módulo Financeiro. Todo lançamento existente é
-- assumido como "pj" (o financeiro sempre representou o caixa do escritório).
alter table public.financeiro
  add column if not exists escopo text not null default 'pj',
  add column if not exists prioridade text;

alter table public.financeiro
  add constraint financeiro_escopo_check check (escopo = any (array['pj'::text, 'pf'::text]));

alter table public.financeiro
  add constraint financeiro_prioridade_check
    check (prioridade is null or prioridade = any (array['g1'::text, 'g2'::text, 'g3'::text, 'esperar'::text]));

comment on column public.financeiro.escopo is
  'pj (escritório) ou pf (pessoal do titular) — base do índice de mistura patrimonial exibido no dashboard.';
comment on column public.financeiro.prioridade is
  'Classificação de urgência para despesas pendentes (g1=essencial, g2=importante, g3=contornável, esperar=aguardar caixa). Null = não classificada.';
