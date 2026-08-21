import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// trial-reminder — cron diário. Avisa por e-mail (Resend) os escritórios cujo teste
// termina em 3 dias e em 1 dia, com link pro pagamento. Loga em trial_reminder_log
// pra não repetir o mesmo aviso. Auth: x-robot-secret (fail-closed). Deploy --no-verify-jwt.
// Body opcional { "dry": true } -> não envia nem loga; só retorna quem receberia.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const FROM = "VextriaHub <avisos@vextriahub.com.br>";
const esc = (s: string) => String(s || "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!));

const MILESTONES = [
  { days: 3, kind: "d3", subject: "Seu teste do VextriaHub termina em 3 dias", head: "Faltam 3 dias do seu teste", lead: "Seu período de teste termina em 3 dias." },
  { days: 1, kind: "d1", subject: "Último dia do seu teste no VextriaHub", head: "É o último dia do seu teste", lead: "Seu período de teste termina amanhã." },
];

function buildHtml(officeName: string, head: string, lead: string, link: string) {
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#f6f7f9;padding:32px 12px;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #eaecef;">
      <div style="background:#0f172a;padding:22px 28px;">
        <span style="color:#ffffff;font-weight:800;font-size:18px;letter-spacing:-0.3px;">Vextria<span style="color:#818cf8;">Hub</span></span>
      </div>
      <div style="padding:32px 28px;color:#1f2937;line-height:1.65;">
        <h1 style="margin:0 0 10px;font-size:20px;color:#0f172a;">${esc(head)}</h1>
        <p style="margin:0 0 16px;color:#4b5563;">Olá! ${esc(lead)} Depois disso, o acesso do escritório <b>${esc(officeName)}</b> aos processos, prazos e clientes fica bloqueado até a assinatura ser ativada.</p>
        <p style="margin:0 0 26px;color:#4b5563;">Ative agora e continue sem interrupção - leva 2 minutos, por Pix, boleto ou cartão:</p>
        <div style="text-align:center;margin:0 0 26px;">
          <a href="${link}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:14px 34px;border-radius:10px;font-weight:700;font-size:15px;">Ativar minha assinatura</a>
        </div>
        <p style="margin:0;color:#9ca3af;font-size:13px;border-top:1px solid #f0f1f3;padding-top:16px;">Se você já ativou, pode ignorar este aviso. Qualquer dúvida, é só responder que ajudamos.</p>
      </div>
      <div style="background:#f9fafb;padding:16px 28px;text-align:center;">
        <span style="color:#9ca3af;font-size:12px;">VextriaHub · você recebe este aviso porque tem um teste ativo.</span>
      </div>
    </div>
  </div>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors, status: 204 });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
  try {
    const ROBOT_SECRET = Deno.env.get("ROBOT_SECRET") || "";
    if (!ROBOT_SECRET || (req.headers.get("x-robot-secret") || "") !== ROBOT_SECRET) {
      return json({ ok: false, error: "unauthorized" }, 401);
    }
    const RESEND = Deno.env.get("RESEND_API_KEY") || "";
    const APP_URL = Deno.env.get("APP_URL") || "https://www.vextriahub.com.br";
    const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    const dry = body?.dry === true;
    const link = `${APP_URL}/pagamento`;

    let sent = 0;
    const results: any[] = [];

    for (const m of MILESTONES) {
      const target = new Date();
      target.setUTCHours(0, 0, 0, 0);
      target.setUTCDate(target.getUTCDate() + m.days);
      const targetStr = target.toISOString().slice(0, 10);

      const { data: subs } = await service
        .from("office_subscriptions")
        .select("office_id, trial_ends_at")
        .eq("status", "trial")
        .eq("trial_ends_at", targetStr);

      for (const s of (subs as any[]) || []) {
        const { data: already } = await service
          .from("trial_reminder_log").select("id")
          .eq("office_id", s.office_id).eq("kind", m.kind).eq("trial_ends_at", targetStr).maybeSingle();
        if (already) continue;

        const { data: ou } = await service
          .from("office_users").select("user_id")
          .eq("office_id", s.office_id).eq("role", "admin").eq("active", true).limit(1).maybeSingle();
        let email: string | null = null;
        if (ou?.user_id) {
          const { data: p } = await service.from("profiles").select("email").eq("user_id", ou.user_id).maybeSingle();
          email = p?.email || null;
        }
        const { data: off } = await service.from("offices").select("name").eq("id", s.office_id).maybeSingle();
        const officeName = off?.name || "seu escritório";

        if (!email) { results.push({ office: s.office_id, kind: m.kind, skip: "sem-email" }); continue; }
        if (dry) { results.push({ office: s.office_id, kind: m.kind, to: email, dry: true }); continue; }

        const resp = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: FROM, to: email, subject: m.subject, html: buildHtml(officeName, m.head, m.lead, link) }),
        });
        if (!resp.ok) { results.push({ office: s.office_id, kind: m.kind, error: await resp.text() }); continue; }
        await service.from("trial_reminder_log").insert({ office_id: s.office_id, kind: m.kind, trial_ends_at: targetStr });
        sent++;
        results.push({ office: s.office_id, kind: m.kind, to: email, ok: true });
      }
    }
    return json({ ok: true, dry, sent, results });
  } catch (e) {
    return json({ ok: false, error: String((e as Error).message) }, 500);
  }
});
