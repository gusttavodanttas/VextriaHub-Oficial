// Envia para o projeto NOVO os arquivos do backup do Storage baixado do painel
// (zip `<ref>.storage.zip`, já extraído). Mantém bucket e caminho — assim as URLs
// públicas gravadas no banco (fotos de perfil, logos) continuam válidas.
//
// Os buckets em si vêm no 02-dados.sql (linhas de storage.buckets); este script só
// sobe os arquivos. Idempotente (upsert): pode rodar de novo se cair no meio.
//
// Uso (na raiz do repositório, com `npm install` já feito):
//   unzip mzhnlhfxfoigkqgxseeu.storage.zip -d /tmp/storage-antigo
//   NEW_URL=https://<ref-novo>.supabase.co NEW_SERVICE_KEY=... \
//   node scripts/migracao-supabase/enviar-storage.mjs /tmp/storage-antigo/mzhnlhfxfoigkqgxseeu
//
// O argumento é a pasta cujo conteúdo são os buckets (ex.: .../uploads/avatars/...).
import { createClient } from "@supabase/supabase-js";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, extname } from "node:path";

const { NEW_URL, NEW_SERVICE_KEY } = process.env;
const raiz = process.argv[2];
if (!NEW_URL || !NEW_SERVICE_KEY || !raiz) {
  console.error("Defina NEW_URL e NEW_SERVICE_KEY e passe a pasta extraída do zip (a que contém os buckets).");
  process.exit(1);
}

const TIPOS = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml", ".pdf": "application/pdf" };
const novo = createClient(NEW_URL, NEW_SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

async function arquivos(dir) {
  const saida = [];
  for (const nome of await readdir(dir)) {
    const p = join(dir, nome);
    if ((await stat(p)).isDirectory()) saida.push(...(await arquivos(p)));
    else saida.push(p);
  }
  return saida;
}

const lista = await arquivos(raiz);
console.log(`${lista.length} arquivo(s) em ${raiz}`);
const falhas = [];
for (const caminho of lista) {
  // Primeiro segmento relativo = bucket; o resto = caminho dentro do bucket.
  const [bucket, ...resto] = relative(raiz, caminho).split(/[\\/]/);
  const destino = resto.join("/");
  const { error } = await novo.storage.from(bucket).upload(destino, await readFile(caminho), {
    upsert: true,
    contentType: TIPOS[extname(caminho).toLowerCase()] ?? "application/octet-stream",
  });
  if (error) falhas.push(`${bucket}/${destino}: ${error.message}`);
  else console.log(`ok  ${bucket}/${destino}`);
}
if (falhas.length) {
  console.error(`\n${falhas.length} falha(s):\n- ${falhas.join("\n- ")}`);
  process.exit(1);
}
console.log("\nStorage enviado sem falhas.");
