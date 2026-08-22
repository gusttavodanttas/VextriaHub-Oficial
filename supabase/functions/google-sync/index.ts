import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// google-sync — empurra prazos e audiências do escritório pro calendário
// "VextriaHub" do usuário (mão única). Sync por DIFF: cria o que falta, atualiza
// o que mudou (hash), remove o que sumiu/concluiu. verify_jwt=FALSE; faz a própria
// auth: x-robot-secret (cron, sincroniza todos) OU JWT do usuário ("sincronizar agora").
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const TZ = "America/Sao_Paulo";
const CAL = (id: string, path = "") => `https://www.googleapis.com/calendar/v3/calendars/${id}/events${path}`;

async function sha1(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function addDay(ymd: string): string {
  const d = new Date(ymd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// deno-lint-ignore no-explicit-any
async function validToken(service: any, gi: any, CLIENT_ID: string, CLIENT_SECRET: string): Promise<string> {
  if (gi.access_token && gi.token_expiry && new Date(gi.token_expiry).getTime() > Date.now() + 60000) return gi.access_token;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: gi.refresh_token, grant_type: "refresh_token" }),
  });
  const tok = await res.json();
  if (!res.ok || !tok.access_token) {
    if (tok.error === "invalid_grant") {
      await service.from("google_integrations").update({ status: "revoked", last_error: "invalid_grant" }).eq("user_id", gi.user_id);
    }
    throw new Error("refresh-falhou:" + (tok.error || res.status));
  }
  const expiry = new Date(Date.now() + (tok.expires_in || 3600) * 1000).toISOString();
  await service.from("google_integrations").update({ access_token: tok.access_token, token_expiry: expiry }).eq("user_id", gi.user_id);
  return tok.access_token;
}

// deno-lint-ignore no-explicit-any
async function syncOne(service: any, gi: any, CLIENT_ID: string, CLIENT_SECRET: string) {
  const token = await validToken(service, gi, CLIENT_ID, CLIENT_SECRET);
  const cal = gi.calendar_id;
  const hoje = new Date().toISOString().slice(0, 10);
  // deno-lint-ignore no-explicit-any
  const items: { source_type: string; source_id: string; event: any }[] = [];

  if (gi.office_id) {
    const { data: prazos } = await service.from("prazos")
      .select("id,titulo,descricao,tipo_prazo,numero_processo,data_fim_prazo,data_vencimento,status,deletado,titular")
      .eq("office_id", gi.office_id).neq("status", "concluido");
    // deno-lint-ignore no-explicit-any
    for (const p of (prazos || []) as any[]) {
      if (p.deletado || p.titular === "contraria") continue;
      const fatal = p.data_fim_prazo || p.data_vencimento;
      if (!fatal || String(fatal) < hoje) continue;
      const summary = `⚖️ ${p.tipo_prazo || "Prazo"}${p.numero_processo ? " — " + p.numero_processo : ""}`;
      const description = [p.titulo, p.descricao].filter(Boolean).join("\n") || undefined;
      items.push({ source_type: "prazo", source_id: p.id, event: {
        summary, description, start: { date: String(fatal) }, end: { date: addDay(String(fatal)) },
      }});
    }

    const { data: auds } = await service.from("audiencias")
      .select("id,titulo,data_audiencia,local,status,deletado")
      .eq("office_id", gi.office_id).not("status", "in", "(realizada,cancelada)");
    // deno-lint-ignore no-explicit-any
    for (const a of (auds || []) as any[]) {
      if (a.deletado || !a.data_audiencia) continue;
      if (new Date(a.data_audiencia).toISOString().slice(0, 10) < hoje) continue;
      const start = new Date(a.data_audiencia);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      items.push({ source_type: "audiencia", source_id: a.id, event: {
        summary: `🏛️ ${a.titulo || "Audiência"}`,
        location: a.local || undefined,
        start: { dateTime: start.toISOString(), timeZone: TZ },
        end: { dateTime: end.toISOString(), timeZone: TZ },
      }});
    }
  }

  const { data: mapRows } = await service.from("google_calendar_map").select("*").eq("user_id", gi.user_id);
  const mapByKey = new Map((mapRows || []).map((m: { source_type: string; source_id: string }) => [m.source_type + ":" + m.source_id, m]));
  const seen = new Set<string>();
  let created = 0, updated = 0, deleted = 0;

  for (const it of items) {
    const key = it.source_type + ":" + it.source_id;
    seen.add(key);
    const h = await sha1(JSON.stringify(it.event));
    // deno-lint-ignore no-explicit-any
    const existing = mapByKey.get(key) as any;
    if (!existing) {
      const r = await fetch(CAL(cal), { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(it.event) });
      const ev = await r.json();
      if (r.ok && ev.id) {
        await service.from("google_calendar_map").insert({ user_id: gi.user_id, source_type: it.source_type, source_id: it.source_id, google_event_id: ev.id, content_hash: h });
        created++;
      }
    } else if (existing.content_hash !== h) {
      const r = await fetch(CAL(cal, "/" + existing.google_event_id), { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(it.event) });
      if (r.ok) {
        await service.from("google_calendar_map").update({ content_hash: h, updated_at: new Date().toISOString() }).eq("user_id", gi.user_id).eq("source_type", it.source_type).eq("source_id", it.source_id);
        updated++;
      }
    }
  }

  // Remove do Google o que não é mais ativo (concluído/excluído/passou).
  // deno-lint-ignore no-explicit-any
  for (const m of (mapRows || []) as any[]) {
    if (seen.has(m.source_type + ":" + m.source_id)) continue;
    await fetch(CAL(cal, "/" + m.google_event_id), { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    await service.from("google_calendar_map").delete().eq("user_id", gi.user_id).eq("source_type", m.source_type).eq("source_id", m.source_id);
    deleted++;
  }

  await service.from("google_integrations").update({ last_sync_at: new Date().toISOString(), last_error: null }).eq("user_id", gi.user_id);
  return { user: gi.user_id, created, updated, deleted };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
  try {
    const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Auth: cron (x-robot-secret) sincroniza todos ou o user_id do body; senão, JWT do usuário.
    let targetUserId: string | null = null;
    let syncAll = false;
    const robot = req.headers.get("x-robot-secret");
    const body = await req.json().catch(() => ({}));
    if (robot && robot === Deno.env.get("ROBOT_SECRET")) {
      if (body?.user_id) targetUserId = String(body.user_id); else syncAll = true;
    } else {
      const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
      });
      const { data: { user } } = await supa.auth.getUser();
      if (!user) return json({ error: "nao-autorizado" }, 401);
      targetUserId = user.id;
    }

    let q = service.from("google_integrations").select("*").eq("status", "connected");
    if (targetUserId) q = q.eq("user_id", targetUserId);
    const { data: integrations } = await q;

    // Nada conectado → nada a fazer (mantém a cron quieta enquanto ninguém usa).
    if (!integrations || integrations.length === 0) return json({ ok: true, synced: 0, syncAll, results: [] });

    // Só a partir daqui os secrets do Google são necessários.
    const CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
    const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
    if (!CLIENT_ID || !CLIENT_SECRET) return json({ error: "google-nao-configurado" }, 500);

    const results: unknown[] = [];
    for (const gi of (integrations || [])) {
      try { results.push(await syncOne(service, gi, CLIENT_ID, CLIENT_SECRET)); }
      catch (e) { results.push({ user: (gi as { user_id: string }).user_id, error: String((e as Error).message) }); }
    }
    return json({ ok: true, synced: results.length, syncAll, results });
  } catch (e) {
    return json({ error: String((e as Error).message) }, 500);
  }
});
