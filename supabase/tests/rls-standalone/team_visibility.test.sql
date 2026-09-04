-- Cenário: 2 escritórios, 2 times no escritório A. Prova que:
--  - membro comum só vê o do PRÓPRIO time (não o do outro time do MESMO escritório)
--  - coordenador vê tudo do time que coordena
--  - admin do escritório vê tudo do escritório
--  - ninguém de um escritório vê nada do outro, nem sendo admin do seu
-- Roda em tarefas E financeiro — as duas tabelas core que usam team_visible_user_ids.
begin;
select plan(13);

-- ── Massa de dados ───────────────────────────────────────────────────────
insert into offices (id) values
  ('a0000000-0000-0000-0000-00000000000a'),
  ('b0000000-0000-0000-0000-00000000000b');

-- Escritório A: admin + time 1 (coordenador + membro) + time 2 (membro solto)
insert into office_users (office_id, user_id, role, active) values
  ('a0000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001', 'admin', true), -- AdminA
  ('a0000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000002', 'user',  true), -- Coord1
  ('a0000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000003', 'user',  true), -- Membro1 (time 1)
  ('a0000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000004', 'user',  true); -- Membro2 (time 2)

insert into office_teams (id, office_id, name) values
  ('aa000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 'Time 1'),
  ('aa000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-00000000000a', 'Time 2');

insert into office_team_members (team_id, user_id, office_id, role) values
  ('aa000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-00000000000a', 'coordinator'), -- Coord1 coordena Time 1
  ('aa000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-00000000000a', 'member'),      -- Membro1 no Time 1
  ('aa000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-00000000000a', 'member');       -- Membro2 no Time 2

-- Escritório B: admin próprio, sem nenhuma relação com A
insert into office_users (office_id, user_id, role, active) values
  ('b0000000-0000-0000-0000-00000000000b', '20000000-0000-0000-0000-000000000001', 'admin', true); -- AdminB

-- Membro1 (Time 1) cria uma tarefa e um lançamento financeiro pra si mesmo
insert into tarefas (office_id, user_id, responsavel_id, titulo) values
  ('a0000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', 'Tarefa do Membro1');
insert into financeiro (office_id, user_id, descricao) values
  ('a0000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000003', 'Lançamento do Membro1');

-- ── Helper: troca de identidade dentro da MESMA transação do teste ─────────
create or replace function _como(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', p_user::text, true);
$$;

set local role authenticated;

-- ── TAREFAS ─────────────────────────────────────────────────────────────
select _como('10000000-0000-0000-0000-000000000003'); -- Membro1 (dono)
select is(count(*)::int, 1, 'Membro1 ve a propria tarefa') from tarefas;

select _como('10000000-0000-0000-0000-000000000004'); -- Membro2, MESMO escritorio, OUTRO time
select is(count(*)::int, 0, 'Membro2 (outro time, mesmo escritorio) NAO ve a tarefa do Time 1') from tarefas;

select _como('10000000-0000-0000-0000-000000000002'); -- Coord1, coordena o Time 1
select is(count(*)::int, 1, 'Coordenador do Time 1 ve a tarefa de quem ele coordena') from tarefas;

select _como('10000000-0000-0000-0000-000000000001'); -- AdminA
select is(count(*)::int, 1, 'Admin do escritorio ve a tarefa de qualquer time do proprio escritorio') from tarefas;

select _como('20000000-0000-0000-0000-000000000001'); -- AdminB, OUTRO escritorio
select is(count(*)::int, 0, 'Admin de OUTRO escritorio nao ve NADA do escritorio A, nem sendo admin do seu') from tarefas;

-- Membro2 não consegue nem UPDATE nem DELETE na tarefa que não enxerga.
-- Verificação troca pra AdminA: consultar "como Membro2" seria tautológico —
-- ele já não enxerga a linha nem pra SELECT (prova disso é o teste 2), então
-- "sumiu pra ele" não prova que a escrita foi bloqueada de verdade.
select _como('10000000-0000-0000-0000-000000000004');
update tarefas set titulo = 'hackeado' where titulo = 'Tarefa do Membro1';

select _como('10000000-0000-0000-0000-000000000001'); -- AdminA verifica
select is(
  (select titulo from tarefas where user_id = '10000000-0000-0000-0000-000000000003'::uuid),
  'Tarefa do Membro1',
  'Membro2 tenta UPDATE na tarefa do Time 1: a policy filtra a linha, titulo continua intacto'
);

select _como('10000000-0000-0000-0000-000000000004');
delete from tarefas where user_id = '10000000-0000-0000-0000-000000000003'::uuid;

select _como('10000000-0000-0000-0000-000000000001'); -- AdminA verifica
select is(count(*)::int, 1, 'Membro2 tenta DELETE na tarefa do Time 1: a policy filtra a linha, ela continua existindo') from tarefas;

-- Membro2 não consegue INSERT tarefa se FINGINDO ser outro user_id
select throws_ok(
  $$ insert into tarefas (office_id, user_id) values ('a0000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000003') $$,
  null,
  'Membro2 NAO consegue inserir tarefa em nome de outro usuario (with check user_id = auth.uid())'
);

-- ── FINANCEIRO (mesma bateria, política um pouco diferente: sem COALESCE) ──
select _como('10000000-0000-0000-0000-000000000003'); -- Membro1 (dono)
select is(count(*)::int, 1, 'Membro1 ve o proprio lancamento financeiro') from financeiro;

select _como('10000000-0000-0000-0000-000000000004'); -- Membro2, outro time
select is(count(*)::int, 0, 'Membro2 (outro time) NAO ve o financeiro do Time 1') from financeiro;

select _como('10000000-0000-0000-0000-000000000002'); -- Coord1
select is(count(*)::int, 1, 'Coordenador do Time 1 ve o financeiro de quem ele coordena') from financeiro;

select _como('10000000-0000-0000-0000-000000000001'); -- AdminA
select is(count(*)::int, 1, 'Admin do escritorio ve o financeiro do proprio escritorio') from financeiro;

select _como('20000000-0000-0000-0000-000000000001'); -- AdminB
select is(count(*)::int, 0, 'Admin de OUTRO escritorio nao ve NADA do financeiro do escritorio A') from financeiro;

select * from finish();
rollback;
