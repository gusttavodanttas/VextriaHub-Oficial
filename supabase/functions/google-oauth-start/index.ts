import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// google-oauth-start — monta o link de consentimento do Google para o usuário
// conectar a agenda. verify_jwt=true (só usuário logado). Escopo app.created =
// NÃO sensível (não precisa de verificação do Google): cria/gerencia só um
// calendário "VextriaHub" próprio, sem tocar na agenda pessoal.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
// Redirect só pode apontar pro app (evita open-redirect). O host do redirect
// tem que estar registrado também no console do Google.
const ALLOWED_HOSTS = ["vextriahub.com.br", "www.vextriahub.com.br", "localhost"];
const SCOPE = "openid email https://www.googleapis.com/auth/calendar.app.created";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
  try {
    const CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
    if (!CLIENT_ID) return json({ error: "google-nao-configurado" }, 500);

    const authHeader = req.headers.get("Authorization") || "";
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return json({ error: "nao-autenticado" }, 401);

    const body = await req.json().catch(() => ({}));
    const redirectUri = String(body?.redirectUri || "");
    let host = "";
    try { host = new URL(redirectUri).hostname; } catch { return json({ error: "redirect-invalido" }, 400); }
    if (!ALLOWED_HOSTS.includes(host)) return json({ error: "redirect-nao-permitido" }, 400);

    const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: prof } = await service.from("profiles").select("office_id").eq("user_id", user.id).maybeSingle();

    const state = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");
    await service.from("google_oauth_states").insert({
      state, user_id: user.id, office_id: prof?.office_id ?? null, redirect_uri: redirectUri,
    });
    // Higiene: descarta estados com mais de 15 min.
    await service.from("google_oauth_states").delete().lt("created_at", new Date(Date.now() - 15 * 60 * 1000).toISOString());

    const url = "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: SCOPE,
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      state,
    }).toString();
    return json({ url });
  } catch (e) {
    return json({ error: String((e as Error).message) }, 500);
  }
});
