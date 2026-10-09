import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── juris-sync ───────────────────────────────────────────────────────────────
// Recebe lotes de registros canônicos do JurisKit (base local auditável) e grava no
// acervo GLOBAL juris_documents. Chamada pelo script do kit (sync/vextriahub_push.py),
// autenticada por segredo compartilhado (JURIS_SYNC_SECRET), nunca pelo navegador.
// Regras: tudo entra NÃO CONFERIDO (a conferência é por usuário, em juris_user_reviews);
// registros de treinamento são recusados; se o hash de um doc mudou, o conteúdo é
// atualizado (quem já tinha conferido vê o aviso pela data de sincronização).
// Depois de gravar, dispara os alertas de normas novas (juris_notify_normas).

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-juris-sync-secret",
};
const REQUIRED = ["doc_id", "source_id", "document_type", "official_url", "content_sha256", "captured_at"];
const MAX_BATCH = 500;

interface Doc { [k: string]: unknown; doc_id: string; is_training?: boolean; official_url: string; }

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
  try {
    const secret = Deno.env.get("JURIS_SYNC_SECRET") || "";
    const given = req.headers.get("x-juris-sync-secret") || "";
    if (!secret || !given || !timingSafeEqual(secret, given)) return json({ error: "nao-autorizado" }, 401);
    if (req.method !== "POST") return json({ error: "metodo" }, 405);

    const body = await req.json().catch(() => ({}));
    const docs: Doc[] = Array.isArray(body?.documents) ? body.documents : [];
    if (!docs.length) return json({ error: "sem-documentos" }, 400);
    if (docs.length > MAX_BATCH) return json({ error: "lote-grande", max: MAX_BATCH }, 400);

    const rejected: Array<{ doc_id?: string; motivo: string }> = [];
    const rows: Record<string, unknown>[] = [];
    for (const d of docs) {
      const missing = REQUIRED.filter((k) => !d[k]);
      if (missing.length) { rejected.push({ doc_id: d.doc_id, motivo: `faltam: ${missing.join(",")}` }); continue; }
      if (d.is_training) { rejected.push({ doc_id: d.doc_id, motivo: "treinamento nunca sobe" }); continue; }
      if (!String(d.official_url).startsWith("https://")) { rejected.push({ doc_id: d.doc_id, motivo: "official_url sem https" }); continue; }
      rows.push({
        doc_id: d.doc_id, source_id: d.source_id, court: d.court ?? null, document_type: d.document_type,
        organ: d.organ ?? null, case_number: d.case_number ?? null, decision_number: d.decision_number ?? null,
        class_name: d.class_name ?? null, rapporteur: d.rapporteur ?? null,
        judgment_date: d.judgment_date ?? null, publication_date: d.publication_date ?? null,
        title: d.title ?? null, summary: d.summary ?? null, full_text: d.full_text ?? null,
        official_url: d.official_url, source_artifact_url: d.source_artifact_url ?? null,
        retrieval_method: d.retrieval_method ?? null, captured_at: d.captured_at, content_sha256: d.content_sha256,
        extraction_status: d.extraction_status ?? "OK", metadata: d.metadata ?? {}, synced_at: new Date().toISOString(),
      });
    }

    const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const ids = rows.map((r) => r.doc_id as string);
    const { data: existing } = await service.from("juris_documents").select("doc_id, content_sha256").in("doc_id", ids);
    const known = new Map<string, string>((existing || []).map((e: { doc_id: string; content_sha256: string }) => [e.doc_id, e.content_sha256]));
    const novos = rows.filter((r) => !known.has(r.doc_id as string));
    const alterados = rows.filter((r) => known.has(r.doc_id as string) && known.get(r.doc_id as string) !== r.content_sha256);
    const iguais = rows.length - novos.length - alterados.length;

    const toWrite = [...novos, ...alterados];
    if (toWrite.length) {
      const { error } = await service.from("juris_documents").upsert(toWrite, { onConflict: "doc_id" });
      if (error) return json({ error: "gravacao", detalhe: error.message }, 500);
    }

    let alertas = 0;
    const normasNovas = novos.filter((r) => r.document_type === "ato_normativo").map((r) => r.doc_id as string);
    if (normasNovas.length) {
      const { data, error } = await service.rpc("juris_notify_normas", { p_doc_ids: normasNovas });
      if (!error && typeof data === "number") alertas = data;
    }

    return json({ ok: true, recebidos: docs.length, novos: novos.length, alterados: alterados.length, iguais, rejeitados: rejected, alertas_criados: alertas });
  } catch (e) {
    return json({ error: String((e as Error).message) }, 500);
  }
});
