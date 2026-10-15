#!/usr/bin/env bash
# Migração do VextriaHub para outro projeto Supabase A PARTIR DO BACKUP BAIXADO
# do painel (projeto antigo pausado). Passo a passo: scripts/migracao-supabase/README.md
#
# Requisitos na máquina: Supabase CLI (`npx supabase` serve), psql, Python 3, Node 18+.
# Variáveis (NUNCA versionar os valores):
#   BACKUP      caminho do db_cluster-*.backup (descompactado: `gunzip` no .gz)
#   NEW_DB_URL  connection string do banco NOVO (Settings → Database → "Session pooler")
#   NEW_REF     ref do projeto novo (ex.: pvesofbrctfipdyqyloq)
set -euo pipefail

: "${BACKUP:?defina BACKUP (arquivo db_cluster-*.backup)}"
: "${NEW_DB_URL:?defina NEW_DB_URL}"
: "${NEW_REF:?defina NEW_REF}"

RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
AQUI="$RAIZ/scripts/migracao-supabase"
TRAB="$RAIZ/.migracao-supabase"   # ignorado pelo git (contém dados reais!)
mkdir -p "$TRAB"
SB="npx --yes supabase"

confirmar() { read -r -p "$1 [s/N] " r; [[ "$r" =~ ^[sS]$ ]]; }
etapa() { printf '\n\033[1m== %s ==\033[0m\n' "$1"; }

etapa "1/5 Extrair schema e dados do backup"
python3 -I "$AQUI/extrair-do-backup.py" "$BACKUP" "$TRAB"
echo "Gerados em $TRAB: 01-schema.sql, 02-dados.sql, contagens.txt (00-stubs-local.sql é só para teste local)."

etapa "2/5 Restaurar no projeto novo"
echo "O banco NOVO deve estar vazio (projeto recém-criado, sem tabelas em public)."
echo "Cada arquivo roda numa única transação: se algo falhar, nada fica pela metade."
if confirmar "Aplicar 01-schema.sql no projeto novo?"; then
  psql --single-transaction --variable ON_ERROR_STOP=1 --quiet --file "$TRAB/01-schema.sql" --dbname "$NEW_DB_URL"
  echo "schema ok"
fi
if confirmar "Carregar 02-dados.sql (dados, usuários, buckets)?"; then
  psql --single-transaction --variable ON_ERROR_STOP=1 --quiet --file "$TRAB/02-dados.sql" --dbname "$NEW_DB_URL"
  echo "dados ok"
fi
if confirmar "Rodar a conferência (contagens, objetos, órfãos de FK)?"; then
  psql --variable ON_ERROR_STOP=1 --file "$AQUI/conferir.sql" --dbname "$NEW_DB_URL"
  echo "Compare as linhas por tabela com $TRAB/contagens.txt."
fi

etapa "3/5 Histórico de migrations no projeto novo"
echo "O schema veio do backup (não das migrations do repositório — elas não refletem a"
echo "produção). Marca todas como aplicadas para o \`db push\` aplicar só as novas."
if confirmar "Marcar as migrations existentes como aplicadas?"; then
  versoes=()
  for f in "$RAIZ"/supabase/migrations/*.sql; do
    v="$(basename "$f" | cut -d_ -f1)"
    [[ "$v" == "20261008000000" ]] || versoes+=("$v")
  done
  $SB migration repair --status applied "${versoes[@]}" --db-url "$NEW_DB_URL"
  $SB migration list --db-url "$NEW_DB_URL" | tail -5
fi

etapa "4/5 Vault + crons dos robôs"
echo "ANTES de continuar, rode no SQL Editor do projeto NOVO (valores do projeto novo):"
echo "  select vault.create_secret('https://$NEW_REF.supabase.co', 'project_url', 'URL base (crons)');"
echo "  select vault.create_secret('<service_role_key do projeto NOVO>', 'service_role_key', 'crons');"
echo "  select vault.create_secret('<ROBOT_SECRET>', 'robot_secret', 'crons');"
echo "(o vault é cifrado por projeto: os secrets do antigo não vêm no backup)"
if confirmar "Vault preenchido. Aplicar a migration dos crons (db push)?"; then
  (cd "$RAIZ" && $SB db push --db-url "$NEW_DB_URL")
  psql --quiet --dbname "$NEW_DB_URL" --command "select jobname, schedule from cron.job order by 1;"
fi

etapa "5/5 Edge functions + segredos"
echo "Preencha $AQUI/.env.funcoes a partir do .env.funcoes.example."
if confirmar "Publicar as edge functions e os segredos no projeto novo?"; then
  (cd "$RAIZ" && $SB functions deploy --project-ref "$NEW_REF")
  $SB secrets set --env-file "$AQUI/.env.funcoes" --project-ref "$NEW_REF"
  $SB secrets list --project-ref "$NEW_REF"
fi

printf '\n\033[1mBanco, crons, functions e segredos prontos.\033[0m Faltam: arquivos do Storage\n'
printf '(enviar-storage.mjs), Auth no painel, Asaas, deploy — ver README.\n'
echo "Depois de validar tudo, apague $TRAB (contém dados reais)."
