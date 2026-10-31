-- Recesso forense (20/12 a 20/01) lançado na tabela feriados com
-- abrangencia = 'recesso'. Vale só para o painel da Controladoria (que lê
-- todas as linhas); as esteiras do VextriaHub (prazos internos, alertas e
-- automações) continuam contando o recesso como dia útil, porque o escritório
-- trabalha nesse período.

begin;

create or replace function public.esteira_eh_dia_util(p_dia date)
returns boolean
language sql
stable
set search_path = public
as $$
  select extract(isodow from p_dia) < 6
     and not exists (select 1 from public.feriados f where f.data = p_dia and f.abrangencia <> 'recesso');
$$;

insert into public.feriados (data, nome, abrangencia)
select d::date, 'Recesso forense (CPC, art. 220)', 'recesso'
  from generate_series('2026-12-20'::date, '2027-01-20'::date, interval '1 day') d
union all
select d::date, 'Recesso forense (CPC, art. 220)', 'recesso'
  from generate_series('2027-12-20'::date, '2028-01-20'::date, interval '1 day') d
on conflict do nothing;

commit;
