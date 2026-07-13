// Robô diário (cron) de AVISO DE PRAZO por E-MAIL. Roda com o app FECHADO — é o
// backstop server-side do sino in-app (useProximityNotifications só roda no login).
//
// Para cada escritório: junta prazos/audiências/tarefas/atendimentos que estão
// DENTRO da janela de antecedência (avisos_dias por item; senão o padrão de 3
// dias) e manda UM e-mail-resumo (digest) por advogado do escritório, via Resend.
//
// Idempotente: grava (user_id, dia) em email_digest_log com PK — se já mandou hoje,
// pula. Fuso de Brasília para o cálculo de "dias até" (prazo fatal não admite off-by-one).
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (injetados), ROBOT_SECRET, RESEND_API_KEY.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-robot-secret",
};

const FROM = "VextriaHub <prazos@vextriahub.com.br>";
const PADRAO_DIAS = 3;      // antecedência padrão quando o item não tem avisos_dias
const HORIZONTE_DIAS = 60;  // teto de segurança para o digest

// --- Lógica de antecedência (espelha src/lib/proximityAlert.ts, testada) ---
// "hoje" no fuso de Brasília; datas comparadas como dias de calendário.
const hojeYmd = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }); // YYYY-MM-DD
const HOJE0 = new Date(`${hojeYmd}T00:00:00`);
const parseNoon = (s: string) => new Date(s.length <= 10 ? `${s}T12:00:00` : s);
const diasAte = (s: string): number => {
  const a = parseNoon(s); a.setHours(0, 0, 0, 0);
  return Math.round((a.getTime() - HOJE0.getTime()) / 86_400_000);
};
const marcosDe = (it: any): number[] => {
  if (Array.isArray(it.avisos_dias)) return it.avisos_dias.filter((d: number) => d > 0);
  if (it.aviso_dias != null) return it.aviso_dias > 0 ? [it.aviso_dias] : [];
  return [PADRAO_DIAS];
};
const deveAvisar = (dias: number, marco: number) => dias >= 0 && dias <= marco;
const dataFatalPrazo = (p: any): string | null => p.data_fim_prazo || p.data_vencimento || null;

const naJanela = (it: any, fatal: string | null): boolean => {
  if (!fatal) return false;
  const d = diasAte(fatal);
  if (d < 0 || d > HORIZONTE_DIAS) return false;
  return marcosDe(it).some((D) => deveAvisar(d, D));
};

const label = (dias: number) => (dias <= 0 ? "hoje" : dias === 1 ? "amanhã" : `em ${dias} dias`);
const fmtBR = (s: string) => { const [y, m, d] = s.slice(0, 10).split("-"); return `${d}/${m}`; };
const esc = (s: string) => String(s || "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!));

interface Item { emoji: string; tipo: string; titulo: string; dias: number; data: string }

function montarHtml(nome: string, itens: Item[]): string {
  const linhas = itens.map((it) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #eef0f5;font-size:14px;color:#1a2030;">
        <span style="font-size:16px">${it.emoji}</span>
        <b style="color:#454fb8;text-transform:uppercase;font-size:11px;letter-spacing:.04em;margin:0 6px">${it.tipo}</b>
        ${esc(it.titulo)}
        <span style="color:#565e70">— ${it.dias <= 1 ? "<b style='color:#c33b33'>" : ""}${label(it.dias)}${it.dias <= 1 ? "</b>" : ""} (${fmtBR(it.data)})</span>
      </td>
    </tr>`).join("");
  return `<!doctype html><html><body style="margin:0;background:#f5f6f9;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif">
    <div style="max-width:560px;margin:0 auto;padding:28px 20px">
      <div style="background:#fff;border:1px solid #e5e8ef;border-radius:16px;padding:26px 28px">
        <p style="margin:0 0 2px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#8b93a4;font-weight:700">VextriaHub</p>
        <h1 style="margin:0 0 4px;font-size:20px;color:#1a2030">Olá, ${esc(nome)} 👋</h1>
        <p style="margin:0 0 18px;font-size:14px;color:#565e70">Você tem <b>${itens.length}</b> ${itens.length === 1 ? "compromisso" : "compromissos"} chegando:</p>
        <table role="presentation" width="100%" style="border-collapse:collapse">${linhas}</table>
        <p style="margin:20px 0 0;font-size:12px;color:#8b93a4">Aviso automático do VextriaHub. Abra o sistema para ver os detalhes e confirmar cada prazo.</p>
      </div>
    </div></body></html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders, status: 204 });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ROBOT_SECRET = Deno.env.get("ROBOT_SECRET") || "";
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
  const secret = req.headers.get("x-robot-secret") || "";
  if (ROBOT_SECRET && secret !== ROBOT_SECRET) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ ok: false, error: "RESEND_API_KEY ausente" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Modo teste: {"test_email":"voce@..."} manda TODOS os digests só pra esse
  // endereço (sem gravar log de idempotência), pra conferir antes de ir ao ar.
  const body = await req.json().catch(() => ({} as any));
  const testEmail: string | null = body?.test_email || null;

  const supa = createClient(SUPABASE_URL, SERVICE_ROLE);

  const enviarEmail = async (to: string, subject: string, html: string) => {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to, subject, html }),
    });
    return resp.ok;
  };

  try {
    const { data: offices } = await supa.from("offices").select("id");
    let enviados = 0;
    const detalhes: any[] = [];

    for (const office of offices || []) {
      const officeId = (office as any).id;

      // Advogados do escritório com e-mail
      const { data: profs } = await supa.from("profiles")
        .select("user_id, email, full_name").eq("office_id", officeId).not("email", "is", null);
      if (!profs?.length) continue;

      // Itens ativos do escritório
      const [prazos, audiencias, tarefas, atendimentos] = await Promise.all([
        supa.from("prazos").select("*, publicacoes(titulo)").eq("office_id", officeId).neq("status", "concluido"),
        supa.from("audiencias").select("*").eq("office_id", officeId).eq("deletado", false).not("status", "in", "(realizada,cancelada)"),
        supa.from("tarefas").select("*").eq("office_id", officeId).eq("deletado", false).eq("concluida", false),
        supa.from("atendimentos").select("*, clientes(nome)").eq("office_id", officeId).eq("deletado", false).in("status", ["agendado", "pendente"]),
      ]);

      const itens: Item[] = [];
      (prazos.data || []).forEach((p: any) => {
        if (p.titular === "contraria") return; // prazo da parte contrária: só monitoramento
        const fatal = dataFatalPrazo(p);
        if (!naJanela(p, fatal)) return;
        itens.push({ emoji: "⚖️", tipo: "Prazo", titulo: p.publicacoes?.titulo || p.tipo_prazo || p.numero_processo || "Prazo", dias: diasAte(fatal!), data: fatal! });
      });
      (audiencias.data || []).forEach((a: any) => {
        if (!naJanela(a, a.data_audiencia)) return;
        itens.push({ emoji: "📅", tipo: "Audiência", titulo: a.titulo || "Audiência", dias: diasAte(a.data_audiencia), data: a.data_audiencia });
      });
      (tarefas.data || []).forEach((t: any) => {
        if (!naJanela(t, t.data_vencimento)) return;
        itens.push({ emoji: "✓", tipo: "Tarefa", titulo: t.titulo || "Tarefa", dias: diasAte(t.data_vencimento), data: t.data_vencimento });
      });
      (atendimentos.data || []).forEach((a: any) => {
        if (!naJanela(a, a.data_atendimento)) return;
        const nome = a.clientes?.nome ? ` — ${a.clientes.nome}` : "";
        itens.push({ emoji: "👤", tipo: "Atendimento", titulo: `${a.tipo_atendimento || "Atendimento"}${nome}`, dias: diasAte(a.data_atendimento), data: a.data_atendimento });
      });

      if (!itens.length) continue; // nada na janela hoje → escritório não recebe e-mail
      itens.sort((x, y) => x.dias - y.dias); // mais urgente primeiro

      const nPrazos = itens.filter((i) => i.tipo === "Prazo").length;
      const subject = nPrazos > 0
        ? `⚖️ ${nPrazos} ${nPrazos === 1 ? "prazo" : "prazos"} e mais ${itens.length - nPrazos} ${itens.length - nPrazos === 1 ? "item" : "itens"} chegando`
        : `Você tem ${itens.length} ${itens.length === 1 ? "compromisso" : "compromissos"} chegando`;

      for (const p of profs) {
        const uid = (p as any).user_id;
        const email = (p as any).email;
        if (!email) continue;
        const to = testEmail || email;

        // Idempotência (pulada em teste): PK (user_id, ref_date). Se já enviou hoje, o insert falha → pula.
        if (!testEmail) {
          const { error: dupErr } = await supa.from("email_digest_log").insert({ user_id: uid, ref_date: hojeYmd });
          if (dupErr) { detalhes.push({ email, status: "ja_enviado_hoje" }); continue; }
        }

        const ok = await enviarEmail(to, subject, montarHtml((p as any).full_name || "advogado(a)", itens));
        if (ok) { enviados++; detalhes.push({ email: to, status: "enviado", itens: itens.length }); }
        else detalhes.push({ email: to, status: "falha_resend" });
      }
    }

    return new Response(JSON.stringify({ ok: true, enviados, hoje: hojeYmd, detalhes }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
