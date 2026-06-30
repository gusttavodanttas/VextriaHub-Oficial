-- Antecedências de aviso POR ITEM, agora MÚLTIPLAS (ex.: {15,7,1}).
-- null = usa o padrão global; {} = não avisar; {15,7} = avisar nesses marcos.
alter table public.audiencias add column if not exists avisos_dias integer[];
alter table public.prazos     add column if not exists avisos_dias integer[];
alter table public.tarefas    add column if not exists avisos_dias integer[];
