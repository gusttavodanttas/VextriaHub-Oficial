import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// notion-oauth-start — monta o link de autorização do Notion para o ESCRITÓRIO do
// usuário. verify_jwt=true. Só admin do escritório (ou super admin) conecta, e só
// se o plano/exceção do escritório permitir (office_notion_allowed).
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
// Redirect só pode apontar pro app (evita open-redirect). Tem que estar cadastrado
// também na integração pública do Notion.
const ALLOWED_HOSTS = ["vextriahub.com.br", "www.vextriahub.com.br", "localhost"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
  try {
    const CLIENT_ID = Deno.env.get("NOTION_CLIENT_ID");
    if (!CLIENT_ID) return json({ error: "notion-nao-configurado" }, 500);

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

    // Escritório do usuário + permissões (as RPCs rodam com o JWT dele).
    const { data: st, error: stErr } = await supa.rpc("notion_status");
    if (stErr) return json({ error: stErr.message }, 400);
    const status = Array.isArray(st) ? st[0] : st;
    if (!status?.office_id) return json({ error: "sem-escritorio" }, 400);
    if (!status.permitido) return json({ error: "plano-sem-notion" }, 403);
    if (!status.pode_gerenciar) return json({ error: "apenas-admin-do-escritorio" }, 403);

    const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const state = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");
    const { error: insErr } = await service.from("notion_oauth_states").insert({
      state, user_id: user.id, office_id: status.office_id, redirect_uri: redirectUri,
    });
    if (insErr) return json({ error: insErr.message }, 500);
    // Higiene: descarta estados com mais de 15 min.
    await service.from("notion_oauth_states").delete().lt("created_at", new Date(Date.now() - 15 * 60 * 1000).toISOString());

    const url = "https://api.notion.com/v1/oauth/authorize?" + new URLSearchParams({
      client_id: CLIENT_ID,
      response_type: "code",
      owner: "user",
      redirect_uri: redirectUri,
      state,
    }).toString();
    return json({ url });
  } catch (e) {
    return json({ error: String((e as Error).message) }, 500);
  }
});
