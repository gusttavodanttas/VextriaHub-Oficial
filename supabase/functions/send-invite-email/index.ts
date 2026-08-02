// Envia o e-mail de CONVITE quando um admin convida alguém para o escritório.
// Chamado pelo front (useInvitations.createInvitation) via functions.invoke, com
// o JWT do admin. Autoriza: o chamador precisa ser membro ATIVO do mesmo
// escritório do convite. Envia via Resend (domínio vextriahub.com.br verificado).
//
// Deploy COM verify_jwt (padrão) — depende do JWT do usuário.
// Env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (injetados),
//      RESEND_API_KEY, APP_URL (opcional; default www.vextriahub.com.br).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const FROM = "VextriaHub <convites@vextriahub.com.br>";
const esc = (s: string) => String(s || "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!));
const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador", coordinator: "Coordenador", coordenador: "Coordenador",
  member: "Membro", user: "Membro", advogado: "Advogado",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors, status: 204 });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
    const APP_URL = Deno.env.get("APP_URL") || "https://www.vextriahub.com.br";

    // 1) quem chamou (precisa estar logado)
    const asUser = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    });
    const { data: { user } } = await asUser.auth.getUser();
    if (!user) return json({ error: "não autenticado" }, 401);

    const { invitation_id } = await req.json().catch(() => ({}));
    if (!invitation_id) return json({ error: "invitation_id ausente" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: inv } = await admin
      .from("invitations").select("email, office_id, role").eq("id", invitation_id).single();
    if (!inv) return json({ error: "convite não encontrado" }, 404);

    // 2) autorização: o chamador tem que ser membro ativo do MESMO escritório
    const { data: caller } = await admin
      .from("office_users").select("id")
      .eq("user_id", user.id).eq("office_id", inv.office_id).eq("active", true).maybeSingle();
    if (!caller) return json({ error: "sem permissão neste escritório" }, 403);

    const { data: office } = await admin.from("offices").select("name").eq("id", inv.office_id).single();
    const officeName = esc(office?.name || "um escritório");
    const inviterName = esc((user.user_metadata?.full_name as string) || user.email || "A equipe");
    const roleLabel = ROLE_LABEL[String(inv.role)] || "Membro";
    const link = `${APP_URL}/register`;

    const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#f6f7f9;padding:32px 12px;">
      <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #eaecef;">
        <div style="background:#0f172a;padding:22px 28px;">
          <span style="color:#ffffff;font-weight:800;font-size:18px;letter-spacing:-0.3px;">Vextria<span style="color:#818cf8;">Hub</span></span>
        </div>
        <div style="padding:32px 28px;color:#1f2937;line-height:1.65;">
          <h1 style="margin:0 0 10px;font-size:20px;color:#0f172a;">Você foi convidado 🎉</h1>
          <p style="margin:0 0 16px;color:#4b5563;"><b>${inviterName}</b> convidou você para o escritório <b>${officeName}</b> no VextriaHub, como <b>${esc(roleLabel)}</b>.</p>
          <p style="margin:0 0 26px;color:#4b5563;">Para entrar, crie sua conta usando <b>este e-mail</b> (${esc(inv.email)}):</p>
          <div style="text-align:center;margin:0 0 26px;">
            <a href="${link}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:14px 34px;border-radius:10px;font-weight:700;font-size:15px;">Criar minha conta</a>
          </div>
          <p style="margin:0;color:#9ca3af;font-size:13px;border-top:1px solid #f0f1f3;padding-top:16px;">Ao se cadastrar com este e-mail, você entra automaticamente no escritório. Se não esperava este convite, é só ignorar.</p>
        </div>
        <div style="background:#f9fafb;padding:16px 28px;text-align:center;">
          <span style="color:#9ca3af;font-size:12px;">VextriaHub · e-mail automático, por favor não responda.</span>
        </div>
      </div>
    </div>`;

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: inv.email, subject: `Convite para ${officeName} — VextriaHub`, html }),
    });
    if (!resp.ok) return json({ error: "resend falhou", detail: await resp.text() }, 502);

    return json({ ok: true, to: inv.email });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
