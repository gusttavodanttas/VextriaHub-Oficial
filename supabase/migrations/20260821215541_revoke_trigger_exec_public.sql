-- Funcoes de TRIGGER tem EXECUTE concedido a PUBLIC por padrao -> revogar de PUBLIC
-- (revogar so de anon/authenticated nao adianta). Triggers seguem funcionando.
do $harden$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prorettype = 'pg_catalog.trigger'::regtype
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
  end loop;
end $harden$;
