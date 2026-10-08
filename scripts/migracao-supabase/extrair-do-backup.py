#!/usr/bin/env python3
"""Separa um backup baixado do Supabase (db_cluster-*.backup, formato pg_dumpall)
em arquivos prontos para restaurar num projeto NOVO.

O backup inteiro não pode ser restaurado direto num projeto Supabase: ele traz
os schemas gerenciados (auth, storage, realtime, extensions, cron, vault) com
donos (supabase_admin etc.) e versões que já existem — e divergem — no projeto
de destino. Só o que é da aplicação precisa ir:

  01-schema.sql   schema `public` inteiro (tabelas, funções, policies, triggers,
                  índices, grants) + o gatilho em auth.users + as policies do
                  Storage. Sem dados.
  02-dados.sql    COPY de todas as tabelas de public, auth.users, auth.identities,
                  storage.buckets e storage.objects + os valores das sequences.
                  Carregado com session_replication_role = replica (sem triggers
                  nem checagem de FK durante a carga — a ordem não importa).
  00-stubs-local.sql  SÓ para o teste local num Postgres comum: roles, schemas,
                  tipos/tabelas/funções de auth e storage que o projeto Supabase
                  já tem. NÃO rodar no projeto Supabase.
  contagens.txt   linhas por tabela no backup, para conferir após a restauração.

Fora: sessões/refresh tokens (presos ao projeto antigo — todo mundo entra de
novo), cron.* (recriado pela migration 20261008000000), vault.* (cifrado por
projeto; recriar no SQL Editor), logs (job_run_details) e tudo o que é do Supabase.

Uso:  python3 -I extrair-do-backup.py <db_cluster.backup> <pasta-de-saida>
"""
import re
import sys
from pathlib import Path

CABECALHO = re.compile(r"^-- (Data for )?Name: (.*?); Type: (.*?); Schema: (.*?); Owner: (.*)$")

PRELUDIO = """SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;
SET default_table_access_method = heap;
"""

DADOS_FORA_DE_PUBLIC = {("auth", "users"), ("auth", "identities"), ("storage", "buckets"), ("storage", "objects")}
# Ordem de carga: pais antes dos filhos só por organização (a FK não é checada em modo replica).
ORDEM_DADOS = [("auth", "users"), ("auth", "identities"), ("storage", "buckets"), ("public", None), ("storage", "objects")]


def secoes(linhas):
    """Gera (nome, tipo, schema, dono, corpo) para cada seção do dump."""
    i, n = 0, len(linhas)
    atual = None
    while i < n:
        l = linhas[i]
        if l == "--" and i + 2 < n and linhas[i + 2] == "--":
            m = CABECALHO.match(linhas[i + 1])
            if m:
                if atual:
                    yield atual
                atual = [m.group(2), m.group(3), m.group(4), m.group(5), []]
                i += 3
                continue
        if l.startswith("-- PostgreSQL database dump complete") or l.startswith("\\connect "):
            if atual:
                yield atual
                atual = None
            i += 1
            continue
        if atual is not None:
            atual[4].append(l)
            if l.startswith("COPY ") and l.endswith("FROM stdin;"):
                # Dados verbatim até o terminador — nunca interpretar linhas de dado.
                i += 1
                while i < n and linhas[i] != "\\.":
                    atual[4].append(linhas[i])
                    i += 1
                atual[4].append("\\.")
        i += 1
    if atual:
        yield atual


def corpo_limpo(corpo):
    txt = "\n".join(corpo).strip("\n")
    return txt + "\n\n" if txt else ""


def main(origem, destino):
    linhas = Path(origem).read_text(encoding="utf-8").splitlines()
    # Só a base `postgres`; o template1 não interessa.
    inicio = next(i for i, l in enumerate(linhas) if l == "\\connect postgres")
    linhas = linhas[inicio + 1:]

    schema, dados, seqs, stubs, contagens, avisos = [], {}, [], [], {}, []
    stubs_auth_storage = {("auth", "TYPE"), ("auth", "FUNCTION"), ("auth", "TABLE"), ("auth", "CONSTRAINT"),
                          ("storage", "TYPE"), ("storage", "FUNCTION"), ("storage", "TABLE"), ("storage", "CONSTRAINT")}
    tabelas_stub = {"users", "identities", "buckets", "objects"}

    for nome, tipo, sch, dono, corpo in secoes(linhas):
        texto = corpo_limpo(corpo)
        if not texto:
            continue
        if tipo == "TABLE DATA":
            if sch == "public" or (sch, nome) in DADOS_FORA_DE_PUBLIC:
                dados[(sch, nome)] = texto
                contagens[f"{sch}.{nome}"] = sum(1 for l in corpo if l and not l.startswith("COPY ") and l != "\\.")
            continue
        if sch == "public":
            if tipo == "SEQUENCE SET":
                seqs.append(texto)
                continue
            if "OWNER TO supabase_admin" in texto:
                # `postgres` não é membro de supabase_admin no projeto novo — o ALTER OWNER falharia.
                avisos.append(f"dono trocado para postgres: {tipo} {nome}")
                texto = texto.replace("OWNER TO supabase_admin", "OWNER TO postgres")
            if tipo == "DEFAULT ACL" and "FOR ROLE supabase_admin" in texto:
                avisos.append(f"ignorado (FOR ROLE supabase_admin): {tipo} {nome}")
                continue
            schema.append(texto)
            continue
        if sch == "auth" and tipo == "TRIGGER":
            schema.append(texto)          # on_auth_user_created → public.handle_new_user()
            continue
        if sch == "storage" and tipo == "POLICY":
            schema.append(texto)          # policies do bucket `uploads`
            continue
        # Stubs do teste local: o mínimo de auth/storage que o schema/dados referenciam.
        if (sch, tipo) in stubs_auth_storage:
            if tipo in ("TABLE", "CONSTRAINT") and not any(f"{sch}.{t} " in texto or f"{sch}.{t}\n" in texto for t in tabelas_stub):
                continue
            stubs.append(texto)

    out = Path(destino)
    out.mkdir(parents=True, exist_ok=True)

    (out / "01-schema.sql").write_text(
        "-- Schema da aplicação extraído do backup do projeto antigo. Rodar ANTES do 02-dados.sql.\n"
        "-- Idempotência: não é — destino deve ser um projeto novo, sem essas tabelas.\n\n"
        + PRELUDIO + "\n" + "".join(schema), encoding="utf-8")

    partes = []
    for sch, nome in ORDEM_DADOS:
        chaves = [k for k in dados if k[0] == sch and (nome is None or k[1] == nome)]
        for k in sorted(chaves):
            partes.append(dados.pop(k))
    assert not dados, f"dados sem destino: {list(dados)}"
    (out / "02-dados.sql").write_text(
        "-- Dados extraídos do backup. Rodar DEPOIS do 01-schema.sql, numa única transação:\n"
        "--   psql --single-transaction -v ON_ERROR_STOP=1 -f 02-dados.sql \"$NEW_DB_URL\"\n"
        "-- replica: não dispara triggers (profiles já vêm do backup) nem checa FK na carga.\n\n"
        + PRELUDIO + "SET session_replication_role = replica;\n\n"
        + "".join(partes) + "".join(seqs) + "RESET session_replication_role;\n", encoding="utf-8")

    (out / "00-stubs-local.sql").write_text(
        "-- SOMENTE para testar a restauração num Postgres local. NÃO rodar no Supabase.\n\n"
        + PRELUDIO + "\n"
        + "".join(f"DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{r}') THEN CREATE ROLE {r} NOLOGIN; END IF; END $$;\n" for r in
                  ["anon", "authenticated", "service_role", "authenticator", "dashboard_user", "supabase_admin",
                   "supabase_auth_admin", "supabase_storage_admin", "supabase_realtime_admin", "supabase_read_only_user"])
        + "\n" + "".join(f"CREATE SCHEMA {s};\n" for s in ["auth", "storage", "extensions", "graphql_public", "realtime", "vault"])
        + "\nCREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;\nCREATE EXTENSION IF NOT EXISTS \"uuid-ossp\" WITH SCHEMA extensions;\n\n"
        + "".join(stubs), encoding="utf-8")

    (out / "contagens.txt").write_text(
        "".join(f"{v:6d}  {k}\n" for k, v in sorted(contagens.items())), encoding="utf-8")

    print(f"01-schema.sql: {len(schema)} seções | 02-dados.sql: {len(partes)} tabelas, {len(seqs)} sequences | stubs: {len(stubs)} seções")
    for a in avisos:
        print("aviso:", a)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
