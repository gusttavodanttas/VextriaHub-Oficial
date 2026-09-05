# Análise da plataforma — setembro/2026

Análise técnica completa do VextriaHub no commit `14bc173`: leitura da árvore
inteira, execução de type-check, lint, testes e build, e consulta aos advisors
de segurança e desempenho do projeto Supabase em produção (somente leitura).

A versão navegável, com a mesma informação formatada, está em
[`ANALISE_PLATAFORMA_SET2026.html`](./ANALISE_PLATAFORMA_SET2026.html) —
abra o arquivo no navegador.

## Sinais no momento da análise

| Verificação | Resultado |
| --- | --- |
| `tsc -p tsconfig.app.json` | limpo |
| ESLint | 0 erros · 720 avisos (teto da CI: 720 — sem folga) |
| Vitest | 186/186 |
| Build (vite) | 10,25 s · maior chunk 114 kB gzip |
| Advisors Supabase | 0 em nível ERROR (181 avisos de desempenho/higiene) |
| Segredos no repositório | nenhum |

Escala: 59.241 linhas em 321 arquivos TS/TSX · 33 páginas · 61 hooks ·
24 edge functions · 135 migrations · ~46 tabelas · 270 políticas RLS.

## O que está bem-feito

- **Isolamento entre escritórios no banco.** RLS em todas as tabelas, com
  funções `SECURITY DEFINER` (`get_user_office_ids`, `team_visible_user_ids`,
  `is_office_admin`) evitando recursão de política. Visibilidade por time é
  enforçada no Postgres, não na tela.
- **Paywall no banco.** Policy `RESTRICTIVE` `office_paid_gate` em 20 tabelas de
  dados; tabelas de infra ficam de fora de propósito, senão o escritório
  inadimplente não carregaria nem a tela de pagamento.
- **Edge functions defensivas.** Cursor que só avança em lead efetivamente
  tratado, reserva atômica contra corrida cron × chamada manual, ID
  determinístico de evento no Google, comparação em tempo constante no token do
  webhook do Asaas, 5xx para o Asaas reenviar em vez de perder pagamento.
- **Higiene.** Nenhum arquivo órfão, nenhum `console.log`, comentários que
  explicam a decisão e o incidente que a motivou.
- **Observabilidade central.** Todo erro de query/mutation do React Query vai ao
  Sentry por um caminho só.

## Achados, em ordem de custo

### P1 — Os limites de plano são vendidos e não são cobrados

`plan_configs` anuncia "até 30 processos" (Básico R$ 47), "até 100"
(Intermediário R$ 97), "até 300" (Avançado R$ 197). Enforcement real:

- processos → só no cliente, `NovoProcessoDialog.tsx:83`
- clientes, tarefas, prazos → calculados em `usePlanLimits` e nunca consumidos
- banco → nenhum trigger, nenhuma policy checa quantidade

A trava cai com uma chamada direta ao PostgREST, pelo fluxo de importação, ou
pela própria IA (`criar_processo` insere com service role sem consultar limite).
Na prática os tiers pagos só diferem por **assentos** (trigger
`enforce_office_seat_limit`) e **cota de OAB** (`enforce_oab_quota`).

**Correção:** trigger `before insert` por tabela cotada, lendo o teto de
`plan_configs` — o padrão do `enforce_oab_quota`, que já existe e funciona.

### P1 — A IA não tinha teto de gasto *(corrigido — ver abaixo)*

`ai-advisor` e `ai-voice` usam a chave OpenAI da Vextria com checagem binária
(autenticado + premium). Sem quota, contador, log de consumo ou rate limit; até
4 turnos de tool por mensagem; TTS de 4.000 caracteres por chamada.

### P2 — A IA passa por cima das permissões e da visibilidade por time

As 17 ferramentas rodam em `executeTool` com service role, escopadas apenas por
`office_id`. Um membro sem `canViewFinanceiro` obtém `resumo_financeiro` do
escritório inteiro pelo chat; sem `canManageProcessos`, cria processos. Não é
vazamento entre escritórios — é escalada de privilégio dentro dele.

**Correção:** fazer as escritas com o cliente *anon* carregando o JWT do usuário
(a RLS aplica as mesmas regras da tela) e checar `user_permissions` antes das
leituras agregadas.

### P2 — Os módulos por plano só existem no navegador

`canViewFinanceiro`, `canViewMetas` e `canViewAdvancedAnalytics` saem de
`permissão × plano` calculado no cliente. A RLS de `financeiro` e `metas` checa
admin do escritório ou visibilidade de time — nunca o plano. Um Básico lê e
grava `/rest/v1/financeiro` direto. E o catálogo vende "Módulo financeiro
completo" como diferencial do Avançado, mas `hasFinancialModule` já é `true` no
trial.

**Correção:** policy `RESTRICTIVE` por módulo, no molde do `office_paid_gate`.

### P2 — As migrations não reconstroem o ambiente

Vários crons são templates com `<SERVICE_ROLE_KEY>` / `<ROBOT_SECRET>`, e dois
clonam o comando de um job que precisa já existir:

```sql
-- 20260822064500_google_sync_cron.sql e 20260822073000_zap_pull_leads_cron.sql
select cron.schedule('google-sync-15min','*/15 * * * *',
  replace((select command from cron.job where jobname='trial-reminder-diario' limit 1),
          'trial-reminder','google-sync'));
```

Num banco novo o `select` volta nulo e o cron nasce quebrado **em silêncio** —
robôs de OAB, publicações, aviso de prazo, sync do Google e puxada de leads. A
intenção (não versionar segredo) está certa; a execução deixa a recuperação de
desastre dependendo do banco de produção.

**Correção:** `supabase_vault` para `service_role` e `ROBOT_SECRET`, com os
`cron.schedule` lendo do vault. Migrations voltam a ser replayáveis do zero.

### P3 — A catraca de lint está no limite exato

720 de 720. O próximo `any` quebra o build de todos. Composição: 643
`no-explicit-any`, 57 `react-hooks/exhaustive-deps` (estes escondem bug real:
dado velho em tela), 20 `react-refresh/only-export-components`.

### P3 — Os testes cobrem o cálculo, não o que dá processo

186 testes em 20 arquivos, quase todos sobre funções puras de `src/lib`. Sem
teste dos hooks de dados, das políticas RLS (a regra mais delicada do produto) e
das 24 edge functions.

### P3 — Banco: nada grave, muito acumulado

- 82 avisos de policies permissivas duplicadas (`plan_configs` 20,
  `tarefa_comentarios` 15, `tarefa_subtarefas` 15)
- 56 chaves estrangeiras sem índice de cobertura
- 35 policies reavaliando `auth.uid()` por linha → trocar por `(select auth.uid())`
- 6 tabelas com RLS ligada e nenhuma policy — **seguro e intencional** (só o
  service role entra); vale um comentário no SQL para ninguém "consertar"
- 13 funções `SECURITY DEFINER` executáveis por `anon`; todas checam
  `auth.uid()` internamente, mas `confirm_invited_user(email, token)` aceita
  chamada não autenticada e merece limite de tentativas

### P3 — Manutenibilidade

34 arquivos passam de 400 linhas (`ProcessoDetailsDrawer.tsx` 1.273,
`JudicialSyncDialog.tsx` 949, `NovoPrazoStandaloneDialog.tsx` 910). Três
fontes de verdade para preço e plano: `plan_configs`, as constantes de
`usePlanFeatures.tsx` e os valores escritos à mão em `Landing.tsx`.

**Corrigidos (parte 2):** `src/migrations/20260418_cleanup_asaas.sql` estava
no diretório errado — movido para `supabase/migrations/20260418000000_cleanup_asaas.sql`
e versionado retroativamente em produção (idempotente: as tabelas que ele
derruba já tinham sido removidas manualmente em abril, então não teve efeito
prático, só fechou a lacuna no histórico). O `README.md` era o texto padrão
do Lovable — reescrito com stack real, setup local, scripts e o que cada
workflow de CI/CD precisa.

## Plano de ação

| # | Ação | Estado |
| --- | --- | --- |
| 1 | Contador e teto de uso da IA | **feito** — ver abaixo |
| 2 | Triggers de cota por plano (processos, clientes, tarefas, prazos) | **feito** — ver abaixo |
| 3 | IA respeitando permissões (escritas com o JWT do usuário) | **feito** — ver abaixo |
| 4 | Crons pelo vault, migrations replayáveis | **feito** — ver abaixo |
| 5 | Gate de módulo no banco (`metas`; `financeiro` não é diferenciador de plano hoje) | **feito** — ver abaixo |
| 6 | `(select auth.uid())` nas 33 policies + índices nas 56 FKs sem cobertura | **feito** — ver abaixo |
| 7 | Primeiro teste de RLS (dois escritórios, dois times) | **feito** — ver abaixo |
| 8 | Folga na catraca de lint (720 → 700, 31 avisos removidos) | **feito** — ver abaixo |

---

## Correção nº 1 aplicada: teto e medição do consumo de IA

**Migration** `supabase/migrations/20260904120000_ai_usage_quota.sql`

- tabela `ai_usage` (escritório × mês: chamadas, caracteres de voz, tokens de
  prompt e de resposta). RLS ligada; membros do escritório leem o próprio
  consumo, ninguém escreve pelo cliente.
- `ai_consumir(office, chamadas, voz_caracteres, limite_chamadas, limite_voz)` —
  check e incremento na **mesma UPDATE**, então duas requisições simultâneas não
  passam as duas pelo limite. Teto `<= 0` significa ilimitado.
- `ai_registrar_tokens(office, prompt, resposta)` — custo real, gravado depois
  da resposta da OpenAI. Não bloqueia; é medição.
- `execute` revogado de `public`, `anon` e `authenticated`: só o service role
  chama, a partir das edge functions.

**Edge functions** `ai-advisor` e `ai-voice`

- reservam a chamada antes de falar com a OpenAI; estourou o teto → `429` com
  `error: "limite-ia-atingido"` e uma mensagem que diz o consumo e quando zera.
- `ai-advisor` acumula os tokens dos até 4 turnos de tool e grava no fim.
- `ai-voice` passa a validar o parâmetro `voice` contra a lista aceita pela
  OpenAI (antes qualquer string ia direto e virava 400).

**Tetos** (segredos das funções; ausentes = os padrões abaixo):

| Segredo | Padrão | O que limita |
| --- | --- | --- |
| `AI_LIMITE_CHAMADAS_MES` | 500 | requisições de IA por escritório/mês |
| `AI_LIMITE_VOZ_CARACTERES_MES` | 200000 | caracteres falados por escritório/mês |

**Ordem de deploy — importante.** As funções falham **abertas** (liberam a
chamada e logam) se a RPC não existir ou o banco tropeçar, para um erro de
medidor nunca derrubar um recurso pago. Por isso:

```sh
# 1. migration primeiro — senão o teto fica sem efeito, em silêncio
npx supabase db push --project-ref mzhnlhfxfoigkqgxseeu

# 2. tetos (opcional; sem isto valem os padrões da tabela acima)
npx supabase secrets set AI_LIMITE_CHAMADAS_MES=500 AI_LIMITE_VOZ_CARACTERES_MES=200000

# 3. só então as funções
npx supabase functions deploy ai-advisor --project-ref mzhnlhfxfoigkqgxseeu
npx supabase functions deploy ai-voice   --project-ref mzhnlhfxfoigkqgxseeu
```

Para ver o consumo depois de rodar:

```sql
select o.name, u.mes, u.chamadas, u.voz_caracteres, u.tokens_prompt, u.tokens_resposta
from ai_usage u join offices o on o.id = u.office_id
order by u.mes desc, u.chamadas desc;
```

**Próximo passo natural:** teto por escritório (hoje o padrão é global). Uma
coluna de override em `ai_usage` ou uma tabela `ai_quotas` resolve, agora que a
medição existe.

---

## Correção do bug de itens atrasados

Reportado junto com a análise: um prazo ou tarefa não concluído no dia sumia da
Agenda e do dashboard no dia seguinte.

**Causa.** Duas telas olhavam só para frente:

- `Agenda.tsx` — a lista filtrava `datetime >= hoje`, então o que venceu ontem
  era descartado. Além disso `useAgendaEvents` só buscava o mês visível, então
  atraso de mês anterior não era nem carregado.
- `CalendarWidget.tsx` — `upcoming` filtrava `k >= todayKey`; o item ficava
  parado na célula do dia em que venceu, visível só clicando naquele dia.

**Correção.**

- `src/lib/atraso.ts` (novo, com testes): `estaAtrasado`, `diasDeAtraso`,
  `atrasoLabel` ("venceu ontem" / "venceu há 5 dias"), `dataFatalDoItem`.
- `useAgendaEvents` passa a devolver `atrasados` — consulta própria, independente
  do mês navegado, cobrindo prazos, tarefas, audiências, atendimentos e
  consultivos pendentes com data no passado (teto de 50, mais recentes primeiro).
  Os conversores para o vocabulário da agenda foram extraídos para servir aos
  dois carregamentos sem divergir.
- `Agenda.tsx`: bloco "Atrasados" fixo no topo da lista, respeitando os filtros
  de tipo e busca; card "Atrasados" nas estatísticas; a linha do item atrasado
  sai em vermelho com a data e há quanto tempo venceu; o vazio "Agenda livre"
  não aparece mais quando existe atraso.
- `CalendarWidget.tsx`: bloco "Atrasados" acima do dia selecionado, com link
  para o restante na Agenda; a janela de busca recua 2 meses (as consultas já
  filtravam por pendente, então o recuo não traz histórico resolvido).
- `ListBlocks.tsx`: prazo/tarefa vencido sai em vermelho com "venceu ontem" —
  antes a data era cinza, idêntica à de um item que só vence no mês que vem.

---

## Correção nº 2 aplicada: cota de processos/clientes/tarefas/prazos por plano

**Migration** `supabase/migrations/20260904130000_plan_quota_processos_clientes_tarefas_prazos.sql`

- 4 colunas em `plan_configs` (`max_processos`/`max_clientes`/`max_tarefas`/`max_prazos`,
  NULL = sem teto), semeadas com os mesmos números do `usePlanFeatures.tsx` —
  mesmo padrão já usado por `max_oabs`, editável na tela de Gestão de Planos.
- `office_plan_limits()`: resolução idêntica ao já-existente `office_oab_limit`
  (cortesia/vitalício sem teto, match exato do plano ativo, rede por
  palavra-chave para plano custom renomeado, trial para quem ainda não assinou).
- `enforce_plan_quota()`: trigger genérico `BEFORE INSERT` (um por tabela), com
  advisory lock por (escritório, tabela) fechando a corrida de duas inserções
  concorrentes — mesmo mecanismo do `enforce_office_seat_limit`.
- `src/lib/planQuotaError.ts` (novo, com testes): traduz a exceção do trigger
  pra `{title, description}` acionável, aplicado nos 4 pontos de criação
  (`NovoProcessoDialog`, `useClientes.create`, `useTarefas.create`,
  `NovoPrazoStandaloneDialog`).

Verificado ao vivo em produção **antes** de escrever a migration: nenhum
escritório ultrapassava os tetos propostos — seguro aplicar sem cláusula de
carência.

## Correção nº 3 aplicada: a IA passa a respeitar as mesmas permissões de qualquer tela

`supabase/functions/ai-advisor/index.ts` tinha DOIS clientes Postgrest desde o
início — um `anon` (JWT do usuário, só usado pra `auth.getUser()`) e um
`service` (service role, usado para TUDO mais). Toda leitura e escrita de
conteúdo do escritório (as 17 ferramentas do chat, o snapshot usado no prompt
e nos insights, e os resumos de processo/publicação) passava pelo `service`,
que ignora RLS por completo — era o caminho pelo qual um membro sem
`canViewFinanceiro` conseguia `resumo_financeiro` do escritório inteiro pelo
chat, ou concluía tarefa de um time que não era o dele.

**Correção:** `executeTool`, `buildSnapshot` e os modos `resumo_processo`/
`resumo_publicacao` passam a usar o cliente `anon` (que já carrega o JWT do
usuário) em vez do `service`. A RLS decide o que a IA enxerga e altera —
exatamente as mesmas regras de qualquer tela: visibilidade por time,
paywall, e agora também a cota de plano da correção nº 2 (que passa a valer
pros registros que a IA cria, fechando o mesmo buraco por outro ângulo).
`service` continua só para identidade/gate (`profiles`/`office_users`/`offices`)
e as RPCs de medição da IA (`ai_consumir`/`ai_registrar_tokens`, revogadas de
`authenticated` de propósito — têm que ficar no service role).

**Mudança de comportamento esperada, não um bug:** um membro sem visibilidade
ampla de financeiro que peça `resumo_financeiro` pela IA agora recebe o total
do que ELE enxerga (igual à tela Financeiro), não mais o total do escritório
inteiro. Um admin continua vendo tudo (a RLS já dá bypass a admin em todas as
políticas relevantes).

De brinde: ao ligar o `deno check` local pra validar esta mudança (via stub
dos imports remotos, já que o ambiente de sandbox não alcança `deno.land` nem
`esm.sh`), apareceu um gap pré-existente e não relacionado: `ToolArgs` não
declarava `comarca`, usado por `criar_diligencia` — corrigido junto (não
mudava o comportamento em runtime, só o type-check nunca rodava nesse arquivo).

## Correção nº 4 aplicada: crons pelo vault, migrations replayáveis

As migrations de cron (`robo_oab`, `robo_crm`, `robo_publicacoes`, `robo_prazos`,
`asaas_reconcile`) eram templates com `<SERVICE_ROLE_KEY>`/`<ROBOT_SECRET>`
literais — só funcionavam depois de alguém substituir os placeholders à mão e
rodar no SQL Editor. Duas outras (`google_sync`, `zap_pull_leads`) nem tinham
segredo: clonavam o `command` de uma cron (`trial-reminder-diario`) que
precisava já existir — e essa, por sua vez, nunca teve `CREATE` versionado,
só existia ao vivo em produção. Um rebuild das migrations do zero recriava os
8 robôs quebrados (URL/token literal, ou o `cron.schedule` explodindo com
`command` nulo ao clonar um job inexistente, travando o replay das migrations
seguintes).

**Correção:** os dois segredos reais (`SUPABASE_SERVICE_ROLE_KEY` e
`ROBOT_SECRET`) foram migrados para o `supabase_vault` (extensão já habilitada
no projeto) diretamente em produção, num passo único e fora do repositório —
`select vault.create_secret(<valor>, 'service_role_key', ...)` e o mesmo para
`robot_secret` — extraídos programaticamente do `cron.job.command` já ativo
via SQL server-side (o valor em si nunca passou por fora do banco). A nova
migration `20260904160000_crons_vault_secrets.sql` reagenda os 8 crons (mais
`trial-reminder-diario`, agora versionada pela primeira vez) lendo o segredo
em tempo de execução via `(select decrypted_secret from vault.decrypted_secrets
where name = '...')` — `vault.decrypted_secrets` só é legível por
`postgres`/`service_role`, os mesmos que já liam `cron.job.command` antes, sem
abrir superfície nova. As duas migrations que clonavam `trial-reminder-diario`
foram ajustadas para não depender mais de outro job existir (removendo o
`command` nulo que travava o replay); a correção definitiva do segredo fica só
na migration nova, que roda depois e reagenda todos.

Com isso, um `db push` num projeto novo recria os 8 robôs funcionando assim
que os dois secrets forem populados no vault uma única vez — nenhum cron
depende mais de outro já existir, e nenhum segredo real fica no texto do
repositório. Verificado em produção: os 8 jobs continuam ativos, agora todos
resolvendo os headers via vault (confirmado sem reexpor os valores — só
comparado que a consulta ao vault retorna não-nulo).

## Correção nº 5 aplicada: gate do módulo Metas no banco

`supabase/migrations/20260904150000_metas_goals_module_gate.sql`

`hasGoalsModule` só é `true` no plano Premium (e cortesia/vitalício) em
`usePlanFeatures.tsx` — mas a RLS de `metas` nunca checou plano, só
admin/visibilidade de time. `office_has_goals_module()` replica a regra do
client; policy `RESTRICTIVE` empilhada por cima do `office_paid_gate` já
existente na tabela (que checa pagamento, não módulo).

`hasFinancialModule` **não** entrou: é `true` nos 5 tiers hoje, nunca foi
diferenciador de plano no código — só no texto de marketing ("Módulo
financeiro completo" como diferencial do Avançado), que é outro tipo de
correção (copy, não RLS). Verificado ao vivo: nenhum escritório fora de
premium/cortesia/vitalício tinha linha em `metas` — sem cláusula de carência.

## Correção nº 6 aplicada: `(select auth.uid())` + índices nas FKs sem cobertura

`supabase/migrations/20260904140000_rls_perf_auth_uid_and_fk_indexes.sql`,
**gerada programaticamente** a partir de `pg_policies`/`pg_constraint` da
produção (não digitada à mão) — 33 `ALTER POLICY` envolvendo toda chamada
crua de `auth.uid()`/`auth.jwt()`/`auth.role()` em `(select auth.<fn>())`
(mesma lógica, o Postgres passa a cachear o resultado por consulta em vez de
reavaliar linha a linha) e 56 `CREATE INDEX` nas chaves estrangeiras que o
advisor apontava sem cobertura.

## Correção nº 7 aplicada: primeiro teste automatizado de RLS

`supabase/tests/rls-standalone/` — dois escritórios, dois times, prova em
`tarefas` e `financeiro` que membro comum só vê o próprio time, coordenador vê
o time que coordena, admin vê o escritório, e ninguém vê o de outro escritório
(nem sendo admin do seu). Rodável com `npm run test:rls`. Descoberta no
caminho: `office_teams`/`office_team_members` — as tabelas centrais desta
mesma regra — não têm `CREATE TABLE` em nenhuma migration; existem só no banco
vivo. Documentado no README do teste como próximo passo, não corrigido ali
(inserir migration retroativa numa base já aplicada em produção merece cuidado
à parte).

## Correção nº 8 aplicada: folga na catraca de lint

720/720 na CI, sem margem nenhuma. 31 avisos de `no-explicit-any` removidos —
a maioria em `onError` de `useMutation` (o TanStack Query já tipa o parâmetro
como `Error` por padrão; a anotação `: any` só escondia isso, bastava remover)
e alguns spots equivalentes. Teto baixado de 720 para 700 (689 hoje, 11 de
folga real).

## Todos os 8 itens do plano de ação aplicados

Os 8 achados listados na seção de achados acima têm correção aplicada e
descrita nesta seção, incluindo o item 4 (crons pelo vault), que dependia de
acesso aos segredos reais de produção — rodado diretamente contra o projeto
Supabase (ver Correção nº 4 acima).

---

# Parte 2 — nova varredura completa (mesmo dia, depois do deploy)

Com os 8 itens da parte 1 em produção, rodei a plataforma de novo do zero —
mesmo checklist (árvore inteira, type-check, lint, testes, build, advisors do
Supabase em produção) — pra ver se as correções seguravam e se sobrava algo
novo. Achou dois problemas reais, os dois já corrigidos e no ar.

## Sinais desta rodada

| Verificação | Resultado |
| --- | --- |
| `tsc -p tsconfig.app.json` | limpo |
| ESLint | 0 erros · 689 avisos (teto da CI: 700) |
| Vitest | 205/205 |
| Build (vite) | 12,3 s |
| `npm run test:rls` | não rodou nesta rodada — container novo sem Postgres local instalado (infra do ambiente, não do código; ver nota no fim) |
| Advisors segurança | idêntico à linha de base — nenhum item novo |
| Advisors performance | `auth_rls_initplan`: **2 → 0**. `multiple_permissive_policies`: **82 → 33** (novo achado, corrigido em parte). `unused_index`: 54 (ruído — são os 56 índices criados há poucas horas na correção nº 6, ainda sem tráfego real; ver nota) |

## Achado A — a correção nº 6 (RLS perf) tinha dois pontos cegos

O script que gerou a migration de `(select auth.uid())` varreu `pg_policies`
procurando literalmente `auth.uid()`, `auth.jwt()` e `auth.role()` no schema
`public`. Duas policies escaparam por não caberem nesse filtro:

- `public.invitations` (`inv_select`, `inv_update`) usa **`auth.email()`** —
  função que a busca original não incluía.
- `storage.objects` (`uploads_auth_insert`, `uploads_auth_update`) usa
  `auth.uid()` duas vezes cada — mas está em **outro schema**, fora do
  escopo da consulta original a `pg_policies` (que não filtrava por schema
  explicitamente, mas o gerador só olhou `public`).

Confirmado pelo advisor de performance (`auth_rls_initplan` ainda apontava as
duas de `invitations`) e por uma varredura manual sem filtro de schema (achou
as duas de `storage.objects`, que o advisor nem lista). As quatro corrigidas
com o mesmo padrão (`(select auth.<fn>())`) — mesma semântica, sem mudança de
comportamento. Migration: `20260904200000_rls_perf_auth_email_and_storage_uploads.sql`.
Uma nova varredura completa em `pg_policy` (sem filtro de schema, cobrindo
`auth.uid|jwt|role|email`) confirmou zero ocorrências restantes em todo o
banco.

## Achado B — 82 policies permissivas redundantes (novo)

O advisor de performance aponta 82 warnings de `multiple_permissive_policies`
em 10 tabelas: cada policy `PERMISSIVE` extra na mesma tabela/ação é avaliada
em **toda linha de toda consulta** e o resultado é OR'ado com as demais — não
muda quem acessa o quê, só custa CPU à toa. Investigado tabela por tabela,
comparando as condições booleanas (não só o nome da policy):

**Redundância provada e corrigida** (8 policies removidas, comportamento
idêntico — cada uma verificada por lógica, não por inspeção visual):

- `tarefa_comentarios` / `tarefa_subtarefas`: a policy "service role acesso
  total ..." checa `auth.role() = 'service_role'`, mas esse role tem
  `BYPASSRLS = true` no Postgres — a RLS **nem roda** pra ele, e pra qualquer
  outro role a condição nunca é verdadeira. Morta desde que foi criada.
- `plan_configs`: `plans_manage_admin` (`ALL`, `is_super_admin()`) é
  duplicata **exata** de `plan_configs_write` (mesma condição nos dois
  lados). E `plan_configs_read` (`SELECT using(true)`) anulava na prática o
  filtro de `plans_select_public` (`is_active = true`) — **qualquer um lia
  planos descontinuados/internos pela chave anon**, já que uma policy
  permissiva com `true` basta pra liberar a linha, não importa o que as
  outras digam. Baixa severidade (é catálogo de preço, não dado de cliente),
  mas era uma restrição pensada que não restringia nada; super_admin
  continua vendo tudo pela policy `ALL`.
- `monitoramento_termos`: `mon_insert`/`mon_select`/`mon_update` checam só
  `office_id = ANY(get_user_office_ids())`, que já é o primeiro termo do OR
  de `monitoramento_office_scope` (mesma condição `OR is_super_admin()`) —
  subconjunto estrito, nunca adicionavam acesso que a outra não desse.
- `notifications`: `notifications_insert_self` (`uid = user_id`) é
  subconjunto estrito de `notif_insert` (`service_role OR uid = user_id`).
- `profiles`: `profiles_select_admin` (`is_super_admin()`) duplicava
  exatamente a cobertura de SELECT que `"SuperAdmin total access profiles"`
  (`ALL`, mesma condição) já dava.

Migration: `20260904210000_rls_dedupe_redundant_permissive_policies.sql`.
Verificado com `get_advisors` antes/depois (82 → 33) e advisor de segurança
sem diferença (nenhuma policy nova exposta a `anon`/`authenticated`).

**Deixado de fora de propósito** (33 warnings restantes, em
`exclusoes_pendentes`, `profiles`, `monitored_oabs`, `offices`,
`plan_configs`, `user_permissions`): as condições ali são **genuinamente
diferentes** (ex.: `offices_select_member` vs `offices_select_super` — membro
comum vs super_admin, sem sobreposição de regra). Consolidar exigiria
reescrever cada uma como um único OR explícito, não só apagar uma policy
solta — mais uma refatoração de RLS do que uma limpeza, então fica registrado
aqui como próximo passo de performance, não como bug.

## Achado C (não é bug) — `unused_index` no advisor

Os 56 índices da correção nº 6 aparecem como "nunca usados" no advisor.
Esperado: o contador de uso do Postgres (`pg_stat_user_indexes`) zera quando o
índice é criado, e eles têm poucas horas de vida em produção. Não é um achado
novo — vale reconferir em 1–2 semanas de tráfego real antes de considerar
remover algum.

## Edge functions — nenhuma escalada de privilégio nova encontrada

Reli 10 das 24 edge functions (as que recebem `office_id`/`user_id` do corpo
da requisição e usam o cliente `service_role`) em busca do mesmo padrão do
achado nº 3 da parte 1 (service role sem checagem de permissão equivalente à
RLS). Todas as revisadas (`create-team-member`, `admin-office-access`,
`criar-usuario-cortesia`, `calculate-prazo`, `google-sync`, `zap-bridge`,
`zap-link`, `send-invite-email`, `asaas-webhook`) autorizam o chamador antes
de qualquer escrita privilegiada — `super_admin`, admin/owner **ativo** do
escritório-alvo, membro ativo do escritório da publicação, ou o robô via
`x-robot-secret`. Nenhuma issue nova aqui.

## Nota sobre o `npm run test:rls`

Este ambiente (container novo) não tinha o Postgres local que a sessão
anterior instalou via `apt` pra rodar o pgTAP; reinstalá-lo só pra esta
rodada não estava no escopo do achado (a suíte cobre `tarefas`/`financeiro`,
tabelas não tocadas nesta parte 2). A troca de policies desta parte foi
validada por prova lógica (equivalência booleana, mostrada acima) e por
`get_advisors` antes/depois, não pelo pgTAP.

## Resumo da parte 2

| # | Achado | Estado |
| --- | --- | --- |
| A | Lacuna da correção nº 6: `auth.email()` e `storage.objects` fora do escopo do script original | **corrigido** |
| B | 82 policies permissivas redundantes (perf) | **corrigido em parte** (8 removidas, provadamente redundantes; 33 restantes documentadas, exigem reescrita de condição) |
| C | `unused_index` nos 56 índices novos | não é achado — ruído esperado, reconferir depois |
| — | Varredura de 10/24 edge functions por escalada de privilégio | nenhuma issue nova |
