# Contribuindo com o VextriaHub

## Branches e Pull Requests

- Um branch por mudança lógica, criado a partir da `main` atualizada:
  ```sh
  git fetch origin main
  git checkout -b minha-mudanca origin/main
  ```
- Uma PR por branch — evite misturar mudanças não relacionadas.
- Mensagens de commit e descrições de PR em português, explicando o
  **porquê** da mudança (não só o que mudou).
- Merge só depois de review/aprovação — não faça squash/merge da sua própria
  PR sem revisão.

## Antes de abrir a PR

Rode os quatro checks localmente — é o mesmo que o CI (`.github/workflows/ci.yml`)
roda em todo push/PR pra `main`:

```sh
npx tsc --noEmit -p tsconfig.app.json   # type-check (⚠️ sem -p é um no-op neste projeto)
npx eslint . --ext .ts,.tsx             # lint
npx vitest run                          # testes
npx vite build                          # build de produção
```

## Regra do `any` (orçamento de warnings)

`@typescript-eslint/no-explicit-any` é **warning**, não erro — o objetivo é
zerar `any` gradualmente sem travar todo PR por causa de código legado. Na
prática:

- **Não aumente o total de warnings do lint.** Se sua mudança introduzir um
  `any` novo sem necessidade real, tipe corretamente em vez de suprimir.
- Um `any` legítimo (payload dinâmico de integração externa, JSONB de
  tribunal/PJe, etc.) é aceitável — mas prefira `unknown` + narrowing quando
  der.
- O total atual de warnings do `npm run lint` é o teto de referência: se a
  sua PR aumentar esse número, o motivo deve ser genuíno (código novo que
  realmente precisa de `any`), não preguiça de tipar.

## Tratamento de erro

- `catch` não pode ficar vazio sem comentário — o ESLint (`no-empty` com
  `allowEmptyCatch: false`) bloqueia isso. Toda captura de erro deve fazer
  uma das três coisas:
  1. Repassar pro usuário (`toast`, `setError`) ou relançar (`throw`);
  2. Reportar via `captureError(e, { context })` (`src/lib/monitoring.ts`)
     quando o erro não pode/deve interromper o fluxo, mas precisa ficar
     rastreável no Sentry;
  3. Ter um comentário curto explicando por que ignorar é seguro (ex.:
     leitura de `localStorage` com fallback já tratado).
- Mutations que dependem de RLS para bloquear a ação (não de uma checagem
  explícita antes) devem usar `assertRowsAffected` (`src/lib/errors.ts`) —
  ver `CLAUDE.md` para o porquê.

## Banco de dados

Migrations vivem em `supabase/migrations/` e são a fonte da verdade — não
altere tabelas/policies direto no painel do Supabase sem depois versionar a
mudança aqui. Mudança de schema em produção é sensível: confirme com o time
antes de aplicar.

## Mais contexto

Convenções específicas para trabalho assistido por IA (fluxo de branch/PR,
padrões de código estabelecidos como soft-delete e a arquitetura de
permissões) estão em [`CLAUDE.md`](./CLAUDE.md).
