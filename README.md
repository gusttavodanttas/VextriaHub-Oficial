# VextriaHub

SaaS de gestão para escritórios de advocacia: processos, prazos, audiências,
clientes, financeiro, timesheet, CRM e um assistente de IA — multi-tenant
(cada escritório só enxerga o próprio dado, com visibilidade por time),
plano/assinatura controlados no banco (RLS), não só na tela.

Análise técnica completa da plataforma (achados de segurança/desempenho e o
que foi corrigido) em [`docs/ANALISE_PLATAFORMA_SET2026.md`](./docs/ANALISE_PLATAFORMA_SET2026.md).

## Stack

- **Front-end**: Vite + React + TypeScript, shadcn/ui + Tailwind, TanStack
  Query, React Router, React Hook Form + Zod.
- **Back-end**: Supabase (Postgres com Row Level Security, Auth, Edge
  Functions em Deno, pg_cron para os robôs agendados).
- **Testes**: Vitest (unitário/componente), Playwright (E2E no navegador, ver
  [Testes E2E](#testes-e2e)) e um teste pgTAP standalone de isolamento por
  escritório/time (RLS).
- **Observabilidade**: Sentry (opcional, via `VITE_SENTRY_DSN`).

## Rodando localmente

Requer Node.js 22+.

```sh
npm install
cp .env.example .env.local   # preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm run dev
```

As credenciais do Supabase ficam em **Project Settings → API** no painel do
projeto. `VITE_SENTRY_DSN` é opcional — deixe em branco para desativar.

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento (Vite) |
| `npm run build` | Build de produção |
| `npm run lint` | ESLint |
| `npm test` / `npm run test:watch` | Testes (Vitest) |
| `npm run test:rls` | Suíte pgTAP de isolamento por escritório/time — sobe um Postgres descartável local (ver `supabase/tests/rls-standalone/README.md`) |
| `npm run test:e2e` / `npm run test:e2e:smoke` | E2E no navegador (Playwright) — ver [Testes E2E](#testes-e2e) |

## Testes E2E

`e2e/` tem dois projetos do Playwright (`playwright.config.ts`):

- **smoke** — páginas públicas (login, redirecionamento de rota interna). Não
  precisa de credenciais nem de backend: roda em qualquer PR.
- **conta-teste** — jornada autenticada com a conta de teste: cadastra cliente →
  processo manual vinculado → prazo fatal, passando pela RLS e pelas cotas
  reais. Tudo que cria leva o prefixo `E2E <data hora>` e é apagado no fim
  (`e2e/limpeza.ts`, com a sessão da própria conta). **Pulada automaticamente**
  quando `E2E_TEST_EMAIL`/`E2E_TEST_PASSWORD` não existem.

Rodando local (o build precisa das variáveis do Supabase; o Playwright sobe um
`vite preview` em `127.0.0.1:4173`):

```sh
npx playwright install chromium          # uma vez
VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... npx vite build
npm run test:e2e:smoke                   # só as páginas públicas
E2E_TEST_EMAIL=... E2E_TEST_PASSWORD=... VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... npm run test:e2e
```

`E2E_BASE_URL=https://...` aponta os testes para um ambiente já publicado em
vez do preview local. `PW_CHROMIUM_PATH` usa um Chromium já instalado fora do
cache do Playwright (sandboxes).

## Banco de dados (Supabase)

O schema vive versionado em `supabase/migrations/` — é a fonte da verdade;
evite alterar tabelas/policies direto no painel sem depois versionar a
mudança aqui. As edge functions ficam em `supabase/functions/`.

Para aplicar migrations/funções contra um projeto Supabase, use a
[CLI oficial](https://supabase.com/docs/guides/local-development):

```sh
npx supabase db push --project-ref <PROJECT_REF>
npx supabase functions deploy <nome-da-funcao> --project-ref <PROJECT_REF>
```

Alguns robôs agendados (`pg_cron` + `pg_net`) chamam edge functions com
segredos guardados no `supabase_vault` (não em texto nas migrations) — ver o
cabeçalho de `supabase/migrations/20260904160000_crons_vault_secrets.sql`.

## CI/CD

- **`.github/workflows/ci.yml`** roda em todo push/PR para `main`: lint,
  type-check, testes e build.
- **`.github/workflows/e2e.yml`** roda o Playwright todo dia (03:17 BRT) e sob
  demanda, contra um build local com as mesmas variáveis do deploy. A jornada
  autenticada precisa dos secrets `E2E_TEST_EMAIL` e `E2E_TEST_PASSWORD` (a
  conta de teste); sem eles só o smoke roda, com aviso.
- **`.github/workflows/deploy-oracle.yml`** builda e publica o front no
  servidor Oracle a cada push em `main`. Precisa de dois secrets do repositório
  (`Settings → Secrets and variables → Actions`): `VITE_SUPABASE_ANON_KEY` e
  `ORACLE_SSH_KEY` — sem eles o workflow falha (esperado até serem
  configurados).
