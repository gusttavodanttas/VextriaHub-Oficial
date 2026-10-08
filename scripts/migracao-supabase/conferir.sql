-- Conferência pós-restauração. Rodar no SQL Editor do projeto novo (ou via psql).
-- 1) Linhas por tabela — comparar com contagens.txt gerado pelo extrair-do-backup.py.
select table_schema || '.' || table_name as tabela,
       (xpath('/row/c/text()', query_to_xml(format('select count(*) c from %I.%I', table_schema, table_name), false, true, '')))[1]::text::int as linhas
from information_schema.tables
where table_type = 'BASE TABLE'
  and (table_schema = 'public' or (table_schema, table_name) in (('auth','users'),('auth','identities'),('storage','buckets'),('storage','objects')))
order by 1;

-- 2) Objetos do schema da aplicação (esperado, vindo do backup: 48 tabelas, 44 funções,
--    195 policies em public + 3 em storage, 40 triggers em public + 1 em auth.users).
select 'tabelas public' o, count(*) from pg_tables where schemaname = 'public'
union all select 'tabelas public com RLS', count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
union all select 'funcoes public', count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
union all select 'policies public', count(*) from pg_policies where schemaname = 'public'
union all select 'policies storage', count(*) from pg_policies where schemaname = 'storage'
union all select 'triggers public', count(*) from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and not t.tgisinternal
union all select 'trigger em auth.users', count(*) from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'auth' and c.relname = 'users' and not t.tgisinternal;

-- 3) Órfãos de chave estrangeira (a carga em modo replica não valida FK — isto valida).
do $$
declare r record; n bigint; com_orfaos int := 0;
begin
  for r in
    select c.conname, c.conrelid::regclass as filho, c.confrelid::regclass as pai,
           (select a.attname from pg_attribute a where a.attrelid = c.conrelid and a.attnum = c.conkey[1]) as col,
           (select a.attname from pg_attribute a where a.attrelid = c.confrelid and a.attnum = c.confkey[1]) as pcol,
           array_length(c.conkey, 1) as ncols
    from pg_constraint c join pg_namespace ns on ns.oid = c.connamespace
    where c.contype = 'f' and ns.nspname in ('public', 'storage')
  loop
    if r.ncols > 1 then raise notice 'FK composta não conferida: %', r.conname; continue; end if;
    execute format('select count(*) from %s ch where ch.%I is not null and not exists (select 1 from %s p where p.%I = ch.%I)', r.filho, r.col, r.pai, r.pcol, r.col) into n;
    if n > 0 then raise notice '% órfão(s): %.% -> %', n, r.filho, r.col, r.pai; com_orfaos := com_orfaos + 1; end if;
  end loop;
  raise notice 'FKs com órfãos: % (esperado 0)', com_orfaos;
end $$;
