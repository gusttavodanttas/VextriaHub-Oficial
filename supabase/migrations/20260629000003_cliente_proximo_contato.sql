-- Follow-up de leads no CRM: data do próximo contato.
-- Rode UMA VEZ no Supabase (SQL Editor). Sem isso, o campo de follow-up
-- mostra um aviso ao tentar salvar.
alter table public.clientes
  add column if not exists proximo_contato date;
