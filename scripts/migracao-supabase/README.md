# Migração completa para outro projeto Supabase

Roteiro para mover o VextriaHub do projeto `mzhnlhfxfoigkqgxseeu` (VextriaJus)
para `pvesofbrctfipdyqyloq`, **com dados e usuários**. Os usuários mantêm as
senhas, mas todos precisam **entrar de novo** (as sessões são assinadas com a
chave do projeto antigo).

> Os arquivos gerados na migração (`.migracao-supabase/`, `.env.funcoes`) contêm
> **dados reais e segredos** e estão no `.gitignore`. Apague-os ao terminar.

## Antes de começar

- [ ] **Projeto antigo ativo.** Ele está pausado; reative em Dashboard → projeto →
      *Restore project*. O dump só funciona com ele no ar.
- [ ] **Escolha a janela.** O que for gravado no projeto antigo depois do dump
      (passo 1) **não vai** para o novo. Faça o dump e a virada do deploy no mesmo
      período, de preferência à noite.
- [ ] **Ferramentas:** Supabase CLI (`npx supabase`), `psql` e Node 18+.
- [ ] **Connection strings** dos dois bancos: Settings → Database → *Connection
      string* (modo *Session pooler*), com a senha do banco de cada projeto.

## 1. Banco, usuários, functions e segredos — `migrar.sh`

```sh
export OLD_DB_URL='postgresql://...antigo...'
export NEW_DB_URL='postgresql://...novo...'
export NEW_REF=pvesofbrctfipdyqyloq
bash scripts/migracao-supabase/migrar.sh
```

O script pede confirmação em cada etapa:

1. **Dump** do antigo: roles, schema (tabelas, RLS, funções, triggers) e dados.
   Os dados incluem `auth.users` (com os hashes das senhas) e os metadados do
   Storage.
2. **Restore** no novo, numa única transação. Se algo falhar, nada fica pela metade.
3. **Histórico de migrations:** marca todas as migrations já existentes como aplicadas.
   O schema veio pelo dump.
4. **Vault + migrations novas:** cria os 3 secrets do vault (comandos mostrados
   na tela) e aplica `20261008000000_crons_url_pelo_vault.sql`, que recria os
   8 robôs apontando para o projeto novo.
5. **Edge functions + segredos:** publica as 24 functions do repositório e os
   segredos de `.env.funcoes` (modelo em `.env.funcoes.example`).
   Os valores do projeto antigo **não podem ser lidos de volta** no painel; use
   os originais (Asaas, Google Cloud, Resend, OpenAI etc.).

> As functions `super-worker`, `regex-canary` e `asaas-sandbox-test` existem no
> projeto antigo mas **não estão no repositório**, então não são migradas.
> Se alguma for necessária, baixe com `npx supabase functions download <nome>
> --project-ref mzhnlhfxfoigkqgxseeu` antes.

## 2. Arquivos do Storage — `copiar-storage.mjs`

O dump leva só os metadados; os arquivos (fotos de perfil, imagens do bucket
`uploads`) são copiados por este script:

```sh
OLD_URL=https://mzhnlhfxfoigkqgxseeu.supabase.co OLD_SERVICE_KEY=... \
NEW_URL=https://pvesofbrctfipdyqyloq.supabase.co NEW_SERVICE_KEY=... \
node scripts/migracao-supabase/copiar-storage.mjs
```

As chaves `service_role` ficam em Settings → API. O script é idempotente: pode rodar de novo.

## 3. Painel do Supabase (projeto novo)

- [ ] **Authentication → URL Configuration:** *Site URL*
      `https://www.vextriahub.com.br` e as mesmas *Redirect URLs* do projeto
      antigo (no mínimo `https://www.vextriahub.com.br/**`).
- [ ] **Authentication → SMTP / Email Templates:** copie a configuração de
      envio (remetente, SMTP) e os templates do projeto antigo.
- [ ] **Authentication → Providers:** mesmas opções (confirmação de e-mail etc.).

## 4. Serviços externos

- [ ] **Asaas → Integrações → Webhooks:** troque a URL para
      `https://pvesofbrctfipdyqyloq.supabase.co/functions/v1/asaas-webhook`,
      mantendo o mesmo token (`ASAAS_WEBHOOK_TOKEN`).
- [ ] **VextriaZap (bridge do WhatsApp):** se o bridge chama as functions
      `zap-link`/`zap-bridge`, aponte-o para a URL do projeto novo.
- [ ] **Google Cloud (OAuth):** o callback é a rota do site
      (`/auth/google/callback`) e não muda; só confira se o client continua o mesmo.

## 5. Virada do site

No GitHub: Settings → Secrets and variables → Actions.

- [ ] Aba **Variables:** `VITE_SUPABASE_URL` = `https://pvesofbrctfipdyqyloq.supabase.co`
- [ ] Aba **Secrets:** atualize `VITE_SUPABASE_ANON_KEY` com a chave *anon public*
      do projeto novo
- [ ] Actions → *Deploy VextriaHub (Oracle)* → **Run workflow**

## 6. Conferência

No SQL Editor dos **dois** projetos, as contagens devem bater:

```sql
select 'auth.users' t, count(*) from auth.users
union all select 'offices', count(*) from offices
union all select 'clientes', count(*) from clientes
union all select 'processos', count(*) from processos
union all select 'prazos', count(*) from prazos
union all select 'financeiro', count(*) from financeiro
union all select 'publicacoes', count(*) from publicacoes
union all select 'storage.objects', count(*) from storage.objects;
```

No projeto novo:

```sql
select jobname, schedule from cron.job order by jobname;          -- 8 robôs
select name from vault.decrypted_secrets order by name;           -- 3 secrets
```

- [ ] Login com uma conta real no site, abrir Dashboard, Clientes, Financeiro e
      Publicações
- [ ] Foto de perfil aparece (Storage)
- [ ] No dia seguinte: os robôs rodaram (`select * from cron.job_run_details
      order by start_time desc limit 20;`)

Só depois de tudo conferido: pause o projeto antigo e apague `.migracao-supabase/`.
