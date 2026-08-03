// E-mail de boas-vindas com credenciais, para o membro criado via "Criar com
// senha provisória" (CreateMemberDialog). Chamado pelo front com o JWT do admin.
// Autoriza: o chamador precisa ser admin ATIVO do mesmo escritório.
// Deploy COM verify_jwt (padrão). Env: SUPABASE_URL, SUPABASE_ANON_KEY,
// SUPABASE_SERVICE_ROLE_KEY (injetados), RESEND_API_KEY, APP_URL (opcional).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const FROM = "VextriaHub <nao-responder@vextriahub.com.br>";
const esc = (s: string) => String(s || "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!));

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors, status: 204 });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
    const APP_URL = Deno.env.get("APP_URL") || "https://www.vextriahub.com.br";

    // 1) quem chamou (admin logado)
    const asUser = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    });
    const { data: { user } } = await asUser.auth.getUser();
    if (!user) return json({ error: "não autenticado" }, 401);

    const { email, name, password, office_id } = await req.json().catch(() => ({}));
    if (!email || !password || !office_id) return json({ error: "dados incompletos" }, 400);

    // 2) autorização: o chamador tem que ser admin ativo do MESMO escritório
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: caller } = await admin
      .from("office_users").select("role")
      .eq("user_id", user.id).eq("office_id", office_id).eq("active", true).maybeSingle();
    if (!caller || !["admin", "owner"].includes(String(caller.role))) {
      return json({ error: "sem permissão neste escritório" }, 403);
    }

    const { data: office } = await admin.from("offices").select("name").eq("id", office_id).single();
    const officeName = esc(office?.name || "seu escritório");
    const greet = name ? `Olá, ${esc(name)}!` : "Olá!";
    const link = `${APP_URL}/login`;

    const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#f6f7f9;padding:32px 12px;">
      <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #eaecef;">
        <div style="background:#0f172a;padding:22px 28px;">
          <span style="color:#ffffff;font-weight:800;font-size:18px;letter-spacing:-0.3px;">Vextria<span style="color:#818cf8;">Hub</span></span>
        </div>
        <div style="padding:32px 28px;color:#1f2937;line-height:1.65;">
          <h1 style="margin:0 0 10px;font-size:20px;color:#0f172a;">Seu acesso está pronto 🎉</h1>
          <p style="margin:0 0 16px;color:#4b5563;">${greet} Você foi adicionado ao escritório <b>${officeName}</b> no VextriaHub.</p>
          <p style="margin:0 0 12px;color:#4b5563;">Seus dados de acesso:</p>
          <div style="background:#f9fafb;border:1px solid #eef0f5;border-radius:12px;padding:14px 16px;margin:0 0 22px;">
            <p style="margin:0 0 6px;font-size:13px;color:#6b7280;">E-mail</p>
            <p style="margin:0 0 12px;font-weight:700;">${esc(email)}</p>
            <p style="margin:0 0 6px;font-size:13px;color:#6b7280;">Senha provisória</p>
            <p style="margin:0;font-family:ui-monospace,Menlo,Consolas,monospace;font-weight:700;font-size:16px;letter-spacing:.5px;">${esc(password)}</p>
          </div>
          <div style="text-align:center;margin:0 0 22px;">
            <a href="${link}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:14px 34px;border-radius:10px;font-weight:700;font-size:15px;">Acessar o VextriaHub</a>
          </div>
          <p style="margin:0;color:#9ca3af;font-size:13px;border-top:1px solid #f0f1f3;padding-top:16px;">
            Por segurança, <b>altere sua senha no primeiro acesso</b> (em Perfil). Se você não esperava isso, ignore este e-mail.
          </p>
        </div>
        <div style="background:#f9fafb;padding:16px 28px;text-align:center;">
          <span style="color:#9ca3af;font-size:12px;">VextriaHub · e-mail automático, por favor não responda.</span>
        </div>
      </div>
    </div>`;

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: email, subject: `Seu acesso ao VextriaHub — ${office?.name || "escritório"}`, html }),
    });
    if (!resp.ok) return json({ error: "resend falhou", detail: await resp.text() }, 502);

    return json({ ok: true, to: email });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
