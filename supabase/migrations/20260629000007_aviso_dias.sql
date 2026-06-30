-- Antecedência de aviso POR ITEM (notificações de proximidade).
-- null = usa o padrão global do usuário; 0 = não avisar; N = avisar N dias antes.
alter table public.audiencias add column if not exists aviso_dias integer;
alter table public.prazos     add column if not exists aviso_dias integer;
alter table public.tarefas    add column if not exists aviso_dias integer;
