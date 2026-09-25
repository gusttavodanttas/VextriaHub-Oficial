# CLAUDE.md

Orientação para o Claude Code (ou outro agente) trabalhando neste repositório.
Para visão geral do produto/stack, ver [`README.md`](./README.md). Para o
fluxo de contribuição humano, ver [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## Fluxo de trabalho

- **Um branch por mudança lógica**, sempre a partir da `main` atualizada:
  `git fetch origin main -q && git checkout -b <nome> origin/main`.
- **Uma PR por branch.** Nunca empilhar mudanças não relacionadas na mesma PR.
- **Nunca fazer merge sem confirmação explícita do usuário** — abrir a PR e
  esperar. Isso vale mesmo que a mudança pareça trivial.
- **Nunca alterar schema do banco (migration aplicada em produção) sem
  confirmar antes com o usuário** e verificar de forma independente qual
  projeto Supabase é o correto (cruzar `list_tables` com o schema esperado
  pelo código — não confiar só no nome do projeto).

## Antes de todo push: validação em 4 passos

```sh
npx tsc --noEmit -p tsconfig.app.json   # tsc --noEmit sem -p é um no-op neste repo
npx eslint . --ext .ts,.tsx             # orçamento: ≤700 warnings, 0 erros
npx vitest run                          # hoje: 244 testes
npx vite build
```

Rodar os quatro antes de cada push, não só no fim da tarefa. Um push que
quebra CI custa um ciclo de revisão inteiro.

## Padrões estabelecidos no código

- **`captureError(error, context?)`** (`src/lib/monitoring.ts`) — reporta pro
  Sentry em produção, cai pro `console.error` em dev/sem DSN. É o padrão do
  projeto para erros capturados em `catch` que não têm outro jeito de virar
  visível (toast, `setError`). Todo `catch` novo precisa ou repassar o erro
  (toast/`setError`/`throw`), ou chamar `captureError`, ou ter um comentário
  explicando por que é seguro ignorar — regra de lint `no-empty` com
  `allowEmptyCatch: false` trava o caso "nem uma coisa nem outra".

- **`assertRowsAffected(data, error, expectedCount)`** (`src/lib/errors.ts`) —
  o Postgres/PostgREST **não lança erro** quando uma policy RLS restritiva
  bloqueia um UPDATE/DELETE: a query só casa 0 linhas e devolve sucesso. Toda
  mutation que depende de RLS para permissão precisa encadear `.select('id')`
  e checar a contagem com esse helper, senão a UI mostra "sucesso" com a
  linha intocada no banco.
  Para testar esse caminho, `src/tests/helpers/supabaseMock.ts` tem um mock
  encadeável do client: `enfileirar('tabela', { data: [] })` simula a RLS
  barrando em silêncio (ver `src/tests/hooks/*.rls.test.tsx`).

- **`patchOfficeSettings(officeId, patch)`** (`src/lib/officeSettings.ts`) — o
  **único** caminho de escrita em `offices.settings`. O jsonb guarda configurações
  de várias telas; cada uma só conhece as próprias chaves. O helper aborta se a
  releitura falhar (mesclar em cima de `{}` apagaria as outras chaves) e confere
  as linhas afetadas. Quem lê `offices.settings` para editar também precisa
  propagar o erro do load e **bloquear o save enquanto ele não tiver
  sucesso** — senão os defaults exibidos na tela são gravados por cima da
  configuração real (ver `useOfficeSettingList`).

- **Hooks de dado expõem `error`/`isError`, não só `loading`.** Página
  correspondente deve mostrar um banner de erro com ação de retry — ver
  `useStats`/`Index.tsx`, `useNotifications`/`Notificacoes.tsx` como exemplos.
  Cuidado com `initialData` vindo de cache (localStorage): `query.isError` do
  TanStack Query não reflete uma falha de refetch em segundo plano quando já
  existe `data` — use `!!query.error` diretamente nesse caso.

- **Soft-delete + Lixeira**: ao converter uma tabela de hard-delete pra
  soft-delete, sempre: coluna `deletado boolean not null default false` via
  migration; `.eq('deletado', false)` nas queries de listagem; mutations de
  "excluir" viram `.update({ deletado: true })`; registrar a tabela em
  `TABELA_CONFIG` de `src/pages/Lixeira.tsx` (ícone/label/cor + fetch com
  `TRASH_TABLE_CAP`); se a tabela não tiver coluna `deletado_pendente`,
  excluí-la da lista em `handleRestore` que zera esse campo.

- **Permissões**: `usePermissions()` + `FeaturePermissions`
  (`src/types/permissions.ts`) combinam defaults por papel (admin, admin de
  escritório, usuário comum), restrições por plano
  (`applyPlanRestrictions`) e overrides por usuário. Gates de UI devem usar
  esse hook (`canView*`), não checagens ad-hoc de papel/role.

## Deploy

Merge em `main` dispara `.github/workflows/deploy-oracle.yml`. Merges
próximos disparam múltiplas runs; runs intermediárias são canceladas
automaticamente por debounce — só a última (build cumulativo da `main`)
realmente publica. Não é preciso re-disparar manualmente depois de vários
merges seguidos.
