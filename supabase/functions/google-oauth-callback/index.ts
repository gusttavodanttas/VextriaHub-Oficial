import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// google-oauth-callback — recebe o `code` do Google (repassado pela página SPA
// /auth/google/callback), troca por tokens, cria o calendário "VextriaHub" na
// conta do usuário e guarda os tokens. verify_jwt=FALSE: o fluxo é validado pelo
// `state` (uso único, TTL curto), porque o redirect do Google não traz sessão.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
  try {
    const CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
    const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
    if (!CLIENT_ID || !CLIENT_SECRET) return json({ error: "google-nao-configurado" }, 500);

    const { code, state, redirectUri } = await req.json().catch(() => ({}));
    if (!code || !state) return json({ error: "faltando-code-ou-state" }, 400);

    const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Valida o state (uso único).
    const { data: st } = await service.from("google_oauth_states").select("*").eq("state", state).maybeSingle();
    if (!st) return json({ error: "state-invalido" }, 400);
    await service.from("google_oauth_states").delete().eq("state", state);
    if (new Date(st.created_at).getTime() < Date.now() - 15 * 60 * 1000) return json({ error: "state-expirado" }, 400);
    const finalRedirect = st.redirect_uri || redirectUri;

    // Troca o code por tokens.
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code, client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
        redirect_uri: finalRedirect, grant_type: "authorization_code",
      }),
    });
    const tok = await tokenRes.json();
    if (!tokenRes.ok || !tok.access_token) return json({ error: "token-exchange-falhou", detail: tok }, 400);

    // E-mail vem do id_token (claim), só pra exibir "conectado como ...".
    let email: string | null = null;
    try {
      if (tok.id_token) {
        const payload = JSON.parse(atob(String(tok.id_token).split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
        email = payload?.email ?? null;
      }
    } catch { /* ignore */ }

    // Cria o calendário separado "VextriaHub".
    const calRes = await fetch("https://www.googleapis.com/calendar/v3/calendars", {
      method: "POST",
      headers: { Authorization: `Bearer ${tok.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ summary: "VextriaHub", description: "Prazos e audiências do VextriaHub", timeZone: "America/Sao_Paulo" }),
    });
    const cal = await calRes.json();
    if (!calRes.ok || !cal.id) return json({ error: "criar-calendario-falhou", detail: cal }, 400);

    const expiry = new Date(Date.now() + (tok.expires_in || 3600) * 1000).toISOString();
    const upd: Record<string, unknown> = {
      user_id: st.user_id, office_id: st.office_id, google_email: email,
      access_token: tok.access_token, token_expiry: expiry, calendar_id: cal.id,
      status: "connected", last_error: null, updated_at: new Date().toISOString(),
    };
    // Só sobrescreve o refresh_token se o Google mandou um novo (prompt=consent manda).
    if (tok.refresh_token) upd.refresh_token = tok.refresh_token;
    await service.from("google_integrations").upsert(upd, { onConflict: "user_id" });

    // Dispara a 1ª sincronização (best-effort).
    try {
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/google-sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-robot-secret": Deno.env.get("ROBOT_SECRET") || "" },
        body: JSON.stringify({ user_id: st.user_id }),
      });
    } catch { /* a cron pega depois */ }

    return json({ ok: true, email });
  } catch (e) {
    return json({ error: String((e as Error).message) }, 500);
  }
});
