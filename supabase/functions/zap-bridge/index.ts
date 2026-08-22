import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// zap-bridge (Hub) — puxa leads QUALIFICADOS das contas Zap vinculadas e insere no
// CRM do Hub (tabela clientes, origem "Vextria Zap"), sem duplicar. verify_jwt=FALSE;
// auth por x-robot-secret (cron a cada 15 min OU chamada interna após vincular).
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-robot-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const ZAP_BRIDGE = Deno.env.get("ZAP_BRIDGE_URL") || "https://bceundwkuonueqmgrlyq.supabase.co/functions/v1/bridge";

async function listQualified(userId: string, since: string) {
  const res = await fetch(ZAP_BRIDGE, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-bridge-secret": Deno.env.get("BRIDGE_SECRET") || "" },
    body: JSON.stringify({ action: "list_qualified_leads", user_ids: [userId], since }),
  });
  const data = await res.json().catch(() => ({}));
  return res.ok ? (data.leads || []) : [];
}

// deno-lint-ignore no-explicit-any
async function pullForOffice(service: any, link: any) {
  const since = link.last_lead_pull_at || "1970-01-01T00:00:00Z";
  const leads = await listQualified(link.zap_user_id, since);
  if (leads.length === 0) {
    await service.from("office_zap_link").update({ last_lead_pull_at: new Date().toISOString() }).eq("office_id", link.office_id);
    return { office: link.office_id, novos: 0 };
  }

  // user_id do cliente = dono do escritório (fallback: quem vinculou).
  const { data: off } = await service.from("offices").select("created_by").eq("id", link.office_id).maybeSingle();
  const ownerId = off?.created_by || link.linked_by;

  // Quais leads já foram importados? (dedup)
  const ids = leads.map((l: { id: string }) => l.id);
  const { data: jaSync } = await service.from("zap_synced_leads").select("zap_lead_id").eq("office_id", link.office_id).in("zap_lead_id", ids);
  const jaTem = new Set((jaSync || []).map((r: { zap_lead_id: string }) => r.zap_lead_id));

  let novos = 0;
  let maxUpdated = since;
  for (const l of leads) {
    if (l.updated_at > maxUpdated) maxUpdated = l.updated_at;
    if (jaTem.has(l.id)) continue;
    const obs = [l.company ? `Empresa: ${l.company}` : "", l.cargo ? `Cargo: ${l.cargo}` : "", "Origem: lead qualificado no Vextria Zap"].filter(Boolean).join("\n");
    const { data: cli, error } = await service.from("clientes").insert({
      office_id: link.office_id,
      user_id: ownerId,
      nome: l.name || "(sem nome)",
      email: l.email || null,
      telefone: l.phone || null,
      origem: "Vextria Zap",
      status: "lead",
      observacoes: obs || null,
    }).select("id").maybeSingle();
    if (error || !cli) continue; // não marca como sincronizado se não gravou
    await service.from("zap_synced_leads").insert({ office_id: link.office_id, zap_lead_id: l.id, cliente_id: cli.id });
    novos++;
  }
  await service.from("office_zap_link").update({ last_lead_pull_at: maxUpdated }).eq("office_id", link.office_id);
  return { office: link.office_id, novos };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
  try {
    const robot = req.headers.get("x-robot-secret");
    if (!robot || robot !== Deno.env.get("ROBOT_SECRET")) return json({ error: "nao-autorizado" }, 401);

    const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));

    let q = service.from("office_zap_link").select("*").eq("active", true);
    if (body?.office_id) q = q.eq("office_id", body.office_id);
    const { data: links } = await q;
    // Nada vinculado → nada a fazer (mantém a cron quieta enquanto ninguém usa).
    if (!links || links.length === 0) return json({ ok: true, offices: 0, results: [] });

    // Só a partir daqui o segredo da ponte é necessário.
    if (!Deno.env.get("BRIDGE_SECRET")) return json({ error: "bridge-nao-configurado" }, 500);

    const results = [];
    for (const link of links) {
      try { results.push(await pullForOffice(service, link)); }
      catch (e) { results.push({ office: (link as { office_id: string }).office_id, error: String((e as Error).message) }); }
    }
    return json({ ok: true, offices: results.length, results });
  } catch (e) {
    return json({ error: String((e as Error).message) }, 500);
  }
});
