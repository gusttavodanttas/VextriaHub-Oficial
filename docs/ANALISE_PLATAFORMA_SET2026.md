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
`JudicialSyncDialog.tsx` 949, `NovoPrazoStandaloneDialog.tsx` 910).
`src/migrations/20260418_cleanup_asaas.sql` está no diretório errado. O
`README.md` ainda é o texto padrão do Lovable. Três fontes de verdade para preço
e plano: `plan_configs`, as constantes de `usePlanFeatures.tsx` e os valores
escritos à mão em `Landing.tsx`.

## Plano de ação

| # | Ação | Estado |
| --- | --- | --- |
| 1 | Contador e teto de uso da IA | **feito** — ver abaixo |
| 2 | Triggers de cota por plano (processos, clientes, tarefas) | pendente |
| 3 | IA respeitando permissões (escritas com o JWT do usuário) | pendente |
| 4 | Crons pelo vault, migrations replayáveis | pendente |
| 5 | Gate de módulo no banco (`financeiro`, `metas`) | pendente |
| 6 | `(select auth.uid())` nas 35 policies + índices nas FKs quentes | pendente |
| 7 | Primeiro teste de RLS (dois escritórios, dois times) | pendente |
| 8 | Folga na catraca de lint (limpar ~40 avisos, teto para 680) | pendente |

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
