# Deploy do VextriaHub no Oracle (Caddy) — setup único

O front é um SPA estático (Vite → `dist/`). O GitHub Actions (`.github/workflows/deploy-oracle.yml`)
builda e joga o `dist/` no servidor a cada push. O Caddy serve os arquivos com fallback pro
`index.html` (rotas do React). Faça os passos abaixo **uma vez**; depois é só dar push.

## 1) No servidor Oracle (via SSH) — pasta + Caddy

Entre no servidor e crie a pasta do site:

```bash
mkdir -p /home/ubuntu/vextriahub-site
```

Abra o Caddyfile (geralmente `/etc/caddy/Caddyfile`) e **adicione este bloco** (além do que já
existe pro Vextria Zap — o Caddy hospeda vários sites, um bloco por domínio):

```caddy
vextriahub.com.br, www.vextriahub.com.br {
    root * /home/ubuntu/vextriahub-site
    encode gzip

    # arquivos com hash no nome (imutáveis) → cache eterno
    @assets path /assets/*
    header @assets Cache-Control "public, max-age=31536000, immutable"

    # index.html nunca é cacheado → todo deploy novo aparece na hora
    # (foi exatamente o problema que tivemos com a Vercel servindo HTML velho)
    header /index.html Cache-Control "no-cache"

    try_files {path} /index.html
    file_server
}
```

Recarregue o Caddy (sem derrubar nada):

```bash
sudo systemctl reload caddy
```

> O Caddy cuida do HTTPS sozinho (Let's Encrypt) assim que o DNS (passo 3) apontar pra cá.

## 2) No GitHub — 2 secrets

Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Valor |
|---|---|
| `VITE_SUPABASE_ANON_KEY` | a chave **anon public** (Supabase → Project Settings → API) |
| `ORACLE_SSH_KEY` | o **conteúdo** da sua chave privada SSH do Oracle (o arquivo que você usa pra entrar; cole o texto inteiro, incluindo `-----BEGIN...` e `-----END...`) |

(O `VITE_SUPABASE_URL` e o IP/usuário do servidor já estão fixos no workflow — não são secretos.)

## 3) DNS — apontar o domínio pro Oracle

No seu registrador do `vextriahub.com.br`, troque os registros que hoje apontam pra Vercel por
registros **A** apontando pro IP do Oracle:

```
A   @     147.15.10.89
A   www   147.15.10.89
```

(Remova os CNAME/registros antigos da Vercel.) Pode levar de minutos a algumas horas pra propagar.

## 4) Firewall do Oracle (importante pro deploy automático)

O GitHub Actions precisa **entrar por SSH (porta 22)** no servidor. Na Oracle Cloud, a
**Security List / Network Security Group** da instância precisa permitir entrada na porta 22.
Se hoje só o seu IP entra, libere a 22 para `0.0.0.0/0` (com login **só por chave**, sem senha,
é seguro o suficiente; recomendável ter `fail2ban`).

> Se você **não quiser** abrir a 22 pro mundo, use o **deploy manual** abaixo (sai da sua máquina,
> pelo seu IP, sem mexer no firewall).

## Pronto — como publicar daqui pra frente
Só dar `git push` na `main`. O Actions builda e publica sozinho. Dá pra acompanhar/rodar manual em
**Actions → "Deploy VextriaHub (Oracle)" → Run workflow**.

---

## Plano B — deploy manual (sem firewall, da sua máquina)

Se preferir não abrir a porta 22, publique da sua máquina. Uma vez, crie `.env.local` na raiz do
projeto com as 2 variáveis:

```
VITE_SUPABASE_URL=https://mzhnlhfxfoigkqgxseeu.supabase.co
VITE_SUPABASE_ANON_KEY=coloque_a_anon_key_aqui
```

Depois, a cada publicação (PowerShell, na pasta do projeto):

```powershell
npm run build
scp -i "C:\Users\conta\Downloads\SUA_CHAVE.pem" -r dist/* ubuntu@147.15.10.89:/home/ubuntu/vextriahub-site/
```

(Troque `SUA_CHAVE.pem` pelo nome real da sua chave em Downloads.)
