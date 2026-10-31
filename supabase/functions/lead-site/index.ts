// Edge Function "lead-site": recebe o formulário das landing pages e cria o lead
// na esteira Comercial do escritório (cliente com status "lead" + card em
// "Novo contato"). O painel do escritório lê e grava esse mesmo card.
//
// Chega de dois jeitos:
//   1) direto do navegador, com Origin de gustavodantas.adv.br;
//   2) pelo encaminhador "lead-site" do projeto Gestão (o config.js antigo das
//      landing pages ainda aponta para lá), com o cabeçalho x-lead-secret e o IP
//      real do visitante em x-lead-ip. O encaminhador também manda a campanha
//      do painel que casou com o utm_campaign (campanha_id / campanha_nome).
//
// Depois de gravar, avisa os administradores do escritório: sino do
// VextriaHub (notifications) e e-mail (Resend), com destaque para urgência.
import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED = new Set([
  "https://gustavodantas.adv.br",
  "https://www.gustavodantas.adv.br",
]);
const OFFICE = Deno.env.get("LEAD_OFFICE_ID") ?? "f220b1b5-f675-42e2-a8e8-a40664627009";
const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

// Segredo do encaminhador: fica no vault do banco (função lead_site_segredo).
let segredo: string | null = null;
async function segredoEncaminhador() {
  if (segredo === null) {
    const { data, error } = await sb.rpc("lead_site_segredo");
    if (error) { console.error("lead-site segredo", error.message); return ""; }
    segredo = typeof data === "string" ? data : "";
  }
  return segredo;
}

const RESEND = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM = "VextriaHub <avisos@vextriahub.com.br>";
const APP = "https://vextriahub.com.br";
const PAINEL = "https://painel.gustavodantas.adv.br/gestao/";

const hits = new Map<string, number[]>();
const MODES = new Set(["reajuste", "negativa", "dentistas", "previdenciario"]);

function corsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}
function reply(status: number, body: unknown, origin = "") {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...(origin ? corsHeaders(origin) : {}) },
  });
}
const clean = (v: unknown, max: number) =>
  // eslint-disable-next-line no-control-regex -- remove caracteres de controle do formulário
  String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const hoje = () =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date());

function iguais(a: string, b: string) {
  if (!a || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
const escH = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
function waLink(dig: string) {
  let d = dig;
  if (!d.startsWith("55") || d.length <= 11) d = "55" + d;
  return "https://wa.me/" + d;
}

type Aviso = {
  cardId: string; nome: string; telefone: string; dig: string; assunto: string; origem: string;
  campanha: string; urgente: boolean; modo: string;
};
async function avisar(a: Aviso) {
  const { data: card } = await sb.from("esteira_cards").select("esteira_id, created_at").eq("id", a.cardId).maybeSingle();
  const novo = !card || Date.now() - new Date(card.created_at).getTime() < 120_000;
  const link = card ? `/esteiras?esteira=${card.esteira_id}&card=${a.cardId}` : "/esteiras";
  const titulo = (a.urgente ? "URGENTE — " : "") + (novo ? "Novo lead do site: " : "Lead voltou ao formulário: ") + a.nome;
  const linha = [a.assunto, a.origem + (a.campanha ? ` (${a.campanha})` : "")].filter(Boolean).join(" · ");

  const { data: adms } = await sb.from("office_users").select("user_id").eq("office_id", OFFICE).eq("active", true).in("role", ["admin", "super_admin"]);
  const ids = (adms ?? []).map((x: { user_id: string }) => x.user_id);
  if (ids.length) {
    const { error } = await sb.from("notifications").insert(ids.map((uid) => ({
      user_id: uid, office_id: OFFICE, type: a.urgente ? "warning" : "info", title: titulo.slice(0, 200), message: linha.slice(0, 500),
      data: { action_url: link, action_label: "Abrir card", origem: "lead-site" },
    })));
    if (error) console.error("lead-site notificacao", error.message);
  }

  if (!RESEND) return;
  const extra = (Deno.env.get("LEAD_NOTIFY_EMAILS") ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  const emails: string[] = [...extra];
  for (const uid of ids) {
    const { data } = await sb.auth.admin.getUserById(uid);
    if (data.user?.email) emails.push(data.user.email);
  }
  const para = [...new Set(emails.map((e) => e.toLowerCase()))];
  if (!para.length) return;
  const cor = a.urgente ? "#C0392B" : "#E87C1E";
  const btn = (href: string, txt: string, fundo: string) =>
    `<a href="${href}" style="display:inline-block;margin:4px 8px 4px 0;padding:10px 16px;border-radius:8px;background:${fundo};color:#fff;text-decoration:none;font-weight:600">${txt}</a>`;
  const html = `<!doctype html><html><body style="margin:0;background:#f5f2ee;font-family:Arial,Helvetica,sans-serif;color:#17120f">
<div style="max-width:560px;margin:0 auto;padding:20px">
 <div style="background:#fff;border-radius:12px;border-top:4px solid ${cor};padding:20px">
  <p style="margin:0 0 4px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:${cor};font-weight:700">${a.urgente ? "Urgente · " : ""}${novo ? "Novo lead do site" : "Preencheu o formulário de novo"}</p>
  <h1 style="margin:0 0 12px;font-size:22px">${escH(a.nome)}</h1>
  <p style="margin:0 0 6px"><b>Assunto:</b> ${escH(a.assunto)}</p>
  <p style="margin:0 0 6px"><b>Telefone:</b> ${escH(a.telefone)}</p>
  <p style="margin:0 0 16px"><b>Origem:</b> ${escH(a.origem)}${a.campanha ? " · " + escH(a.campanha) : ""}</p>
  ${btn(waLink(a.dig), "Chamar no WhatsApp", "#1f8f4e")}${btn(APP + link, "Abrir no VextriaHub", "#2A2A2A")}${btn(PAINEL, "Abrir no painel", "#6b5f56")}
  <p style="margin:16px 0 0;font-size:12px;color:#65584f">Responder nos primeiros minutos aumenta muito a chance de fechar.</p>
 </div>
</div></body></html>`;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: para, subject: titulo.slice(0, 150), html }),
    });
    if (!r.ok) console.error("lead-site email", r.status, (await r.text()).slice(0, 200));
  } catch (e) { console.error("lead-site email", String(e)); }
}

function fmtTel(d: string) {
  if (d.startsWith("55") && d.length >= 12) d = d.slice(2);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d;
}
const PLANO: Record<string, string> = {
  individual: "individual ou familiar", adesao: "coletivo por adesão",
  empresarial: "empresarial", nao_sei: "tipo não informado",
};
const BENEFICIO: Record<string, string> = {
  bpc_idoso: "BPC pessoa idosa", bpc_deficiencia: "BPC pessoa com deficiência",
  auxilio_incapacidade: "auxílio por incapacidade temporária",
  aposentadoria_incapacidade: "aposentadoria por incapacidade permanente", outro: "outro/não sabe",
};
const SITUACAO: Record<string, string> = {
  nao_pedi: "ainda não pediu", analise: "pedido em análise", negado: "pedido negado",
  cessado: "benefício cessado ou reduzido", outro: "outra situação",
};

Deno.serve(async (req) => {
  const cab = req.headers.get("x-lead-secret") ?? "";
  const encaminhado = cab !== "" && iguais(cab, await segredoEncaminhador());
  const origin = encaminhado ? "" : (req.headers.get("origin") ?? "");
  if (req.method === "OPTIONS") {
    return ALLOWED.has(origin)
      ? new Response(null, { status: 204, headers: corsHeaders(origin) })
      : new Response(null, { status: 403 });
  }
  if (req.method !== "POST") return reply(405, { ok: false });
  if (!encaminhado && !ALLOWED.has(origin)) return reply(403, { ok: false });

  const raw = await req.text();
  if (raw.length > 8000) return reply(413, { ok: false }, origin);
  let p: Record<string, unknown>;
  try { p = JSON.parse(raw); } catch { return reply(400, { ok: false }, origin); }

  // Campo-isca: robô preenche, gente não vê. Responde ok e não grava nada.
  if (clean(p.empresa_site, 50)) return reply(200, { ok: true }, origin);

  const ip = (encaminhado ? req.headers.get("x-lead-ip") : null) ??
    ((req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "?");
  const agora = Date.now();
  const lista = (hits.get(ip) ?? []).filter((t) => agora - t < 600_000);
  if (lista.length >= 5) return reply(429, { ok: false }, origin);
  lista.push(agora); hits.set(ip, lista);

  const modo = clean(p.problema, 20);
  const nome = clean(p.nome, 120);
  const dig = clean(p.whatsapp, 30).replace(/\D/g, "");
  const email = clean(p.email, 160).toLowerCase();
  if (!MODES.has(modo) || nome.length < 2 || dig.length < 10 || dig.length > 13 || p.consentimento !== true ||
      (email && !/^\S+@\S+\.\S+$/.test(email))) {
    return reply(400, { ok: false }, origin);
  }
  const telefone = fmtTel(dig);
  const urgente = clean(p.urgencia, 5) === "sim";
  const dia = hoje();

  let assunto = "";
  if (modo === "reajuste") {
    const plano = PLANO[clean(p.tipo_plano, 20)] ?? "";
    const pct = clean(p.percentual, 20);
    assunto = "Reajuste de plano de saúde" + (plano || pct ? ` (${[plano, pct].filter(Boolean).join(", ")})` : "");
  } else if (modo === "negativa") {
    const det = clean(p.negativa_detalhe, 120);
    const esc = clean(p.negativa_escrito, 10);
    assunto = (urgente ? "URGENTE — " : "") + "Negativa de cobertura" + (det ? `: ${det}` : "") +
      (esc === "sim" ? " (tem negativa por escrito)" : esc === "pedi" ? " (pediu a negativa por escrito)" : "");
  } else if (modo === "previdenciario") {
    const ben = BENEFICIO[clean(p.beneficio, 40)] ?? "";
    const sit = SITUACAO[clean(p.situacao, 20)] ?? "";
    assunto = "Previdenciário" + (ben || sit ? ` (${[ben, sit].filter(Boolean).join(", ")})` : "");
  } else {
    assunto = "Assessoria para clínica odontológica (" +
      [clean(p.perfil, 20), clean(p.tamanho, 10) && `${clean(p.tamanho, 10)} profissionais`, clean(p.tema, 20), clean(p.cidade, 60)]
        .filter(Boolean).join(", ") + ")";
  }

  const utm = {
    source: clean(p.utm_source, 80), medium: clean(p.utm_medium, 80),
    campaign: clean(p.utm_campaign, 120), content: clean(p.utm_content, 120), term: clean(p.utm_term, 120),
  };
  const origem = utm.source || utm.medium ? "Anúncio pago" : "Site/Google";
  // Campanha do painel que casou com o utm_campaign (só vem do encaminhador).
  const campanhaId = encaminhado ? clean(p.campanha_id, 60) : "";
  const campanhaNome = encaminhado ? clean(p.campanha_nome, 140) : "";
  const nota = `Chegou pelo formulário do site (${modo})${urgente ? ", com URGÊNCIA" : ""}${campanhaNome ? ` — campanha ${campanhaNome}` : ""}`;

  const lead = {
    nome, telefone, email, origem, indicadoPor: "",
    nicho: modo === "dentistas" ? "Dentistas" : modo === "previdenciario" ? "Previdenciário" : "Saúde",
    campanhaId, isca: "", assunto, valor: 0, prox: dia,
    etapa: "Novo contato", entrada: dia,
    historico: [{ d: dia, t: nota }], criadoEm: Date.now(),
    site: {
      formulario: modo, urgencia: urgente ? "sim" : clean(p.urgencia, 5),
      profissao: clean(p.profissao, 30), jaTemAdvogado: clean(p.ja_tem_advogado, 5),
      utm, pagina: clean(p.pagina, 120),
      consentimento: true, consentimentoConteudo: p.consentimento_conteudo === true,
      consentimentoEm: clean(p.consentimento_em, 40) || new Date().toISOString(),
    },
  };
  const { data: cardId, error } = await sb.rpc("comercial_receber_site", { p_office: OFFICE, p_lead: lead, p_nota: nota });
  if (error) { console.error("lead-site rpc", error.message); return reply(500, { ok: false }, origin); }
  try {
    await avisar({ cardId: String(cardId), nome, telefone, dig, assunto, origem, campanha: campanhaNome, urgente, modo });
  } catch (e) { console.error("lead-site aviso", String(e)); /* o lead já está gravado; o aviso não pode derrubar a resposta */ }
  return reply(200, { ok: true }, origin);
});
