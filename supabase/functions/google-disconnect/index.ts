import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// google-disconnect — desliga a integração: apaga o calendário "VextriaHub" da
// conta do usuário (best-effort), revoga o refresh token e limpa tokens+mapa.
// verify_jwt=true (só o próprio usuário desliga a sua conexão).
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
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    });
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return json({ error: "nao-autenticado" }, 401);

    const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: gi } = await service.from("google_integrations").select("*").eq("user_id", user.id).maybeSingle();

    if (gi) {
      // Best-effort: apaga o calendário separado e revoga o token.
      try {
        if (gi.access_token && gi.calendar_id) {
          await fetch(`https://www.googleapis.com/calendar/v3/calendars/${gi.calendar_id}`, {
            method: "DELETE", headers: { Authorization: `Bearer ${gi.access_token}` },
          });
        }
      } catch { /* ignore */ }
      try {
        const t = gi.refresh_token || gi.access_token;
        if (t) await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(t)}`, { method: "POST" });
      } catch { /* ignore */ }
    }

    await service.from("google_calendar_map").delete().eq("user_id", user.id);
    await service.from("google_integrations").delete().eq("user_id", user.id);
    return json({ ok: true });
  } catch (e) {
    return json({ error: String((e as Error).message) }, 500);
  }
});
