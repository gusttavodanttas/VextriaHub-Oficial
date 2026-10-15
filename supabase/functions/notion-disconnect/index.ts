import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// notion-disconnect — desconecta o Notion do escritório: revoga o token (best-effort),
// apaga os segredos, limpa a fila e marca a integração como desconectada/desligada.
// As páginas no Notion NÃO são apagadas, e os vínculos (notion_page_id) ficam
// guardados para uma reconexão no mesmo workspace. verify_jwt=true; só admin do escritório.
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

    const { data: st } = await supa.rpc("notion_status");
    const status = Array.isArray(st) ? st[0] : st;
    if (!status?.office_id) return json({ error: "sem-escritorio" }, 400);
    if (!status.pode_gerenciar) return json({ error: "apenas-admin-do-escritorio" }, 403);

    const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: integ } = await service.from("office_integrations").select("id")
      .eq("office_id", status.office_id).eq("provider", "notion").maybeSingle();

    if (integ) {
      const { data: sec } = await service.from("office_integration_secrets").select("access_token")
        .eq("integration_id", integ.id).maybeSingle();
      const id = Deno.env.get("NOTION_CLIENT_ID"), secret = Deno.env.get("NOTION_CLIENT_SECRET");
      if (sec?.access_token && id && secret) {
        try {
          await fetch("https://api.notion.com/v1/oauth/revoke", {
            method: "POST",
            headers: { Authorization: "Basic " + btoa(`${id}:${secret}`), "Content-Type": "application/json" },
            body: JSON.stringify({ token: sec.access_token }),
          });
        } catch { /* best-effort: o escritório também pode remover o acesso no próprio Notion */ }
      }
      await service.from("office_integration_secrets").delete().eq("integration_id", integ.id);
      await service.from("office_integrations").update({
        enabled: false, status: "desconectado", workspace_id: null, workspace_name: null,
        database_ids: {}, last_error: null,
      }).eq("id", integ.id);
    }
    await service.from("notion_sync_queue").delete().eq("office_id", status.office_id);
    return json({ ok: true });
  } catch (e) {
    return json({ error: String((e as Error).message) }, 500);
  }
});
