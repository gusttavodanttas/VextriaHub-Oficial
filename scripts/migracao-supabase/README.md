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

## Estado em 08/10/2026

O banco **já foi restaurado** no projeto novo (pelo painel do Supabase): as 52
tabelas batem linha a linha com o backup, policies/triggers/RLS idênticos,
102 chaves estrangeiras sem órfãos, 13 usuários e os metadados do Storage. O
secret `project_url` já está no vault. **Não rodar o passo 1/2 do `migrar.sh`**
(recarregaria dados em cima dos existentes). Falta:

- [x] vault: `service_role_key` e `robot_secret` (SQL Editor, valores do projeto novo)
- [x] migration dos crons (`20261008000000`) → 8 robôs
- [x] logs antigos de `cron.job_run_details` apagados (ver "Crons agendados mas
      sem executar" abaixo) — primeira execução confirmada em 08/10 10:45 UTC
- [x] edge functions: workflow **Deploy Edge Functions (Supabase)** (seção 1b) — 24 publicadas
- [ ] segredos das functions (Dashboard → Edge Functions → Manage secrets) — enquanto
      faltarem, os robôs respondem 500 (`RESEND_API_KEY ausente`, `google-nao-configurado`)
- [x] arquivos do Storage (seção 2) — o restore trouxe só os registros; arquivos
      enviados em 09/10 e hosts de `logo_url`/`avatar_url` trocados
- [x] Auth no painel (seção 3), Asaas (seção 4), virada do site (seção 5) — concluídos em 08/10

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
   `cron.job` (8 robôs). Se o banco foi restaurado **pelo painel** (backup
   inteiro, não pelo `02-dados.sql`), ler antes "Crons agendados mas sem executar".
5. **Edge functions + segredos (via CLI local):** publica as 24 functions e os
   segredos de `.env.funcoes` (modelo em `.env.funcoes.example`). Alternativa sem
   CLI local: a seção 1b abaixo. Os valores dos segredos do projeto antigo **não
   podem ser lidos de volta** no painel; use os originais.

> `super-worker`, `regex-canary` e `asaas-sandbox-test` existiam só no projeto
> antigo e não estão no repositório; com ele pausado, não há como baixá-las.

## 1b. Edge functions pelo GitHub Actions (sem CLI na máquina)

`.github/workflows/deploy-functions.yml` publica as 24 functions com a CLI oficial,
direto do repositório. Quais dispensam JWT está em `supabase/config.toml`
(`[functions.<nome>] verify_jwt = false`).

1. Gerar um token em https://supabase.com/dashboard/account/tokens.
2. GitHub → Settings → Secrets and variables → Actions → **Secrets** →
   `SUPABASE_ACCESS_TOKEN` = o token. (Opcional, aba **Variables**:
   `SUPABASE_PROJECT_REF` = `pvesofbrctfipdyqyloq`; sem ela usa o `config.toml`.)
3. Actions → *Deploy Edge Functions (Supabase)* → **Run workflow**.
4. Dashboard → Edge Functions → **Manage secrets**: cadastrar os segredos de
   `.env.funcoes.example` (os valores reais, que só você tem).

## 2. Arquivos do Storage — `enviar-storage.mjs`

```sh
unzip mzhnlhfxfoigkqgxseeu.storage.zip -d /tmp/storage-antigo
NEW_URL=https://pvesofbrctfipdyqyloq.supabase.co NEW_SERVICE_KEY=... \
node scripts/migracao-supabase/enviar-storage.mjs /tmp/storage-antigo/mzhnlhfxfoigkqgxseeu
```

A chave `service_role` fica em Settings → API. O bucket já existe (veio no
`02-dados.sql`); o script só sobe os arquivos, com os mesmos caminhos.
(`copiar-storage.mjs` é a variante para quando o projeto de origem está no ar.)

> **Restore pelo painel:** ele traz os *registros* de `storage.objects`, mas não os
> arquivos — as URLs públicas respondem 404 e esses registros órfãos barram o
> upload com o mesmo nome (409). Não dá para apagá-los por SQL
> (`storage.protect_delete`); apague pela API, com a `service_role`:
> `DELETE /storage/v1/object/uploads/<caminho>`. Depois suba os arquivos.

**URLs absolutas gravadas no banco.** `offices.logo_url` e `profiles.avatar_url`
guardam a URL pública completa, com o host do projeto antigo — as imagens só
voltam a aparecer depois de trocar o host:

```sql
update public.offices  set logo_url   = replace(logo_url,   'https://<ref-antigo>.supabase.co', 'https://<ref-novo>.supabase.co') where logo_url   like '%<ref-antigo>%';
update public.profiles set avatar_url = replace(avatar_url, 'https://<ref-antigo>.supabase.co', 'https://<ref-novo>.supabase.co') where avatar_url like '%<ref-antigo>%';
```

Para garantir que não sobrou referência em outra coluna (texto ou jsonb):

```sql
create temp table _achados (tabela text, coluna text, n bigint) on commit drop;
do $$ declare r record; n bigint; begin
  for r in select table_name, column_name from information_schema.columns
           where table_schema = 'public' and data_type in ('text','character varying','jsonb','json') loop
    execute format('select count(*) from public.%I where %I::text like %L', r.table_name, r.column_name, '%<ref-antigo>%') into n;
    if n > 0 then insert into _achados values (r.table_name, r.column_name, n); end if;
  end loop; end $$;
select * from _achados;  -- esperado: nenhuma linha
```

## 3. Painel do Supabase (projeto novo)

- [x] **Authentication → URL Configuration:** *Site URL* `https://www.vextriahub.com.br`
      e *Redirect URLs* com `https://www.vextriahub.com.br/**` (vieram no restore pelo painel).
- [ ] **Authentication → SMTP:** NÃO vem no restore. Com o Resend (domínio já
      verificado): host `smtp.resend.com`, porta `465`, usuário `resend`, senha =
      chave `re_…`, remetente `avisos@vextriahub.com.br` / "VextriaHub".
- [ ] **Authentication → Email Templates:** colar os de `supabase/templates/`
      (assunto + corpo; tabela abaixo). `supabase/config.toml` aponta para os
      mesmos arquivos no ambiente local.
- [ ] **Authentication → Providers → Email:** mesmas opções (confirmação de e-mail etc.).

| Template no painel | Arquivo | Assunto |
| --- | --- | --- |
| Confirm sign up | `confirmacao.html` | Confirme seu e-mail no VextriaHub |
| Reset password | `recuperacao.html` | Redefinir sua senha do VextriaHub |
| Magic link | `link-magico.html` | Seu link de acesso ao VextriaHub |
| Change email address | `troca-de-email.html` | Confirme a troca de e-mail no VextriaHub |
| Invite user | `convite.html` | Você foi convidado para o VextriaHub |
| Reauthentication | `reautenticacao.html` | Seu código de confirmação do VextriaHub |

Os convites de membro do escritório **não** passam por esse template: vão pela
function `send-invite-email` (Resend). O "Invite user" só vale para convites
feitos direto no painel do Supabase.

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
- [ ] Foto de perfil e logo do escritório aparecem (Storage) — se não, ver "URLs
      absolutas gravadas no banco" na seção 2
- [ ] No dia seguinte: `select * from cron.job_run_details order by start_time desc limit 20;`

Só depois disso: apagar `.migracao-supabase/` e, quando quiser, o projeto antigo.

## 7. Operação depois da migração (09/10/2026)

Migration `20261009030000_operacao_pos_migracao.sql` (aplicada):

- `zap-pull-leads` **pausado** (`active = false`) enquanto o bridge do VextriaZap
  não existe; reativar com
  `select cron.alter_job(jobid, active := true) from cron.job where jobname = 'zap-pull-leads';`
- `limpar-cron-log` (03:00 UTC): apaga `cron.job_run_details` com mais de 30 dias.
- `robo-alertas-horario` (xx:05): toda resposta de pg_net com status ≥ 400, sem
  status, timeout ou erro de transporte vira uma notificação in-app ("Robô com
  erro", tipo `error`) para cada super admin, registrada em `robo_alertas_log`
  para não repetir. `pg_net.ttl` é 6 h, por isso a varredura é horária.

Function temporária `restaurar-storage`: apagar pelo workflow **Apagar Edge
Function (Supabase)** (Actions → Run workflow → `restaurar-storage`). O workflow
recusa nomes que existam em `supabase/functions/`.

## Crons agendados mas sem executar (restore pelo painel)

Sintoma: `cron.job` lista os 8 robôs, mas `cron.job_run_details` não ganha
nenhuma linha nova e, no log do Postgres (Logs → Postgres), a cada minuto de
disparo aparece:

```
duplicate key value violates unique constraint "job_run_details_pkey"
background worker "pg_cron launcher" exited with exit code 1
pg_cron scheduler started
```

Causa: o restore pelo painel carrega também o histórico de execuções do projeto
antigo em `cron.job_run_details` (milhares de linhas, `runid` até 6054), mas a
sequência `cron.runid_seq` do projeto novo continua do zero. Na primeira
execução o agendador tenta gravar um `runid` que já existe, morre e é
reiniciado um segundo depois — e nunca executa job nenhum. O papel `postgres`
**não tem permissão** para `setval` nessa sequência (dona: `supabase_admin`),
mas pode apagar as linhas. Correção, no SQL Editor:

```sql
delete from cron.job_run_details;   -- histórico do projeto antigo (continua no backup)
```

No disparo seguinte os jobs rodam e o histórico recomeça. (`extrair-do-backup.py`
não copia o schema `cron`, então o caminho pelo `migrar.sh` não tem esse problema.)
