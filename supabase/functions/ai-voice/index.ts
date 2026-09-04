import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Voz da OpenAI (TTS) para o Conselheiro IA. PREMIUM. Recebe texto, devolve MP3
// em base64. Mesma trava do ai-advisor (só autenticado + premium). Chave OPENAI_API_KEY.
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") || "";
// Tetos por ESCRITÓRIO por mês (a chave da OpenAI é da Vextria). O TTS cobra por
// caractere, então a voz tem os dois: número de usos e volume de texto falado.
// 0 = ilimitado. Segredos: AI_LIMITE_CHAMADAS_MES e AI_LIMITE_VOZ_CARACTERES_MES.
const LIMITE_CHAMADAS_MES = Number(Deno.env.get("AI_LIMITE_CHAMADAS_MES") ?? 500);
const LIMITE_VOZ_MES = Number(Deno.env.get("AI_LIMITE_VOZ_CARACTERES_MES") ?? 200000);
// A OpenAI só aceita este conjunto de vozes; qualquer outra string vira 400.
const VOZES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
  try {
    const URL = Deno.env.get("SUPABASE_URL")!;
    const anon = createClient(URL, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
    const { data: u } = await anon.auth.getUser();
    const uid = u?.user?.id;
    if (!uid) return json({ error: "nao-autenticado" }, 401);

    const service = createClient(URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: prof } = await service.from("profiles").select("role, office_id").eq("user_id", uid).maybeSingle();
    let officeId = prof?.office_id as string | null;
    if (!officeId) { const { data: ou } = await service.from("office_users").select("office_id").eq("user_id", uid).eq("active", true).limit(1).maybeSingle(); officeId = ou?.office_id ?? null; }
    let office: { plan?: string; access_type?: string } | null = null;
    if (officeId) { const r = await service.from("offices").select("plan, access_type").eq("id", officeId).maybeSingle(); office = r.data; }
    const hasIA = prof?.role === "super_admin" || office?.access_type === "lifetime" || office?.access_type === "courtesy" || office?.plan === "premium" || office?.plan === "cortesia";
    if (!hasIA) return json({ error: "premium-required" }, 403);
    if (!OPENAI_KEY) return json({ error: "openai-nao-configurada" }, 503);

    const body = await req.json().catch(() => ({}));
    const text = String(body?.text || "").slice(0, 4000);
    const pedida = String(body?.voice || "nova");
    const voice = VOZES.includes(pedida) ? pedida : "nova";
    if (!text) return json({ error: "sem-texto" }, 400);
    if (!officeId) return json({ error: "sem-escritorio" }, 400);

    // ── Teto de consumo (check + incremento atômicos no banco) ──
    // Falha ABERTO se a RPC não existir/o banco tropeçar: um recurso pago não cai
    // por causa do medidor. Aplique a migration ANTES de dar deploy nesta função.
    const consumo = await service.rpc("ai_consumir", {
      p_office: officeId,
      p_chamadas: 1,
      p_voz_caracteres: text.length,
      p_limite_chamadas: LIMITE_CHAMADAS_MES,
      p_limite_voz: LIMITE_VOZ_MES,
    });
    if (consumo.error) {
      console.error("ai_consumir falhou (liberando a chamada):", consumo.error.message);
    } else {
      const uso = consumo.data as { permitido?: boolean; chamadas?: number; voz_caracteres?: number } | null;
      if (uso && uso.permitido === false) {
        return json({
          error: "limite-ia-atingido",
          message: "O escritório atingiu o limite de uso da IA neste mês. O contador zera no dia 1º.",
          chamadas: uso.chamadas,
          voz_caracteres: uso.voz_caracteres,
        }, 429);
      }
    }

    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "tts-1", voice, input: text, response_format: "mp3" }),
    });
    if (!res.ok) { const e = await res.text().catch(() => ""); return json({ error: "tts-falhou", detail: e.slice(0, 200) }, 502); }

    const buf = new Uint8Array(await res.arrayBuffer());
    let bin = ""; const chunk = 8192;
    for (let i = 0; i < buf.length; i += chunk) bin += String.fromCharCode(...buf.subarray(i, i + chunk));
    return json({ ok: true, audio: btoa(bin), mime: "audio/mpeg" });
  } catch (e) { return json({ error: String((e as Error).message) }, 500); }
});
