# Deploy do VextriaHub no Oracle (Caddy em Docker) — setup

O front é um SPA estático (Vite → `dist/`). O GitHub Actions
(`.github/workflows/deploy-oracle.yml`) builda e envia o `dist/` pro servidor a cada push.
O **Caddy roda em Docker** (`n8n-deploy-caddy-1`), config em `/home/ubuntu/n8n-deploy/Caddyfile`,
sites em `/home/ubuntu/n8n-deploy/site/` (uma subpasta por site). O VextriaHub vai em
`site/_vextriahub` → servido pelo Caddy em `/srv/site/_vextriahub`.

## ✅ Já feito no servidor (agosto/2026)
- Pasta `/home/ubuntu/n8n-deploy/site/_vextriahub` criada (com placeholder).
- Bloco no Caddyfile pro domínio de **teste** `hub.147.15.10.89.sslip.io` (backup + `caddy validate`
  antes do reload; os outros 3 sites — Zap, meuvextria, espacowr — ficaram intactos).
- Testado e no ar com HTTPS: **https://hub.147.15.10.89.sslip.io**.

## Falta você fazer

### 1) Dois secrets no GitHub
Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Valor |
|---|---|
| `VITE_SUPABASE_ANON_KEY` | a chave **anon public** (Supabase → Project Settings → API) |
| `ORACLE_SSH_KEY` | o **conteúdo** de `C:\Users\conta\.ssh\oracle.key` (a chave privada do Oracle; cole o texto inteiro, do `-----BEGIN` ao `-----END`) |

### 2) Firewall do Oracle — porta 22 pro GitHub Actions
O runner do Actions precisa entrar por SSH. Na Oracle Cloud, a **Security List** da instância
precisa permitir ingress na **porta 22** (de `0.0.0.0/0`; com login só por chave é seguro o
suficiente). Se não quiser abrir, use o **plano B** (deploy manual, abaixo).

### 3) Rodar o primeiro deploy
GitHub → **Actions → "Deploy VextriaHub (Oracle)" → Run workflow**. Fica **verde** → o app real
substitui a placeholder. Recarregue **https://hub.147.15.10.89.sslip.io** e teste o login/uso.

### 4) DNS (só quando o teste acima estiver ok)
No registrador do `vextriahub.com.br`, troque os registros da Vercel por **A → 147.15.10.89**
(`@` e `www`). Depois me avisa que eu **adiciono `vextriahub.com.br` no bloco do Caddy** (hoje só
tem o sslip.io de teste; assim o Caddy só tenta o certificado do domínio real quando ele já aponta
pra cá, sem erros de ACME).

## Como publicar daqui pra frente
Só `git push` na `main`. O Actions builda e publica sozinho.

---

## Plano B — deploy manual (sem abrir a porta 22)
Uma vez, crie `.env.local` na raiz com as 2 variáveis:
```
VITE_SUPABASE_URL=https://mzhnlhfxfoigkqgxseeu.supabase.co
VITE_SUPABASE_ANON_KEY=coloque_a_anon_key_aqui
```
Depois, a cada publicação (PowerShell, na pasta do projeto):
```powershell
npm run build
scp -i "$env:USERPROFILE\.ssh\oracle.key" -r dist/* ubuntu@147.15.10.89:/home/ubuntu/n8n-deploy/site/_vextriahub/
```
