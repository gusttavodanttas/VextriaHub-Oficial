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
- **Testes**: Vitest (unitário/componente) e um teste pgTAP standalone de
  isolamento por escritório/time (RLS).
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
- **`.github/workflows/deploy-oracle.yml`** builda e publica o front no
  servidor Oracle a cada push em `main`. Precisa de dois secrets do repositório
  (`Settings → Secrets and variables → Actions`): `VITE_SUPABASE_ANON_KEY` e
  `ORACLE_SSH_KEY` — sem eles o workflow falha (esperado até serem
  configurados).
