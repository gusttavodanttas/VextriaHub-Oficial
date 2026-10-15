// Conferência, antes do build, de VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY.
// A chave anon é pública (vai embutida no site), mas um valor errado no secret só
// aparece em produção como "Invalid API key" no login — sem pista de qual projeto
// ela é. Aqui decodificamos o JWT (sem validar assinatura) e comparamos o `ref`
// com o da URL; sai com erro se não baterem. Nunca imprime a chave inteira.
const url = (process.env.VITE_SUPABASE_URL || "").trim();
const bruta = process.env.VITE_SUPABASE_ANON_KEY || "";
const chave = bruta.trim();

function falhar(msg) {
  console.error(`::error::${msg}`);
  process.exit(1);
}

const refUrl = (url.match(/^https:\/\/([a-z]{20})\.supabase\.co$/) || [])[1];
if (!refUrl) falhar(`VITE_SUPABASE_URL inválida: ${JSON.stringify(url)} (esperado https://<ref>.supabase.co, sem barra no final)`);
if (!chave) falhar("Secret VITE_SUPABASE_ANON_KEY vazio ou ausente (Settings → Secrets and variables → Actions → aba Secrets)");
if (bruta !== chave) console.log("::warning::VITE_SUPABASE_ANON_KEY tem espaço/quebra de linha nas pontas — recadastre sem eles");

if (chave.startsWith("sb_publishable_")) {
  console.log(`Chave: publishable (sb_publishable_…), ${chave.length} caracteres — o ref não vem na chave; confira no painel do projeto ${refUrl}`);
} else {
  let payload;
  try {
    payload = JSON.parse(Buffer.from(chave.split(".")[1], "base64url").toString("utf8"));
  } catch {
    falhar(`VITE_SUPABASE_ANON_KEY não é um JWT nem uma chave sb_publishable_ (${chave.length} caracteres)`);
  }
  console.log(`Chave: legacy JWT, ref=${payload.ref}, role=${payload.role}, ${chave.length} caracteres`);
  if (payload.role !== "anon") falhar(`A chave cadastrada tem role=${payload.role}; o site precisa da anon (nunca a service_role)`);
  if (payload.ref !== refUrl) falhar(`A chave anon é do projeto ${payload.ref}, mas VITE_SUPABASE_URL aponta para ${refUrl} — cadastre a anon de ${refUrl}`);
}
console.log(`Projeto: ${refUrl} — URL e chave conferem.`);
