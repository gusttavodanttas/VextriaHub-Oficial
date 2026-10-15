# Põe no ar a integração de Jurisprudência no projeto de PRODUÇÃO do VextriaHub (pvesofbrctfipdyqyloq).
# Pré-requisito: `supabase login` feito com a conta contato@vextriahub.com.br (a dona do projeto).
# O que faz: (1) publica as funções juris-sync e ai-advisor; (2) grava o segredo JURIS_SYNC_SECRET lendo
# a 2ª linha de config\vextriahub.sync do JurisKit (o mesmo segredo que o kit usa para enviar os registros).
# A MIGRAÇÃO do banco (deploy\jurisprudencia-migracao.sql) é aplicada à parte, no SQL Editor — veja o passo 1 no chat.
$ErrorActionPreference = "Stop"
$ref = "pvesofbrctfipdyqyloq"
$repo = Split-Path -Parent $PSScriptRoot
$kitCfg = "C:\Users\conta\Downloads\juriskit\juris-kit\config\vextriahub.sync"

if (-not (Test-Path $kitCfg)) { throw "Nao achei $kitCfg (linha 1 URL do Supabase, linha 2 segredo)." }
$linhas = Get-Content $kitCfg | Where-Object { $_.Trim() -ne "" }
if ($linhas.Count -lt 2) { throw "config\vextriahub.sync precisa de 2 linhas (URL e segredo)." }
$segredo = $linhas[1].Trim()

Set-Location $repo
Write-Host "== 1/3 Publicando juris-sync (autenticacao propria por segredo; sem JWT) =="
supabase functions deploy juris-sync --project-ref $ref --no-verify-jwt
if ($LASTEXITCODE -ne 0) { throw "falhou o deploy de juris-sync" }

Write-Host "== 2/3 Publicando ai-advisor (ferramenta e modo novos) =="
supabase functions deploy ai-advisor --project-ref $ref
if ($LASTEXITCODE -ne 0) { throw "falhou o deploy de ai-advisor" }

Write-Host "== 3/3 Gravando o segredo JURIS_SYNC_SECRET =="
supabase secrets set "JURIS_SYNC_SECRET=$segredo" --project-ref $ref
if ($LASTEXITCODE -ne 0) { throw "falhou ao gravar o segredo" }

Write-Host ""
Write-Host "Pronto. Agora: (a) se ainda nao aplicou, rode deploy\jurisprudencia-migracao.sql no SQL Editor;"
Write-Host "(b) no JurisKit, duplo clique em 8-sincronizar-vextriahub-windows.bat para a primeira carga."
