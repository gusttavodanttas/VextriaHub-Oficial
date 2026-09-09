-- Achado 1 da rodada 2 da analise (docs/ANALISE_PLATAFORMA_SET2026.md, Parte 13):
-- delete_office() apagava dados do usuario em TODOS os escritorios dele, nao
-- so no que estava sendo excluido, e derrubava a conta de auth.users por
-- completo -- mesmo se o usuario continuasse membro ativo de outro escritorio.
-- O schema ja permite isso (office_users tem UNIQUE(office_id, user_id), nao
-- UNIQUE(user_id)), so que hoje nenhum usuario real esta em mais de um
-- escritorio ativo (confirmado via query) -- bug latente, nao incidente ja
-- ocorrido.
--
-- Causa: a funcao tinha 2 loops. O 1o apaga por office_id (correto, sempre
-- foi). O 2o apagava por user_id em QUALQUER tabela com essa coluna, sem
-- filtrar office_id -- inclusive em tabelas que TAMBEM tem office_id (ex.
-- timesheets, tarefas), vazando pra linhas de OUTRO escritorio do mesmo
-- usuario. Por fim apagava auth.users incondicionalmente pra todo membro do
-- escritorio alvo.
--
-- Correcao: calcula ANTES de qualquer delete quais usuarios ficam SEM
-- nenhuma outra vinculacao ativa em office_users depois que este escritorio
-- sumir (e nunca inclui super_admin global nessa lista, mesmo que tambem
-- seja membro do escritorio excluido) -- so esses "usuarios totalmente
-- removidos" tem: (a) linhas apagadas em tabelas que tem SOMENTE user_id
-- (sem office_id -- ja que as com office_id sao tratadas pelo 1o loop, sempre
-- com escopo por escritorio) e (b) a conta em auth.users removida. Um
-- usuario que continua em outro escritorio ativo mantem conta e dados
-- intactos.
--
-- Verificado com fixture Postgres descartavel (nao toca o projeto real):
-- cenario com usuario X (so no escritorio A, alvo da exclusao) e usuario Z
-- (A e B, ambos ativos) e um super_admin global que tambem e membro de A.
-- Apos excluir A: X perde conta e dados; Z mantem conta, mantem dado em B
-- intocado, mantem o vinculo com B; super_admin global nunca e apagado;
-- escritorio B e seus dados ficam intactos. Rodado tambem contra a funcao
-- ORIGINAL como controle negativo: falha exatamente nos 3 pontos acima
-- (apaga Z de auth.users, apaga o dado de Z em B, e ate apagaria o proprio
-- super_admin chamador caso ele fosse membro do escritorio excluido).

CREATE OR REPLACE FUNCTION public.delete_office(p_office_id uuid, p_confirm_name text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_caller_role text; v_office_name text; v_user_ids uuid[]; v_fully_removed_ids uuid[]; r record;
begin
  select role::text into v_caller_role from public.profiles where user_id = auth.uid();
  if v_caller_role is distinct from 'super_admin' then
    raise exception 'Apenas super_admin pode excluir escritório';
  end if;

  select name into v_office_name from public.offices where id = p_office_id;
  if v_office_name is null then raise exception 'Escritório não encontrado'; end if;
  if btrim(coalesce(p_confirm_name,'')) is distinct from btrim(v_office_name) then
    raise exception 'Confirmação incorreta: o nome não confere';
  end if;

  select coalesce(array_agg(distinct uid) filter (where uid is not null), array[]::uuid[])
    into v_user_ids
  from (select user_id as uid from public.office_users where office_id = p_office_id
        union select user_id from public.profiles where office_id = p_office_id) s;

  -- Usuarios que ficam SEM nenhuma outra vinculacao ativa apos este escritorio
  -- sumir (checado ANTES de qualquer delete, contra o estado real) -- so esses
  -- perdem dado fora do escopo de office_id e a conta de auth. Global
  -- super_admin nunca entra aqui, mesmo que tambem seja membro do office.
  if array_length(v_user_ids,1) > 0 then
    select coalesce(array_agg(uid), array[]::uuid[])
      into v_fully_removed_ids
    from unnest(v_user_ids) uid
    where not exists (
      select 1 from public.office_users ou
      where ou.user_id = uid and ou.active and ou.office_id <> p_office_id
    )
    and not exists (
      select 1 from public.profiles p where p.user_id = uid and p.role = 'super_admin'
    );
  end if;

  -- Apaga tudo que e' do escritorio (qualquer tabela com office_id, inclusive
  -- as que tambem tem user_id) -- nunca vaza pra outro office_id.
  for r in select table_name from information_schema.columns
           where table_schema='public' and column_name='office_id' and table_name <> 'offices' loop
    execute format('delete from public.%I where office_id = $1', r.table_name) using p_office_id;
  end loop;

  delete from public.offices where id = p_office_id;

  -- So pros usuarios que nao sobram em NENHUM outro escritorio: limpa o que
  -- resta (tabelas so-user_id, sem office_id -- as com office_id ja foram
  -- tratadas acima, sempre com escopo por escritorio) e a conta de auth.
  if array_length(v_fully_removed_ids,1) > 0 then
    for r in select table_name from information_schema.columns
             where table_schema='public' and column_name='user_id'
               and table_name not in (
                 select table_name from information_schema.columns
                 where table_schema='public' and column_name='office_id'
               ) loop
      execute format('delete from public.%I where user_id = any($1)', r.table_name) using v_fully_removed_ids;
    end loop;

    delete from auth.users where id = any(v_fully_removed_ids);
  end if;

  return jsonb_build_object('ok', true, 'office', v_office_name, 'users_removed', coalesce(array_length(v_fully_removed_ids,1),0));
end;
$function$;
