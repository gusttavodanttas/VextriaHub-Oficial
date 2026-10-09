import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createDatabases, findDatabases, firstSharedPage, NotionError } from "../_shared/notion.ts";

// notion-oauth-callback — recebe o `code` do Notion (repassado pela página SPA
// /auth/notion/callback), troca por token, acha (ou cria) as bases "Processos" e
// "Clientes" no workspace do escritório, grava a conexão e agenda a carga inicial.
// verify_jwt=FALSE: o fluxo é validado pelo `state` (uso único, TTL de 15 min).
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
    const CLIENT_ID = Deno.env.get("NOTION_CLIENT_ID");
    const CLIENT_SECRET = Deno.env.get("NOTION_CLIENT_SECRET");
    if (!CLIENT_ID || !CLIENT_SECRET) return json({ error: "notion-nao-configurado" }, 500);

    const { code, state } = await req.json().catch(() => ({}));
    if (!code || !state) return json({ error: "faltando-code-ou-state" }, 400);

    const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // State de uso único.
    const { data: st } = await service.from("notion_oauth_states").select("*").eq("state", state).maybeSingle();
    if (!st) return json({ error: "state-invalido" }, 400);
    await service.from("notion_oauth_states").delete().eq("state", state);
    if (new Date(st.created_at).getTime() < Date.now() - 15 * 60 * 1000) return json({ error: "state-expirado" }, 400);

    const { data: allowed } = await service.rpc("office_notion_allowed", { p_office: st.office_id });
    if (!allowed) return json({ error: "plano-sem-notion" }, 403);

    // Troca o code pelo token (Basic auth com client_id:client_secret).
    const tokenRes = await fetch("https://api.notion.com/v1/oauth/token", {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(`${CLIENT_ID}:${CLIENT_SECRET}`),
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
      },
      body: JSON.stringify({ grant_type: "authorization_code", code, redirect_uri: st.redirect_uri }),
    });
    const tok = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !tok.access_token) {
      return json({ error: "token-exchange-falhou", detail: tok?.error_description || tok?.message || tok?.error }, 400);
    }
    const token: string = tok.access_token;

    // Bases: reaproveita "Processos"/"Clientes" já compartilhadas; senão cria.
    let dbs: { processos?: string; clientes?: string } = {};
    let aviso: string | null = null;
    try {
      dbs = await findDatabases(token);
      if (!dbs.processos || !dbs.clientes) {
        const parent = tok.duplicated_template_id || (await firstSharedPage(token));
        if (parent) dbs = await createDatabases(token, parent, dbs);
        else aviso = "Nenhuma página foi compartilhada com o VextriaHub. Reconecte e marque uma página (ou as bases Processos e Clientes).";
      }
    } catch (e) {
      aviso = e instanceof NotionError ? `Notion: ${e.message}` : String((e as Error).message);
    }
    const ok = !!(dbs.processos && dbs.clientes);

    // Grava a conexão (service role passa pelo trigger de proteção).
    const { data: integ, error: upErr } = await service.from("office_integrations").upsert({
      office_id: st.office_id,
      provider: "notion",
      enabled: ok,
      status: ok ? "conectado" : "erro",
      workspace_id: tok.workspace_id ?? null,
      workspace_name: tok.workspace_name ?? null,
      database_ids: ok ? { processos: dbs.processos, clientes: dbs.clientes } : {},
      connected_by: st.user_id,
      connected_at: new Date().toISOString(),
      last_error: aviso,
    }, { onConflict: "office_id,provider" }).select("id").single();
    if (upErr || !integ) return json({ error: upErr?.message || "falha-ao-gravar" }, 500);

    await service.from("office_integration_secrets").upsert({
      integration_id: integ.id,
      access_token: token,
      refresh_token: tok.refresh_token ?? null,
      bot_id: tok.bot_id ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "integration_id" });

    if (!ok) return json({ ok: false, error: "sem-bases", detail: aviso }, 200);

    // Carga inicial (só preenche o que estiver vazio no Notion) + 1ª rodada já.
    const { data: enfileirados } = await service.rpc("notion_enqueue_all", { p_office: st.office_id });
    const kick = fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/notion-sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-robot-secret": Deno.env.get("ROBOT_SECRET") || "" },
      body: JSON.stringify({ office_id: st.office_id }),
    }).catch(() => null);
    // deno-lint-ignore no-explicit-any
    const rt = (globalThis as any).EdgeRuntime;
    if (rt?.waitUntil) rt.waitUntil(kick);

    return json({ ok: true, workspace: tok.workspace_name ?? null, enfileirados: enfileirados ?? 0 });
  } catch (e) {
    return json({ error: String((e as Error).message) }, 500);
  }
});
