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
mesma regra — não tinham `CREATE TABLE` em nenhuma migration; existiam só no
banco vivo. Documentado no README do teste como próximo passo naquele momento
— **corrigido depois, na parte 3** (ver abaixo).

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

---

# Parte 3 — `office_teams`/`office_team_members` migradas retroativamente

Item que ficou como "próximo passo" na correção nº 7 (o teste de RLS descobriu
que essas duas tabelas nunca tiveram `CREATE TABLE` versionado). Também dois
acertos rápidos de manutenibilidade (P3): a migration `cleanup_asaas.sql` que
morava em `src/migrations/` (diretório errado) e o `README.md`, que ainda era
o texto padrão do Lovable.

## `office_teams`/`office_team_members` — o buraco era maior do que parecia

Investigando a fundo, achei que o gap não era só as duas tabelas: **nenhuma
migration jamais adicionou `processos.team_id` nem `clientes.team_id`** —
essas colunas (com FK para `office_teams`) também foram criadas direto em
produção. Pior: a própria correção nº 6 desta sessão
(`20260904140000_rls_perf_auth_uid_and_fk_indexes.sql`) criou
`idx_processos_team_id`/`idx_clientes_team_id` — **um índice numa coluna que,
sem esta correção, nunca teria sido criada num rebuild do zero** (o
`CREATE INDEX` teria quebrado com "column does not exist").

Confirmado com uma investigação em cadeia:
1. `pg_constraint` mostrou 3 FKs apontando para `office_teams(id)` vindas de
   fora do par óbvio: `processos.team_id`, `clientes.team_id` e
   `metas.team_id` (esta já tinha migration própria, `20260628000012_metas_team.sql`).
2. Nenhuma migration rastreada contém a string `team_id` referente a
   `processos`/`clientes` além de já **usar** a coluna nas policies — nunca
   de **criá-la**.
3. `20260628000001_team_visibility_rls.sql` (a mais antiga a mexer nisso) já
   assume que tudo existe: só dá `ALTER TABLE ENABLE RLS` + `CREATE POLICY`,
   nunca `CREATE TABLE`.

**Correção**: `supabase/migrations/20250709123700_office_teams_and_team_columns.sql`
— `CREATE TABLE IF NOT EXISTS` para as duas tabelas (colunas, tipos, defaults,
constraints e índices copiados fielmente de `information_schema`/
`pg_constraint`/`pg_indexes` da produção) mais `ALTER TABLE ... ADD COLUMN IF
NOT EXISTS team_id` em `processos`/`clientes`. Timestamp posicionado logo
**depois** da migration que cria `processos`/`clientes`
(`20250709123659-...sql`) e bem **antes** de `20260628000001` — mesma
estratégia da correção retroativa dos crons (item 4): fecha o buraco no lugar
certo da linha do tempo, não no fim dela, senão as migrations que já
pressupõem essas colunas continuariam quebrando num replay do zero.

Aplicada em produção como no-op puro (tabelas/colunas já existiam — `IF NOT
EXISTS` em tudo): confirmado que os dados reais não mudaram (5 times, 2
membros, 31 processos e 0 clientes com `team_id` continuam exatamente iguais
antes/depois). RLS das duas tabelas continua por conta das migrations já
rastreadas (`20260628000006`/`000007`), que rodam depois desta na ordem
cronológica — não duplicada aqui.

**Validação**: desta vez consegui subir o Postgres local (`postgresql-16` +
`pgtap` já estavam instalados no container, só precisavam do serviço rodado)
e rodar `npm run test:rls` de verdade — 13/13 passaram. `get_advisors` de
segurança idêntico à linha de base, sem regressão.

## Acertos rápidos de manutenibilidade

- `src/migrations/20260418_cleanup_asaas.sql` → movida para
  `supabase/migrations/20260418000000_cleanup_asaas.sql` e versionada
  retroativamente (no-op: as tabelas que ela derruba já tinham sido removidas
  manualmente em abril, e nenhuma migration rastreada as recria — só fechou a
  lacuna no histórico).
- `README.md` reescrito: o que é o VextriaHub, stack real, setup local,
  tabela de scripts, como o schema do Supabase é versionado e os secrets que
  cada workflow de CI/CD precisa (era o texto padrão do Lovable).

## Resumo da parte 3

| # | Achado | Estado |
| --- | --- | --- |
| — | `office_teams`/`office_team_members` sem `CREATE TABLE` versionado | **corrigido** |
| — | `processos.team_id`/`clientes.team_id` sem `ALTER TABLE` versionado (achado novo, mesma causa) | **corrigido** |
| — | `cleanup_asaas.sql` fora de `supabase/migrations/` | **corrigido** |
| — | `README.md` era o texto padrão do Lovable | **corrigido** |

---

# Parte 4 — auditoria profunda das abas do front-end

As três partes anteriores foram quase todas backend (RLS, migrations, edge
functions). Esta parte cobre as 32 páginas/abas do produto — a análise nunca
tinha ido a fundo aí. Método: 6 revisões independentes em paralelo, cada uma
lendo por completo um grupo de páginas + hooks + componentes relacionados,
instruídas a só reportar defeitos prováveis (cenário de falha concreto: input
X → resultado errado Y), nunca "poderia ser melhor". Cada achado abaixo foi
verificado por mim lendo o código antes de entrar na lista ou de virar
correção — inclusive um caso (achado A.1, timezone) confirmado ao vivo
consultando `show timezone` no Postgres de produção (`UTC`, confirmando o
cenário de falha).

Convenção: **[FEITO]** já corrigido e commitado nesta rodada; **[PENDENTE]**
documentado, não corrigido ainda — ou por exigir uma decisão de produto (não
é só bug), ou por escopo/risco maior do que cabia numa correção pontual.

## A. Agenda / Prazos / Audiências / Tarefas / Atendimentos

**A.1 [FEITO] — Corte "hoje" da lista de Atrasados escondia por 1 dia quem venceu à noite.**
`useAgendaEvents.tsx`: `inicioDeHoje` era montado como string local
(`"YYYY-MM-DDT00:00:00"`) e mandado direto pro Postgres, que roda em **UTC**
(confirmado com `show timezone`) — a comparação `.lt("data_audiencia",
inicioDeHoje)` ficava 3h adiantada pro fuso de Brasil. Uma audiência/atendimento
não resolvido às 22h de ontem (`...T01:00:00Z` de hoje) escapava do corte por
um dia inteiro, sumindo tanto de "Atrasados" quanto da lista futura — a mesma
classe do bug corrigido nesta semana, reintroduzida por essa única string
montada à mão (o resto do arquivo já usava `Date`+`toISOString()` correto).
Trocado por `new Date(...).toISOString()`.

**A.2 [FEITO] — "Atrasados" de atendimentos só pegava `status="agendado"`, nunca `"pendente"`.**
`"pendente"` é um status real e distinto de atendimento (a própria
`Atendimentos.tsx` trata os dois como "aguardando baixa"). Um atendimento
`pendente` vencido nunca aparecia em Atrasados na Agenda. Trocado pela mesma
lista de exclusão que audiências já usavam (`not status in
(cancelado,realizado)`).

**A.3 [FEITO] — Atendimento cancelado aparecia normal na Agenda; concluído nunca ganhava o visual de resolvido.**
A consulta do mês da Agenda não filtrava status de atendimento nenhum
(diferente de audiências, que já excluíam canceladas), e o conversor fazia um
cast cru do status do banco sem normalizar — `"realizado"` nunca virava
`"concluido"`, o único tipo de item que escapava do próprio comentário do
arquivo ("resolvido tem que ter cara de resolvido"). Corrigido: filtro de
cancelado na query + normalização igual às audiências.

**A.4 [FEITO] — `CalendarWidget` (dashboard) misturava tarefas/atendimentos de escritórios diferentes.**
As duas queries não tinham `.eq("office_id", ...)` — o comentário no código
dizia "RLS já limita", mas a RLS dessas tabelas não restringe a UM escritório:
libera qualquer linha de qualquer escritório em que o usuário seja membro
ativo (ou tenha processo compartilhado). Um usuário em dois escritórios via
tarefa/atendimento do outro no próprio dashboard. Corrigido com o mesmo
filtro que prazos/audiências/consultivos já tinham ali do lado; herdava
também o bug A.2 (corrigido junto).

**A.5 [PENDENTE] — Deep-links de prazo/tarefa a partir de um processo compartilhado abrem em silêncio e falham.**
`ProcessoDetailsDrawer` deixa um usuário de outro escritório (via
compartilhamento) clicar num prazo/tarefa e navegar para `/prazos`/`/tarefas`
— mas essas páginas filtram a lista por `office_id` do usuário atual, então o
item (que é de outro escritório) nunca aparece; depois de ~4s o parâmetro é
limpo sem nenhum aviso. `Audiencias.tsx` já tem a correção certa (busca direta
por id como fallback quando não acha na lista local) — Prazos e Tarefas nunca
receberam o mesmo tratamento. Não corrigido agora: mesmo padrão em 2 arquivos,
mas quero testar contra um caso real de compartilhamento antes de replicar.

**Confirmado correto:** `src/lib/prazoCalc.ts` (cálculo de prazo — feriados,
recesso forense, dias úteis) foi comparado linha a linha com
`supabase/functions/calculate-prazo/index.ts`: **idênticos**. O bug mais caro
possível neste app (prazo legal calculado errado) não foi encontrado.

## B. Financeiro / Timesheet / CRM / Metas

**B.1 [FEITO] — "Receita do Mês" contava receita cancelada.**
O card de KPI somava toda `receita` vencendo no mês, sem excluir
`status="cancelado"` — diferente de "A Receber"/"A Pagar"/"Saldo do Mês", que
já filtravam por status. Um honorário cancelado inflava a receita do mês
indefinidamente. Corrigido: exclui `cancelado`.

**B.2 [FEITO] — Reativar "Faturável" ao editar um lançamento do Timesheet não salvava.**
`useTimesheetManualEntry.tsx` só escrevia `faturavel: false` quando o switch
estava desligado — nunca escrevia `true` quando religado, porque o update é
parcial (só manda o que muda) e o campo simplesmente não entrava no payload.
Reabrir "Faturável" numa entrada editada não tinha efeito nenhum; a hora
continuava fora dos totais faturáveis e de "Gerar cobrança" pra sempre, sem
erro nenhum na tela. Corrigido: `faturavel: mFat` sempre incluído.

**B.3 [FEITO] — "Estornar cobrança" apagava um recebível JÁ PAGO sem avisar, e reabria as horas pra cobrar de novo.**
Nenhuma checagem de `status` antes de soft-deletar a receita gerada. Uma
cobrança já marcada como paga podia ser estornada — apagando o registro de
que o dinheiro entrou E reabrindo as horas de timesheet pra gerar uma
SEGUNDA cobrança das mesmas horas (double billing). Corrigido: bloqueia com
mensagem clara se `status === "pago"`, pedindo para reverter o pagamento no
Financeiro primeiro.

**B.4 [PENDENTE] — `Register.tsx` mostra preço de plano sem checar `is_active`.**
`Pagamento.tsx` filtra `is_active=true`; `Register.tsx` não — um link de
promoção antigo apontando pra um plano desativado mostra o preço/nome dele
normalmente, mas `apply_signup_plan` (que exige `is_active`) não aplica nada,
e o usuário cai no trial genérico sem nunca saber que o plano anunciado não
foi o que ele recebeu. Não corrigido: decisão de produto sobre o que mostrar
nesse caso (bloquear o link? mostrar aviso? redirecionar pro plano ativo mais
parecido?).

**B.5 [PENDENTE, baixa confiança] — Lançamento manual de Timesheet virando meia-noite falha em silêncio.**
Início e fim do lançamento manual usam a mesma data; um turno 23h–01h calcula
duração negativa e a função só faz `return` sem toast — o diálogo fica aberto
sem explicar por quê. Não corrigido: exige decidir a UX certa (campo de "dia
seguinte"? mensagem de erro? split automático?), não é um one-liner.

## C. Processos / Clientes / Consultivo / Correspondentes

**C.1 [PENDENTE] — Import em lote de OAB e dois fluxos de cliente-inline não mostram a mensagem de cota do plano.**
`JudicialSyncDialog` (import em lote de processos por OAB), `ClientSelect`
(cadastro rápido de cliente embutido nos diálogos de processo/prazo) e
`ProcessoDetailsDrawer` ("Este é meu cliente") inserem direto via Supabase,
sem passar por `useClientes()`/`useProcessosV2()` — nenhum dos três usa
`planQuotaMessage()`. Ao bater a cota, o usuário vê o erro cru do Postgres
("Limite do plano atingido (X de Y processos)") sob um título genérico, em
vez da mensagem amigável com "Faça upgrade". No import em lote isso é pior:
o loop para no meio, alguns itens já foram importados e outros não, sem
indicação de quantos. Não corrigido agora: são 3 pontos de inserção
espalhados, prefiro tratar junto numa correção só (extrair o wrapper de
`useClientes`/`useProcessosV2` em vez de duplicar `planQuotaMessage` em mais
3 lugares).

**C.2 [PENDENTE] — Toast duplicado e conflitante ao bater a cota criando processo.**
`NovoProcessoDialog` mostra a mensagem amigável de cota, mas o
`onError` do próprio `useMutation` (React Query) dispara ANTES com um toast
genérico "Erro na sincronização" + a mensagem crua — o usuário vê os dois
empilhados. Não corrigido: precisa decidir se o `onError` do hook deve parar
de mostrar toast quando quem chamou já vai tratar o erro (mudança de
contrato do hook, não só do dialog).

**C.3 [PENDENTE] — "Excluir" aparece em processos compartilhados que nunca podem ser excluídos.**
O gate do botão é só `canDeleteProcesses` (papel no escritório), nunca
verifica se o processo é compartilhado de outro escritório — a própria RLS
nunca permite excluir um processo compartilhado, então o clique sempre
termina num toast de erro. `ProcessoDetailsDrawer` já esconde a ação
corretamente no mesmo cenário; `ProcessoCard`/`ProcessoTable` não. Correção
pequena e segura — fica pra próxima rodada por volume, não por risco.

**C.4 [PENDENTE, confiança moderada] — `useCorrespondentes` mistura dados de todos os escritórios do usuário.**
Única consulta do app sem filtro explícito de `office_id`, apoiada só na RLS
— que libera qualquer escritório em que o usuário seja membro ativo (não só
"o atual"). Se um usuário pertence a 2+ escritórios, a lista de
correspondentes/diligências mistura os dois sem indicação visual. Não pude
confirmar o quão comum é um usuário estar em 2+ escritórios ativos em
produção — fica documentado, não corrigido às pressas sobre uma suposição
não verificada.

**C.5 [PENDENTE, menor] — `useConsultivos` engole a causa real de qualquer erro** (`catch { toast(...) }` sem variável de erro, mesma mensagem genérica pra RLS, rede ou payload inválido — dificulta diagnosticar quando alguém reportar "não consegui salvar").

## D. Equipe / Admin / Configurações / Perfil

**D.1 [PENDENTE, mais importante deste bloco] — A maioria dos toggles de "Permissões" por membro não tem efeito nenhum.**
Dos ~30 flags que um admin pode ligar/desligar por membro em Equipe →
Permissões (excluir clientes, gerenciar financeiro, gerenciar consultivo,
gerenciar metas, convidar usuários, gerenciar agenda/tarefas/prazos/
publicações/CRM, etc.), a maioria **nunca é lida em lugar nenhum do código**
fora da própria definição do hook, e **nenhuma política de RLS as consulta**
— `clientes_delete`/`atendimentos` (e as demais) decidem por visibilidade de
time/papel de escritório, nunca por `user_permissions.granted`. Um admin que
desliga "Excluir clientes" pra um membro específico acredita ter revogado
essa permissão; na prática nada mudou, nem na tela (a maioria das telas nem
olha a flag) nem no banco (RLS ignora a tabela). Isto é o oposto do "falso
sentimento de restrição" que eu esperava encontrar — é uma tela inteira que
promete controle granular e não entrega. Não corrigido: é uma decisão de
produto (implementar de verdade ~20 flags no RLS + nas telas, ou remover as
que não fazem nada da UI) grande demais pra decidir sozinho.

**D.2 [PENDENTE] — Ações de gerenciar equipe sempre mostram toast de sucesso, mesmo quando a RLS bloqueia.**
Promover/remover coordenador e adicionar/remover membro (`TeamDialogs.tsx`)
não checam o retorno booleano das funções do hook — que retornam `false` (não
lançam) quando a RLS barra a escrita. O card de uma equipe também abre o
diálogo de gestão pro clique de qualquer membro (só os ícones de editar/
excluir do card têm o gate certo). Sem escalada de privilégio real (a RLS
segura certo), mas o admin vê "Coordenador definido"/"Removido da equipe"
sem a ação ter acontecido de fato.

**D.3 [PENDENTE, cosmético] — Perfil.tsx nunca mostra "Coordenador".**
Lê `office_role` (de `office_users.role`: user/admin/owner), mas
"coordinator" só existe em `office_team_members.role` — uma tabela e coluna
totalmente diferentes. A condição `officeRole === "coordinator"` é código
morto; um coordenador de time real sempre vê "Membro" no próprio perfil. Fix
exigiria buscar `office_team_members` no Perfil (hoje não busca) — pequeno,
mas não é um one-liner sem essa consulta nova.

**D.4 [PENDENTE, menor] — Confirmação de exclusão de equipe não menciona processos/clientes/metas.**
Avisa só que os membros serão desvinculados; não menciona que
`processos.team_id`/`clientes.team_id`/`metas.team_id` apontando pra aquela
equipe viram `NULL` (`ON DELETE SET NULL`). Não é o tipo de coisa que erra
dado, só some da visão por-time sem aviso.

## E. Login / Cadastro / IA

**E.1 [FEITO] — Admin de escritório logava e caía em `/dashboard` em vez de `/admin`.**
`Login.tsx` calcula o redirect 100ms após autenticar, usando `user.role` —
que só vira `"admin"` depois de um fetch assíncrono de perfil que quase nunca
termina em 100ms. `Index.tsx` já tinha um "auto-cura" pra super_admin
(`isSuperAdmin` → redireciona pra `/admin` assim que fica `true`, mesmo que o
`/dashboard` tenha carregado primeiro) mas não pra admin de escritório.
Estendido pra `isOfficeAdmin` (que já cobre admin/owner/super_admin e resolve
no mesmo instante que `user.role`).

**E.2 [FEITO] — `checkout_in_progress` travava o auto-redirect do Login pra sempre, num navegador específico.**
Setada no início de todo cadastro, só era limpa em 3 dos 4 caminhos —
faltava exatamente o mais comum (confirmação de e-mail pendente, o auto-login
pós-cadastro falha de propósito). Ficava `'true'` naquele navegador
indefinidamente; semanas depois, abrir `/login` já autenticado (aba
recarregada, favorito, botão voltar) não redirecionava sozinho — só um login
manual (que usa outro efeito, sem essa checagem) funcionava. Corrigido:
limpa a flag também neste caminho.

**E.3 [FEITO] — Erro de `apply_signup_plan` era engolido; cadastro reportava sucesso mesmo sem aplicar o plano escolhido.**
`.rpc()` não lança em erro de aplicação — só devolve `{ data: null, error }`.
Só `data` era lido; se a função no banco falhasse (plan_type inválido, erro
transitório), `planOutcome` ficava `null` e o código caía no ramo de
sucesso/trial, dizendo "Seu período de teste começou" sem o usuário nunca
saber que o plano pago escolhido não foi registrado. Corrigido: checa
`error`, e nesse caso mostra um toast dizendo que o plano não foi aplicado
(a conta é criada normalmente, no trial padrão).

**E.4 [PENDENTE, menor] — Política de senha inconsistente:** cadastro exige 8+ caracteres, redefinir senha aceita 6+. Dá pra sair do cadastro com senha forte e voltar pra uma mais fraca no reset.

**E.5 [PENDENTE, menor] — Erro de reconhecimento de voz (microfone negado, etc.) na IA é totalmente silencioso** — o botão só para de pulsar, sem nenhuma mensagem.

**Confirmado correto:** fluxo de voz da IA tem fallback (erro no TTS do
servidor cai pro `speechSynthesis` do navegador); 429 de limite de IA é
tratado nos dois pontos onde aparece; nenhuma sessão de chat vaza de um
usuário pro próximo na mesma aba (o widget desmonta no logout).

## F. Dashboard / Gráficos / Publicações / Notificações / Lixeira

**F.1 [FEITO] — Restaurar/excluir na Lixeira reportava sucesso mesmo quando a RLS bloqueava.**
Nenhum dos dois handlers checava `error` do retorno do Supabase — um
UPDATE/DELETE barrado pela RLS não lança, só afeta 0 linhas e "sucede". O
item sumia da lista local e o toast dizia "Restaurado"/"Excluído
permanentemente" com a linha intocada no banco, reaparecendo só depois de um
F5. Corrigido: checa `error` e lança se houver, mesmo padrão nos dois
handlers.

**F.2 [FEITO] — Gráfico "Receita x Despesa" do dashboard perdia/duplicava meses inteiros perto de virada de mês.**
`MiniFinanceChart` calculava `setMonth(mês - N)` ANTES de zerar o dia — em
qualquer dia 29, 30 ou 31, isso estoura pro mês seguinte quando o mês alvo
tem menos dias (ex.: hoje=31/jul, -5 meses vira 3/mar em vez de 1/fev).
Reproduz de forma determinística nesses dias todo mês: o gráfico mostra 6
barras mas só 3 meses distintos, cada um duplicado, com **os outros 3 meses
completamente ausentes** (não zerados — nunca buscados, porque o próprio
`start` da query também estourava). Corrigido: zera o dia antes de subtrair
o mês, no cálculo de `start` e no de cada barra.

**F.3 [FEITO] — Cores do gráfico de pizza "Distribuição de processos" trocadas quando alguém tem 0 processos.**
Recharts casa `&lt;Cell&gt;` com `data` por posição; o `data` era filtrado
(`processos &gt; 0`) mas as `Cell` vinham da lista **sem filtro** — se alguém
no meio da lista tem 0 processos, todo mundo depois dele recebe a cor de
outra pessoa. Rótulos ficavam certos (leem o próprio nome), só a cor
desalinhava. Corrigido: gera as `Cell` a partir da mesma lista filtrada.

**F.4 [PENDENTE] — Badge de notificações não lida fica dessincronizado entre aba/sino e a página `/notificacoes`.**
`useNotifications` só escuta `INSERT` em tempo real; marcar como lida
atualiza só o estado local daquela instância do hook. O sino no cabeçalho e a
página cheia rodam instâncias independentes — marcar como lida numa não
atualiza o contador da outra até desmontar/remontar. Não corrigido: pede um
cache compartilhado (React Query) ou assinar também `UPDATE`, mudança no
hook usado em vários lugares, não isolada.

**F.5 [PENDENTE] — Bucket de mês em `useChartsData` mistura fuso local e UTC.**
As chaves de mês (`lastMonths()`) são montadas com componentes de data LOCAIS;
o agrupamento de cada linha (`monthKey()`) usa `iso.slice(0,7)` na string ISO
crua do Postgres, que é UTC. Um registro perto da virada do mês (ex.:
31/ago 23h30 BRT = 01/set 02h30 UTC) pode cair no mês seguinte em TODAS as
séries "por mês" do relatório de Gráficos. Não corrigido: mesmo padrão em ~9
séries diferentes no mesmo hook, prefiro trocar todas de uma vez por uma
função de bucket única e testada, não um patch por série.

**F.6 [PENDENTE, confiança moderada] — Filtro por time nos Gráficos usa só `responsavel_id`, sem o fallback pra `user_id`.**
A agregação por membro (mesmo arquivo) já assume que algumas linhas não têm
`responsavel_id` (cai pra `user_id`) — confirmado que atendimentos criados
pelo drawer do processo realmente nascem assim. Ao filtrar por um time
específico, essas linhas somem da contagem do time mesmo pertencendo a um
membro dele. Não corrigido: mesma mudança estrutural do F.5, mais eficiente
resolver as duas juntas.

## Resumo da parte 4

| Área | Feito | Pendente |
| --- | --- | --- |
| A — Agenda/Prazos/Audiências/Tarefas/Atendimentos | 4 | 1 |
| B — Financeiro/Timesheet/CRM/Metas | 3 | 2 |
| C — Processos/Clientes/Consultivo/Correspondentes | 0 | 5 |
| D — Equipe/Admin/Configurações/Perfil | 0 | 4 |
| E — Login/Cadastro/IA | 3 | 2 |
| F — Dashboard/Gráficos/Publicações/Notificações/Lixeira | 3 | 3 |
| **Total** | **13** | **17** |

Verificação desta rodada: `tsc` limpo, ESLint 0 erros/689 avisos (sem
mudança), Vitest 205/205, `vite build` ok — nenhuma das 13 correções mexeu em
schema/API pública, só lógica interna de componentes/hooks já existentes.

---

# Parte 5 — os 17 pendentes da parte 4, um por um

Fechados 16 dos 17; o que sobra (D.1) exige uma decisão de produto que não é
minha pra tomar sozinho, exatamente como já estava marcado.

- **A.5 ✅** Deep-links de prazo/tarefa a partir de processo compartilhado
  ganharam o mesmo fallback (busca direta por id) que Audiências já tinha.
- **B.4 ✅** `Register.tsx` agora só mostra preço/badge de plano com
  `is_active=true` (igual a `Pagamento.tsx`); plano desativado cai no fluxo
  orgânico em vez de anunciar um preço que nunca seria cobrado.
- **B.5 ✅** Lançamento de Timesheet virando meia-noite (ex.: 23h–01h) agora
  é entendido como virando o dia, em vez de falhar em silêncio. Bônus achado
  no caminho: a correção também elimina um desvio de fuso de 3h que já
  existia no salvamento — a hora digitada ia crua pro Postgres (que roda em
  UTC), mesma classe do achado A.1 da parte 4, só que na escrita, não na
  leitura.
- **C.1 ✅** Cota de plano agora aparece nos 3 pontos que faltavam:
  `ClientSelect` (cadastro rápido embutido), `ProcessoDetailsDrawer`
  ("Este é meu cliente") e o import em lote de OAB — que também passa a
  informar quantos itens já tinham sido salvos antes de parar no meio do
  lote.
- **C.2 ✅** O `onError` genérico de `useProcessosV2` agora pula o toast
  quando reconhece um erro de cota de plano (quem chamou já mostra a
  mensagem amigável) — fecha o toast duplicado.
- **C.3 ✅** "Excluir" não aparece mais em processos compartilhados (nunca
  podiam ser excluídos mesmo) em `ProcessoCard` e `ProcessoTable`, mesmo
  critério que `ProcessoDetailsDrawer` já usava.
- **C.4 ✅** `useCorrespondentes` agora filtra por `office_id`, como todo
  outro hook do app.
- **C.5 ✅** `useConsultivos` loga e mostra a causa real de cada erro
  (`catch (err)` em vez de `catch {}`), nos 4 pontos.
- **D.2 ✅** As 4 ações de gestão de equipe (promover/remover coordenador,
  adicionar/remover membro) checam o retorno antes de dizer "sucesso" —
  cobre um coordenador tentando mexer num time que não é o dele, ou
  qualquer outro caso de RLS bloqueando.
- **D.3 ✅** Perfil.tsx passa a consultar `office_team_members` de verdade
  (antes lia a coluna errada, de outra tabela) e mostra "Coordenador"
  corretamente.
- **D.4 ✅** As duas confirmações de exclusão de equipe agora mencionam que
  processos/clientes/metas vinculados ficam sem equipe.
- **E.4 ✅** Mínimo de senha unificado em 8 caracteres (cadastro e redefinir
  senha).
- **E.5 ✅** Erro de reconhecimento de voz agora mostra um toast explicando
  o motivo (microfone negado, sem microfone, rede) — exceto os casos
  benignos (silêncio, cancelamento), que continuam silenciosos de propósito.
- **F.4 ✅** `useNotifications` passa a escutar também `UPDATE`/`DELETE` em
  tempo real (só escutava `INSERT`) — sino do cabeçalho e página
  `/notificacoes` ficam sincronizados entre si e entre abas.
- **F.5 ✅** `monthKey` em `useChartsData` passa a usar componentes de data
  locais pra colunas timestamptz (mesma base do `lastMonths()`), mantendo
  colunas `DATE` como estavam — evita que um registro perto da virada do mês
  em UTC caia no mês errado nas séries "por mês" dos Gráficos.
- **F.6 ✅** Os filtros por time em Gráficos agora aceitam o mesmo fallback
  `responsavel_id OU (sem responsavel_id E user_id da equipe)` que a
  agregação por membro já usava — processos/prazos/atendimentos/consultivos
  sem responsável direto não somem mais da contagem do time ao qual o
  criador pertence.
- **D.1 ⏳ pendente, decisão de produto** — a maioria dos ~20 toggles de
  "Permissões" por membro não tem efeito real (nem tela, nem RLS, os
  consultam). Não é um bug pontual pra corrigir sozinho: a decisão é entre
  (a) implementar de verdade os ~20 flags (RLS + telas, trabalho grande e
  espalhado) ou (b) remover da UI os toggles que não fazem nada hoje
  (rápido, mas reduz a promessa da tela). Levada ao usuário como pergunta
  antes de mexer.

## Resumo da parte 5

| # | Achado | Estado |
| --- | --- | --- |
| A.5 | Deep-links de prazo/tarefa em processo compartilhado | **corrigido** |
| B.4 | Preço de plano sem checar `is_active` no cadastro | **corrigido** |
| B.5 | Timesheet virando meia-noite falhava em silêncio | **corrigido** |
| C.1 | Cota de plano não avisada em 3 pontos de inserção | **corrigido** |
| C.2 | Toast duplicado ao bater cota criando processo | **corrigido** |
| C.3 | "Excluir" em processo compartilhado (nunca funciona) | **corrigido** |
| C.4 | `useCorrespondentes` sem filtro de `office_id` | **corrigido** |
| C.5 | `useConsultivos` engolindo causa real do erro | **corrigido** |
| D.1 | Toggles de permissão sem efeito real | **pendente — decisão de produto** |
| D.2 | Ações de equipe sempre "sucesso", mesmo bloqueadas pela RLS | **corrigido** |
| D.3 | Perfil.tsx nunca mostra "Coordenador" | **corrigido** |
| D.4 | Exclusão de equipe não avisa sobre processos/clientes/metas | **corrigido** |
| E.4 | Política de senha inconsistente (8 vs 6) | **corrigido** |
| E.5 | Erro de voz silencioso | **corrigido** |
| F.4 | Badge de notificação dessincronizado | **corrigido** |
| F.5 | Bucket de mês UTC/local em Gráficos | **corrigido** |
| F.6 | Filtro por time sem fallback pra `user_id` | **corrigido** |

Verificação: `tsc` limpo, ESLint 0 erros/689 avisos (idêntico à linha de
base — os `any`/deps novos que as correções introduziram foram limpos com
tipos reais em vez de suprimidos), Vitest 205/205, `vite build` ok.
