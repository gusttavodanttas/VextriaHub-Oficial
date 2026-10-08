#!/usr/bin/env bash
# Migração completa do VextriaHub para outro projeto Supabase.
# Passo a passo e explicações: scripts/migracao-supabase/README.md
#
# Requisitos na máquina: Supabase CLI (`npx supabase` serve), psql, Node 18+.
# Variáveis (NUNCA versionar os valores):
#   OLD_DB_URL  connection string do banco ANTIGO  (Settings → Database → Connection string, "Session pooler")
#   NEW_DB_URL  connection string do banco NOVO
#   NEW_REF     ref do projeto novo (ex.: pvesofbrctfipdyqyloq)
set -euo pipefail

: "${OLD_DB_URL:?defina OLD_DB_URL}"
: "${NEW_DB_URL:?defina NEW_DB_URL}"
: "${NEW_REF:?defina NEW_REF}"

RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
TRAB="$RAIZ/.migracao-supabase"   # ignorado pelo git (contém dados reais!)
mkdir -p "$TRAB"
SB="npx --yes supabase"

confirmar() { read -r -p "$1 [s/N] " r; [[ "$r" =~ ^[sS]$ ]]; }
etapa() { printf '\n\033[1m== %s ==\033[0m\n' "$1"; }

etapa "1/5 Dump do projeto antigo (roles, schema, dados)"
if confirmar "Gerar o dump do banco antigo em $TRAB?"; then
  $SB db dump --db-url "$OLD_DB_URL" -f "$TRAB/roles.sql" --role-only
  $SB db dump --db-url "$OLD_DB_URL" -f "$TRAB/schema.sql"
  $SB db dump --db-url "$OLD_DB_URL" -f "$TRAB/data.sql" --use-copy --data-only
  ls -lh "$TRAB"
fi

etapa "2/5 Restaurar no projeto novo"
echo "O banco NOVO deve estar vazio (projeto recém-criado). Tudo roda numa única transação:"
echo "se algo falhar, nada fica pela metade."
if confirmar "Restaurar roles + schema + dados no projeto novo?"; then
  psql --single-transaction --variable ON_ERROR_STOP=1 \
    --file "$TRAB/roles.sql" \
    --file "$TRAB/schema.sql" \
    --command 'SET session_replication_role = replica' \
    --file "$TRAB/data.sql" \
    --dbname "$NEW_DB_URL"
fi

etapa "3/5 Histórico de migrations no projeto novo"
echo "O schema já veio pelo dump; marca as migrations antigas como aplicadas para o"
echo "\`db push\` aplicar só as novas (hoje: 20261008000000_crons_url_pelo_vault)."
if confirmar "Marcar as migrations já existentes como aplicadas?"; then
  for f in "$RAIZ"/supabase/migrations/*.sql; do
    v="$(basename "$f" | cut -d_ -f1)"
    [[ "$v" == "20261008000000" ]] && continue
    $SB migration repair --status applied "$v" --db-url "$NEW_DB_URL" >/dev/null
  done
  $SB migration list --db-url "$NEW_DB_URL"
fi

etapa "4/5 Vault + migrations novas"
echo "ANTES de continuar, rode no SQL Editor do projeto NOVO (valores do projeto novo):"
echo "  select vault.create_secret('https://$NEW_REF.supabase.co', 'project_url', 'URL base (crons)');"
echo "  select vault.create_secret('<service_role_key do projeto NOVO>', 'service_role_key', 'crons');"
echo "  select vault.create_secret('<ROBOT_SECRET>', 'robot_secret', 'crons');"
echo "(o vault é criptografado por projeto: os secrets do antigo NÃO vêm no dump)"
if confirmar "Vault preenchido. Aplicar as migrations pendentes (db push)?"; then
  (cd "$RAIZ" && $SB db push --db-url "$NEW_DB_URL")
fi

etapa "5/5 Edge functions + segredos"
echo "Preencha $RAIZ/scripts/migracao-supabase/.env.funcoes a partir do .env.funcoes.example."
if confirmar "Publicar as edge functions e os segredos no projeto novo?"; then
  (cd "$RAIZ" && $SB functions deploy --project-ref "$NEW_REF")
  $SB secrets set --env-file "$RAIZ/scripts/migracao-supabase/.env.funcoes" --project-ref "$NEW_REF"
  $SB secrets list --project-ref "$NEW_REF"
fi

printf '\n\033[1mBanco, functions e segredos prontos.\033[0m Próximos passos (storage, auth,\n'
printf 'Asaas, Google, deploy) no README desta pasta.\n'
echo "Depois de validar tudo, apague $TRAB (contém dados reais)."
