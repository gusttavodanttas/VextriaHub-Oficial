// Copia os ARQUIVOS do Supabase Storage do projeto antigo para o novo.
// O dump do banco leva só os metadados (storage.objects) — os arquivos em si
// ficam no S3 de cada projeto e precisam ser baixados e reenviados.
//
// Uso (na raiz do repositório, com `npm install` já feito):
//   OLD_URL=https://<ref-antigo>.supabase.co OLD_SERVICE_KEY=... \
//   NEW_URL=https://<ref-novo>.supabase.co   NEW_SERVICE_KEY=... \
//   node scripts/migracao-supabase/copiar-storage.mjs [bucket ...]
//
// Sem argumentos copia todos os buckets do projeto antigo. Idempotente
// (upsert): pode rodar de novo se cair no meio.
import { createClient } from "@supabase/supabase-js";

const { OLD_URL, OLD_SERVICE_KEY, NEW_URL, NEW_SERVICE_KEY } = process.env;
if (!OLD_URL || !OLD_SERVICE_KEY || !NEW_URL || !NEW_SERVICE_KEY) {
  console.error("Defina OLD_URL, OLD_SERVICE_KEY, NEW_URL e NEW_SERVICE_KEY.");
  process.exit(1);
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const antigo = createClient(OLD_URL, OLD_SERVICE_KEY, opts);
const novo = createClient(NEW_URL, NEW_SERVICE_KEY, opts);

// Lista recursivamente: no Storage, "pastas" vêm sem `id`.
async function listarTudo(bucket, prefixo = "") {
  const arquivos = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await antigo.storage.from(bucket).list(prefixo, { limit: 1000, offset });
    if (error) throw new Error(`listar ${bucket}/${prefixo}: ${error.message}`);
    for (const item of data) {
      const caminho = prefixo ? `${prefixo}/${item.name}` : item.name;
      if (item.id === null) arquivos.push(...(await listarTudo(bucket, caminho)));
      else arquivos.push({ caminho, tipo: item.metadata?.mimetype });
    }
    if (data.length < 1000) break;
  }
  return arquivos;
}

async function garantirBucket(bucket) {
  const { data: origem, error } = await antigo.storage.getBucket(bucket);
  if (error) throw new Error(`ler bucket ${bucket}: ${error.message}`);
  const { error: existe } = await novo.storage.getBucket(bucket);
  if (!existe) return;
  const { error: criar } = await novo.storage.createBucket(bucket, {
    public: origem.public,
    fileSizeLimit: origem.file_size_limit ?? undefined,
    allowedMimeTypes: origem.allowed_mime_types ?? undefined,
  });
  if (criar) throw new Error(`criar bucket ${bucket}: ${criar.message}`);
  console.log(`bucket criado no projeto novo: ${bucket} (público: ${origem.public})`);
}

async function copiarBucket(bucket) {
  await garantirBucket(bucket);
  const arquivos = await listarTudo(bucket);
  console.log(`${bucket}: ${arquivos.length} arquivo(s)`);
  let ok = 0;
  const falhas = [];
  for (const { caminho, tipo } of arquivos) {
    const { data: blob, error: baixar } = await antigo.storage.from(bucket).download(caminho);
    if (baixar) { falhas.push(`${caminho} (download: ${baixar.message})`); continue; }
    const { error: subir } = await novo.storage.from(bucket).upload(caminho, blob, { upsert: true, contentType: tipo });
    if (subir) { falhas.push(`${caminho} (upload: ${subir.message})`); continue; }
    ok++;
  }
  console.log(`${bucket}: ${ok}/${arquivos.length} copiado(s)`);
  return falhas;
}

let buckets = process.argv.slice(2);
if (buckets.length === 0) {
  const { data, error } = await antigo.storage.listBuckets();
  if (error) { console.error(`listar buckets: ${error.message}`); process.exit(1); }
  buckets = data.map((b) => b.name);
}

const falhas = [];
for (const b of buckets) falhas.push(...(await copiarBucket(b)));
if (falhas.length) {
  console.error(`\n${falhas.length} falha(s):\n- ${falhas.join("\n- ")}`);
  process.exit(1);
}
console.log("\nStorage copiado sem falhas.");
