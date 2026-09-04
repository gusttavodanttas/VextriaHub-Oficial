#!/usr/bin/env bash
# Roda os testes de RLS deste diretório contra um Postgres DESCARTÁVEL, local.
#
# NÃO é `supabase test db` (que precisa do stack local inteiro via Docker —
# indisponível em ambientes com rede restrita, como o sandbox onde este teste
# foi escrito e validado). Aqui basta psql + a extensão pgtap: cria um banco
# temporário, carrega fixture.sql (schema mínimo, ver comentário no topo do
# arquivo) e roda os *.test.sql com pg_prove — depois derruba o banco.
#
# Uso:
#   ./run.sh                              # usa/cria um Postgres local (sudo)
#   PGHOST=... PGPORT=... PGUSER=... ./run.sh   # aponta pra um Postgres já rodando
#
# Requisitos (Ubuntu/Debian): postgresql-16, postgresql-16-pgtap, pg_prove
#   sudo apt-get install -y postgresql-16 postgresql-16-pgtap libtap-parser-sourcehandler-pgtap-perl
set -euo pipefail
cd "$(dirname "$0")"

DB=rls_standalone_test_$$
PSQL=(psql -v ON_ERROR_STOP=1 -d "$DB")
SUDO=""
if [ -z "${PGHOST:-}" ] && ! psql -lqt >/dev/null 2>&1; then
  SUDO="sudo -u postgres"  # sem PGHOST explícito e sem acesso direto: usa o cluster local via postgres
fi

cleanup() { $SUDO psql -v ON_ERROR_STOP=0 -c "drop database if exists \"$DB\";" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "→ criando banco descartável $DB"
$SUDO psql -c "create database \"$DB\";"
$SUDO psql -d "$DB" -c "create extension if not exists pgcrypto; create extension if not exists pgtap;"

echo "→ carregando fixture (schema mínimo + funções/policies verbatim das migrations)"
$SUDO psql -d "$DB" -v ON_ERROR_STOP=1 < fixture.sql > /dev/null

echo "→ rodando testes"
if command -v pg_prove >/dev/null 2>&1; then
  # shellcheck disable=SC2086
  $SUDO pg_prove -d "$DB" *.test.sql
else
  # Sem pg_prove instalado: roda via psql puro (TAP cru, sem sumário bonito).
  for f in *.test.sql; do
    echo "-- $f --"
    $SUDO psql -d "$DB" -t -A -v ON_ERROR_STOP=1 -f "$f"
  done
fi
