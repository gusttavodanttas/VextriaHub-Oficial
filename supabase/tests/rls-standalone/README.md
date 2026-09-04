# Teste de RLS: isolamento por time e por escritório

Primeiro teste automatizado da regra mais delicada do produto — quem enxerga
o quê entre times e entre escritórios — apontada como gap na análise de
set/2026 ("verificada só em produção").

## O que prova

Sobe dois escritórios (A e B) e, dentro do A, dois times (Time 1 com um
coordenador e um membro; Time 2 com um membro solto). Roda em `tarefas` e
`financeiro` — as duas tabelas core que usam `team_visible_user_ids`:

- membro comum só vê o que é seu (não vê o do outro time do **mesmo** escritório);
- coordenador vê tudo do time que coordena;
- admin do escritório vê tudo do próprio escritório;
- **ninguém de um escritório vê nada do outro — nem sendo admin do seu**;
- UPDATE/DELETE/INSERT também são barrados pela mesma regra (não só SELECT).

13 asserções (`supabase/tests/rls-standalone/team_visibility.test.sql`).
Validado com um controle negativo: trocar a policy de `tarefas_select` por
`using (true)` faz os testes de isolamento (2 e 5) falharem corretamente —
o teste pega a regressão, não é só um exercício tautológico.

## Por que não é `supabase test db`

O caminho idiomático do Supabase CLI sobe o stack local inteiro via Docker
(Postgres + GoTrue + PostgREST + Studio…) e roda contra o schema REAL depois
de aplicar todas as migrations. Tentei esse caminho primeiro; o pull das
imagens Docker falha em ambientes com rede restrita (foi o caso do sandbox
onde isto foi escrito), então não é garantido que rode em todo lugar,
CI incluído, sem uma imagem de Postgres própria ou acesso de rede irrestrito.

No processo também descobri que **`office_teams` e `office_team_members` —
as duas tabelas centrais da visibilidade por time — não têm `CREATE TABLE`
em nenhuma migration**; existem só no banco vivo. Um replay das migrations do
zero quebraria bem antes de chegar aqui. É o mesmo achado "migrations não
reconstroem o ambiente" da análise de set/2026, agora com um exemplo
concreto — vale uma migration própria depois (não faço aqui: inserir um
`CREATE TABLE` com timestamp retroativo numa migration já aplicada em
produção merece cuidado à parte).

Por isso este teste usa um **schema mínimo e autocontido** — só as tabelas e
funções que `tarefas_select`/`financeiro_select` realmente tocam, com colunas
e corpos de função **copiados verbatim** da produção (via
`information_schema` e das próprias migrations, nunca reinventados) — em vez
de depender do stack completo ou das 135 migrations. `fixture.sql` documenta
essa escolha em detalhe.

Consequência prática: se alguém mudar a lógica de `team_visible_user_ids`,
`is_office_admin` ou as policies de `tarefas`/`financeiro` na migration real
e não atualizar `fixture.sql`, este teste passa a validar uma versão
desatualizada da regra sem avisar. Não é um substituto de rodar contra o
banco real — é o primeiro degrau, bem melhor que nenhum teste.

## Como rodar

```sh
# Ubuntu/Debian — instala Postgres + pgtap uma vez
sudo apt-get install -y postgresql-16 postgresql-16-pgtap libtap-parser-sourcehandler-pgtap-perl
sudo service postgresql start

./supabase/tests/rls-standalone/run.sh
```

O script cria um banco descartável (`rls_standalone_test_<pid>`), carrega
`fixture.sql`, roda os `*.test.sql` com `pg_prove` (ou `psql` puro se
`pg_prove` não estiver instalado) e derruba o banco ao final — não deixa
rastro nem toca no projeto Supabase real.

## Próximo passo natural

Migrar `office_teams`/`office_team_members` para uma migration de verdade
(fecha o gap descrito acima) e então trocar este fixture por um replay real
de `supabase/migrations/*.sql` — quando o ambiente de CI tiver acesso de rede
para `supabase start`, ou uma imagem Postgres com as extensões certas
pré-instaladas.
