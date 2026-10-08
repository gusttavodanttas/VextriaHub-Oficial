# Migração para outro projeto Supabase a partir do backup baixado

Roteiro para mover o VextriaHub do projeto `mzhnlhfxfoigkqgxseeu` (VextriaJus,
**pausado**) para `pvesofbrctfipdyqyloq`, **com dados, usuários e arquivos**, usando
os dois arquivos que o painel oferece para projetos pausados:

- `db_cluster-<data>.backup.gz` — dump completo do banco (`pg_dumpall`)
- `<ref>.storage.zip` — arquivos do Storage (bucket `uploads`)

Os usuários mantêm as senhas (os hashes vão no backup), mas todos precisam
**entrar de novo**: as sessões são assinadas com a chave do projeto antigo.

> Os arquivos gerados na migração (`.migracao-supabase/`, `.env.funcoes`) contêm
> **dados reais e segredos** e estão no `.gitignore`. Apague-os ao terminar.

## Por que não restaurar o backup inteiro nem rodar as migrations do repositório

- O backup traz os schemas que o Supabase gerencia (`auth`, `storage`, `realtime`,
  `extensions`, `cron`, `vault`) com donos e versões que **já existem** no projeto
  novo. Restaurá-lo inteiro conflita com eles. `extrair-do-backup.py` separa só o
  que é da aplicação.
- As migrations em `supabase/migrations/` **não refletem a produção**: o banco
  registra 63 aplicadas (nomes de carimbo automático) e o repositório tem 155
  arquivos, 136 nunca aplicados pelo mecanismo oficial. O schema real só existe
  no backup — e é dele que vem (48 tabelas, 44 funções, 195 policies, 40 triggers,
  tudo com RLS).

O procedimento foi **testado de ponta a ponta num Postgres local**: 52 tabelas com
contagens idênticas ao backup, nenhum órfão de chave estrangeira.

## O que vai e o que fica

| Vai para o projeto novo | Fica para trás (de propósito) |
| --- | --- |
| schema `public` inteiro (tabelas, funções, policies, triggers, índices, grants) | sessões e refresh tokens (todo mundo entra de novo) |
| gatilho `on_auth_user_created` em `auth.users`; policies do bucket `uploads` | `cron.*` — recriado pela migration `20261008000000` com a URL nova |
| dados de todas as tabelas `public`, `auth.users`, `auth.identities`, buckets e metadados do Storage | `vault.*` — cifrado por projeto; os 3 secrets são recriados à mão |
| arquivos do Storage (zip) | logs (`cron.job_run_details`), histórico de migrations do Supabase |

## Antes de começar

- [ ] Baixar os dois arquivos do painel do projeto antigo e `gunzip` no `.backup.gz`.
- [ ] Projeto novo **vazio** (recém-criado; nenhuma tabela em `public`, nenhum usuário).
- [ ] Ferramentas: Supabase CLI (`npx supabase`), `psql`, Python 3, Node 18+.
- [ ] Connection string do banco **novo**: Settings → Database → *Connection string*
      (*Session pooler*), com a senha do banco.
- [ ] Decisão de corte: o backup é de **21/09/2026 04:13** (dados até 20/09). Nada
      gravado depois disso no projeto antigo vai para o novo.

## 1. Banco, usuários, crons, functions e segredos — `migrar.sh`

```sh
export BACKUP=/caminho/db_cluster-21-09-202604-13-06.backup
export NEW_DB_URL='postgresql://...novo...'
export NEW_REF=pvesofbrctfipdyqyloq
bash scripts/migracao-supabase/migrar.sh
```

O script pede confirmação em cada etapa:

1. **Extrair** `01-schema.sql`, `02-dados.sql` e `contagens.txt` do backup.
2. **Restaurar** no novo: schema, depois dados (`session_replication_role = replica`,
   sem triggers nem checagem de FK na carga), cada um numa transação única. Em
   seguida `conferir.sql`: contagens por tabela (comparar com `contagens.txt`),
   objetos e órfãos de FK (esperado 0).
3. **Histórico de migrations:** marca as do repositório como aplicadas, para o
   `db push` aplicar só as novas.
4. **Vault + crons:** criar os 3 secrets no SQL Editor (comandos na tela) e
   `db push` da migration `20261008000000_crons_url_pelo_vault.sql`; confere
   `cron.job` (8 robôs).
5. **Edge functions + segredos:** publica as 24 functions e os segredos de
   `.env.funcoes` (modelo em `.env.funcoes.example`). Os valores do projeto antigo
   **não podem ser lidos de volta** no painel; use os originais.

> `super-worker`, `regex-canary` e `asaas-sandbox-test` existiam só no projeto
> antigo e não estão no repositório; com ele pausado, não há como baixá-las.

## 2. Arquivos do Storage — `enviar-storage.mjs`

```sh
unzip mzhnlhfxfoigkqgxseeu.storage.zip -d /tmp/storage-antigo
NEW_URL=https://pvesofbrctfipdyqyloq.supabase.co NEW_SERVICE_KEY=... \
node scripts/migracao-supabase/enviar-storage.mjs /tmp/storage-antigo/mzhnlhfxfoigkqgxseeu
```

A chave `service_role` fica em Settings → API. O bucket já existe (veio no
`02-dados.sql`); o script só sobe os arquivos, com os mesmos caminhos.
(`copiar-storage.mjs` é a variante para quando o projeto de origem está no ar.)

## 3. Painel do Supabase (projeto novo)

- [ ] **Authentication → URL Configuration:** *Site URL* `https://www.vextriahub.com.br`
      e *Redirect URLs* com `https://www.vextriahub.com.br/**`.
- [ ] **Authentication → SMTP / Email Templates:** remetente, SMTP e templates
      iguais aos do projeto antigo (o backup não traz essa configuração).
- [ ] **Authentication → Providers → Email:** mesmas opções (confirmação de e-mail etc.).

## 4. Serviços externos

- [ ] **Asaas → Integrações → Webhooks:** URL
      `https://pvesofbrctfipdyqyloq.supabase.co/functions/v1/asaas-webhook`,
      mesmo token (`ASAAS_WEBHOOK_TOKEN`).
- [ ] **VextriaZap (bridge do WhatsApp):** se chama `zap-link`/`zap-bridge`, apontar
      para a URL do projeto novo.
- [ ] **Google Cloud (OAuth):** o callback é a rota do site (`/auth/google/callback`)
      e não muda.

## 5. Virada do site

GitHub → Settings → Secrets and variables → Actions:

- [ ] Aba **Variables:** `VITE_SUPABASE_URL` = `https://pvesofbrctfipdyqyloq.supabase.co`
- [ ] Aba **Secrets:** `VITE_SUPABASE_ANON_KEY` = chave *anon public* do projeto novo
- [ ] Actions → *Deploy VextriaHub (Oracle)* → **Run workflow**

## 6. Conferência final

- [ ] `conferir.sql` no projeto novo: contagens iguais a `contagens.txt`, "FKs com órfãos: 0"
- [ ] `select jobname, schedule from cron.job order by 1;` → 8 robôs
- [ ] `select name from vault.decrypted_secrets order by 1;` → `project_url`,
      `robot_secret`, `service_role_key`
- [ ] Login com uma conta real; abrir Dashboard, Clientes, Financeiro e Publicações
- [ ] Foto de perfil e logo do escritório aparecem (Storage)
- [ ] No dia seguinte: `select * from cron.job_run_details order by start_time desc limit 20;`

Só depois disso: apagar `.migracao-supabase/` e, quando quiser, o projeto antigo.
