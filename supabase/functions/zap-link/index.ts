import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// zap-link (Hub) — super-admin liga/desliga um escritório a uma conta do Vextria Zap.
// verify_jwt=true + checa is_super_admin(). Chama a edge `bridge` do Zap (com
// BRIDGE_SECRET) pra resolver a conta pelo e-mail. É o GATE: o vínculo ativo é o que
// libera a ponte pro escritório.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const ZAP_BRIDGE = Deno.env.get("ZAP_BRIDGE_URL") || "https://bceundwkuonueqmgrlyq.supabase.co/functions/v1/bridge";

async function zapBridge(action: string, payload: Record<string, unknown>) {
  const res = await fetch(ZAP_BRIDGE, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-bridge-secret": Deno.env.get("BRIDGE_SECRET") || "" },
    body: JSON.stringify({ action, ...payload }),
  });
  return { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
  try {
    if (!Deno.env.get("BRIDGE_SECRET")) return json({ error: "bridge-nao-configurado" }, 500);

    const supaUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    });
    const { data: { user } } = await supaUser.auth.getUser();
    if (!user) return json({ error: "nao-autenticado" }, 401);
    const { data: isAdmin } = await supaUser.rpc("is_super_admin");
    if (!isAdmin) return json({ error: "so-super-admin" }, 403);

    const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");

    if (action === "status") {
      const { data } = await service.from("office_zap_link").select("*").eq("office_id", body.office_id).maybeSingle();
      return json({ link: data ?? null });
    }

    // Preview: resolve a conta do Zap pelo e-mail (sem gravar).
    if (action === "resolve") {
      const r = await zapBridge("resolve_and_check", { email: body.email });
      if (!r.ok) return json({ error: "zap-indisponivel", detail: r.data }, 502);
      return json(r.data);
    }

    // Liga o escritório à conta Zap resolvida.
    if (action === "link") {
      if (!body.office_id || !body.email) return json({ error: "faltando-office-ou-email" }, 400);
      const r = await zapBridge("resolve_and_check", { email: body.email });
      if (!r.ok) return json({ error: "zap-indisponivel", detail: r.data }, 502);
      if (!r.data?.found) return json({ error: "conta-zap-nao-encontrada" }, 404);
      await service.from("office_zap_link").upsert({
        office_id: body.office_id, zap_user_id: r.data.user_id, zap_email: String(body.email).trim(),
        active: true, linked_by: user.id, updated_at: new Date().toISOString(),
      }, { onConflict: "office_id" });
      // Puxa os leads já qualificados agora (best-effort).
      try {
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/zap-bridge`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-robot-secret": Deno.env.get("ROBOT_SECRET") || "" },
          body: JSON.stringify({ action: "pull_leads", office_id: body.office_id }),
        });
      } catch { /* a cron pega depois */ }
      return json({ ok: true, active: r.data.active, name: r.data.name });
    }

    if (action === "unlink") {
      await service.from("office_zap_link").delete().eq("office_id", body.office_id);
      return json({ ok: true });
    }

    return json({ error: "acao-desconhecida" }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message) }, 500);
  }
});
