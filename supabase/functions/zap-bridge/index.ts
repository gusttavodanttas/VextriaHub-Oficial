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
  // NÃO engolir erro HTTP: se retornasse [], o chamador avançaria o cursor e perderia
  // pra sempre os leads da janela de instabilidade do Zap. Lançar → o cursor fica intacto.
  if (!res.ok) throw new Error(`zap-bridge-http-${res.status}`);
  const data = await res.json().catch(() => ({}));
  return data.leads || [];
}

// deno-lint-ignore no-explicit-any
async function pullForOffice(service: any, link: any) {
  const since = link.last_lead_pull_at || "1970-01-01T00:00:00Z";
  const leads = await listQualified(link.zap_user_id, since); // lança em erro HTTP → cursor preservado
  if (leads.length === 0) return { office: link.office_id, novos: 0 }; // nada novo: não mexe no cursor

  // Dono do cliente = admin ATIVO do escritório (não o super-admin que vinculou, que não é membro).
  const { data: adm } = await service.from("office_users").select("user_id")
    .eq("office_id", link.office_id).eq("role", "admin").eq("active", true).limit(1).maybeSingle();
  const { data: off } = await service.from("offices").select("created_by").eq("id", link.office_id).maybeSingle();
  const ownerId = adm?.user_id || off?.created_by || link.linked_by;
  if (!ownerId) return { office: link.office_id, novos: 0, erro: "sem-dono" }; // não insere com user_id nulo

  let novos = 0;
  let cursor = since; // só avança em lead EFETIVAMENTE tratado (import ou já-sincronizado)
  for (const l of leads) { // ordenados por updated_at asc
    // Reserva atômica: se outra puxada (cron × pós-vínculo) já pegou este lead, o PK
    // (office_id,zap_lead_id) barra e ignoreDuplicates devolve vazio → pula sem duplicar cliente.
    const { data: reserved, error: resErr } = await service.from("zap_synced_leads")
      .upsert({ office_id: link.office_id, zap_lead_id: l.id }, { onConflict: "office_id,zap_lead_id", ignoreDuplicates: true })
      .select("zap_lead_id");
    if (resErr) break; // erro transitório na reserva → NÃO avança o cursor (re-tenta na próxima puxada)
    if (!reserved || reserved.length === 0) {
      // Já existe reserva. Distingue "já sincronizado" (tem cliente) de ÓRFÃ (reservada mas o
      // processo morreu antes de criar o cliente) — a órfã, antes, era pulada pra sempre.
      const { data: prev } = await service.from("zap_synced_leads").select("cliente_id")
        .eq("office_id", link.office_id).eq("zap_lead_id", l.id).maybeSingle();
      if (prev?.cliente_id) { cursor = l.updated_at; continue; } // já tem cliente = tratado de fato
      // senão: órfã → cai no insert do cliente abaixo e reamarra a reserva
    }

    const obs = [l.company ? `Empresa: ${l.company}` : "", l.cargo ? `Cargo: ${l.cargo}` : "", "Origem: lead qualificado no Vextria Zap"].filter(Boolean).join("\n");
    const { data: cli, error } = await service.from("clientes").insert({
      office_id: link.office_id, user_id: ownerId, nome: l.name || "(sem nome)",
      email: l.email || null, telefone: l.phone || null, origem: "Vextria Zap", status: "lead", observacoes: obs || null,
    }).select("id").maybeSingle();
    if (error || !cli) {
      // Não gravou: solta a reserva e PARA (não passa o cursor deste lead → re-tenta na próxima puxada).
      await service.from("zap_synced_leads").delete().eq("office_id", link.office_id).eq("zap_lead_id", l.id);
      break;
    }
    await service.from("zap_synced_leads").update({ cliente_id: cli.id }).eq("office_id", link.office_id).eq("zap_lead_id", l.id);
    cursor = l.updated_at;
    novos++;
  }
  await service.from("office_zap_link").update({ last_lead_pull_at: cursor }).eq("office_id", link.office_id);
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
