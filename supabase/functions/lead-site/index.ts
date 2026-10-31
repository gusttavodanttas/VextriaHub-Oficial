// Edge Function "lead-site": recebe o formulário das landing pages e cria o lead
// na esteira Comercial do escritório (cliente com status "lead" + card em
// "Novo contato"). O painel do escritório lê e grava esse mesmo card.
//
// Chega de dois jeitos:
//   1) direto do navegador, com Origin de gustavodantas.adv.br;
//   2) pelo encaminhador "lead-site" do projeto Gestão (o config.js antigo das
//      landing pages ainda aponta para lá), com o cabeçalho x-lead-secret e o IP
//      real do visitante em x-lead-ip.
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
  const nota = `Chegou pelo formulário do site (${modo})${urgente ? ", com URGÊNCIA" : ""}`;

  const lead = {
    nome, telefone, email, origem, indicadoPor: "",
    nicho: modo === "dentistas" ? "Dentistas" : modo === "previdenciario" ? "Previdenciário" : "Saúde",
    campanhaId: "", isca: "", assunto, valor: 0, prox: dia,
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
  const { error } = await sb.rpc("comercial_receber_site", { p_office: OFFICE, p_lead: lead, p_nota: nota });
  if (error) { console.error("lead-site rpc", error.message); return reply(500, { ok: false }, origin); }
  return reply(200, { ok: true }, origin);
});
