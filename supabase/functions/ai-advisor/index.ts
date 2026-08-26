import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Conselheiro IA (OpenAI) ────────────────────────────────────────────────
// Recurso PREMIUM. Chave da Vextria (segredo OPENAI_API_KEY). Modos:
//   chat  → conversa + AÇÕES (criar prazo/audiência/tarefa/processo via tools)
//   insights / resumo_processo / resumo_publicacao → saídas estruturadas (JSON)
// Segurança: só autenticado; só premium/vitalício/cortesia (ou super admin).
// TODA leitura E escrita é escopada no office_id do próprio usuário.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") || "";
const OPENAI_MODEL = Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini";
const periodDays: Record<string, number> = { hoje: 1, semana: 7, mes: 30, ano: 365 };
const periodLabel: Record<string, string> = { hoje: "hoje", semana: "esta semana", mes: "este mês", ano: "este ano" };

interface ToolCall { id: string; function: { name: string; arguments: string }; }
interface OAIMsg { role: string; content?: string | null; tool_calls?: ToolCall[]; tool_call_id?: string; }
interface OAIResp { choices?: { message?: OAIMsg }[]; error?: { message?: string }; }
interface ToolArgs { titulo?: string; data?: string; hora?: string; local?: string; prioridade?: string; processo_numero?: string; numero?: string; parte_autora?: string; requerido?: string; termo?: string; nome?: string; telefone?: string; email?: string; descricao?: string; oab?: string; uf?: string; cidades?: string; tipo?: string; valor?: number; fin_tipo?: string; correspondente_nome?: string; dias?: number; }

async function openaiRaw(messages: OAIMsg[], opts: { tools?: unknown[]; json?: boolean } = {}): Promise<OAIResp> {
  const body: Record<string, unknown> = { model: OPENAI_MODEL, temperature: 0.4, messages };
  if (opts.tools) { body.tools = opts.tools; body.tool_choice = "auto"; }
  if (opts.json) body.response_format = { type: "json_object" };
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as OAIResp;
  if (!res.ok) throw new Error(data?.error?.message || `openai-${res.status}`);
  return data;
}
async function chatCompletion(messages: OAIMsg[], jsonMode: boolean): Promise<string> {
  const r = await openaiRaw(messages, { json: jsonMode });
  return r.choices?.[0]?.message?.content || "";
}
function parseJson(s: string): Record<string, unknown> {
  try { return JSON.parse(s); } catch { return { resumo: String(s).slice(0, 4000) }; }
}

// ── Ferramentas de criação (executadas server-side, sempre no office do usuário) ──
const TOOLS = [
  { type: "function", function: { name: "criar_prazo", description: "Cria um prazo (deadline). Use quando o usuário pedir para adicionar/criar um prazo.", parameters: { type: "object", properties: {
    titulo: { type: "string", description: "título do prazo" },
    data: { type: "string", description: "data fatal no formato YYYY-MM-DD" },
    prioridade: { type: "string", enum: ["baixa", "media", "alta", "urgente"] },
    processo_numero: { type: "string", description: "número CNJ do processo a vincular (opcional)" },
  }, required: ["titulo", "data"] } } },
  { type: "function", function: { name: "criar_audiencia", description: "Agenda uma audiência.", parameters: { type: "object", properties: {
    titulo: { type: "string" }, data: { type: "string", description: "YYYY-MM-DD" }, hora: { type: "string", description: "HH:MM em 24h" },
    local: { type: "string" }, processo_numero: { type: "string", description: "número CNJ (opcional)" },
  }, required: ["titulo", "data", "hora"] } } },
  { type: "function", function: { name: "criar_tarefa", description: "Cria uma tarefa.", parameters: { type: "object", properties: {
    titulo: { type: "string" }, data: { type: "string", description: "vencimento YYYY-MM-DD (opcional)" }, prioridade: { type: "string", enum: ["baixa", "media", "alta"] },
  }, required: ["titulo"] } } },
  { type: "function", function: { name: "criar_processo", description: "Cria um novo caso/processo.", parameters: { type: "object", properties: {
    titulo: { type: "string" }, numero: { type: "string", description: "número CNJ (opcional)" }, parte_autora: { type: "string" }, requerido: { type: "string" },
  }, required: ["titulo"] } } },
  { type: "function", function: { name: "verificar_clientes_duplicados", description: "Verifica a lista de clientes do escritório e retorna os que aparecem duplicados (mesmo nome, ignorando acento e maiúsculas). Use quando o usuário perguntar sobre clientes duplicados/repetidos.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "buscar_clientes", description: "Busca clientes do escritório por parte do nome. Use quando o usuário perguntar se existe um cliente, quantos com tal nome, etc.", parameters: { type: "object", properties: { termo: { type: "string", description: "parte do nome a buscar" } }, required: ["termo"] } } },
  { type: "function", function: { name: "criar_cliente", description: "Cadastra um novo cliente no escritório.", parameters: { type: "object", properties: { nome: { type: "string" }, telefone: { type: "string" }, email: { type: "string" } }, required: ["nome"] } } },
  { type: "function", function: { name: "buscar_processos", description: "Busca processos por título, número CNJ ou nome da parte.", parameters: { type: "object", properties: { termo: { type: "string" } }, required: ["termo"] } } },
  { type: "function", function: { name: "registrar_andamento", description: "Registra um andamento (movimentação) em um processo existente.", parameters: { type: "object", properties: { processo_numero: { type: "string", description: "número CNJ do processo" }, descricao: { type: "string" }, data: { type: "string", description: "YYYY-MM-DD (opcional, padrão hoje)" } }, required: ["processo_numero", "descricao"] } } },
  { type: "function", function: { name: "resumo_financeiro", description: "Resumo financeiro do escritório: total a receber e a pagar (pendentes/vencidos).", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "concluir_tarefa", description: "Marca uma tarefa pendente como concluída (encontra pelo título).", parameters: { type: "object", properties: { termo: { type: "string", description: "título ou parte do título da tarefa" } }, required: ["termo"] } } },
  { type: "function", function: { name: "concluir_prazo", description: "Marca um prazo pendente como cumprido/concluído (encontra pelo título).", parameters: { type: "object", properties: { termo: { type: "string" } }, required: ["termo"] } } },
  { type: "function", function: { name: "criar_correspondente", description: "Cadastra um correspondente jurídico.", parameters: { type: "object", properties: { nome: { type: "string" }, oab: { type: "string" }, uf: { type: "string" }, telefone: { type: "string" }, cidades: { type: "string", description: "comarcas que atende, separadas por vírgula" } }, required: ["nome"] } } },
  { type: "function", function: { name: "criar_diligencia", description: "Cria uma diligência para um correspondente.", parameters: { type: "object", properties: { tipo: { type: "string", enum: ["audiencia", "protocolo", "copia", "carga", "despacho", "sustentacao", "outro"] }, comarca: { type: "string" }, uf: { type: "string" }, data: { type: "string", description: "YYYY-MM-DD" }, valor: { type: "number" }, correspondente_nome: { type: "string" } }, required: [] } } },
  { type: "function", function: { name: "criar_lancamento_financeiro", description: "Lança uma receita ou despesa no financeiro.", parameters: { type: "object", properties: { fin_tipo: { type: "string", enum: ["receita", "despesa"] }, descricao: { type: "string" }, valor: { type: "number" }, data: { type: "string", description: "vencimento YYYY-MM-DD" } }, required: ["fin_tipo", "descricao", "valor", "data"] } } },
  { type: "function", function: { name: "listar_prazos", description: "Lista os próximos prazos (e vencidos) do escritório.", parameters: { type: "object", properties: { dias: { type: "number", description: "janela em dias (padrão 14)" } } } } },
  { type: "function", function: { name: "listar_audiencias", description: "Lista as próximas audiências do escritório.", parameters: { type: "object", properties: { dias: { type: "number", description: "janela em dias (padrão 30)" } } } } },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function executeTool(service: any, officeId: string, uid: string, name: string, args: ToolArgs) {
  const clean = (s?: string) => String(s || "").replace(/\D/g, "");
  const resolveProcesso = async (numero?: string) => {
    const n = clean(numero);
    if (!n) return null;
    const { data } = await service.from("processos").select("id").eq("office_id", officeId).eq("numero_processo", n).eq("deletado", false).maybeSingle();
    return data?.id ?? null;
  };
  try {
    if (name === "criar_prazo") {
      if (!args.titulo || !args.data) return { ok: false, error: "faltou título ou data" };
      const pid = await resolveProcesso(args.processo_numero);
      const { data, error } = await service.from("prazos").insert({ office_id: officeId, user_id: uid, responsavel_id: uid, titulo: args.titulo, data_vencimento: args.data, data_fim_prazo: args.data, prioridade: args.prioridade || "media", status: "pendente", processo_id: pid }).select("id").single();
      if (error) throw error;
      return { ok: true, tipo: "prazo", id: data.id, titulo: args.titulo, data: args.data };
    }
    if (name === "criar_audiencia") {
      if (!args.titulo || !args.data) return { ok: false, error: "faltou título ou data" };
      const pid = await resolveProcesso(args.processo_numero);
      const dt = new Date(`${args.data}T${args.hora || "00:00"}:00-03:00`).toISOString();
      const { data, error } = await service.from("audiencias").insert({ office_id: officeId, user_id: uid, responsavel_id: uid, titulo: args.titulo, data_audiencia: dt, local: args.local || null, status: "agendada", processo_id: pid }).select("id").single();
      if (error) throw error;
      return { ok: true, tipo: "audiencia", id: data.id, titulo: args.titulo, data: args.data, hora: args.hora };
    }
    if (name === "criar_tarefa") {
      if (!args.titulo) return { ok: false, error: "faltou título" };
      const { data, error } = await service.from("tarefas").insert({ office_id: officeId, user_id: uid, responsavel_id: uid, titulo: args.titulo, data_vencimento: args.data || null, prioridade: args.prioridade || "media", status: "pendente" }).select("id").single();
      if (error) throw error;
      return { ok: true, tipo: "tarefa", id: data.id, titulo: args.titulo };
    }
    if (name === "criar_processo") {
      if (!args.titulo) return { ok: false, error: "faltou título" };
      const { data, error } = await service.from("processos").insert({ office_id: officeId, user_id: uid, responsavel_id: uid, titulo: args.titulo, numero_processo: clean(args.numero) || "", parte_autora: args.parte_autora || null, requerido: args.requerido || null, status: "ativo" }).select("id").single();
      if (error) throw error;
      return { ok: true, tipo: "processo", id: data.id, titulo: args.titulo };
    }
    if (name === "verificar_clientes_duplicados") {
      const { data } = await service.from("clientes").select("id, nome").eq("office_id", officeId).eq("deletado", false);
      const norm = (s: string) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
      const groups: Record<string, string[]> = {};
      for (const c of (data || [])) { const k = norm(c.nome); if (!k) continue; (groups[k] = groups[k] || []).push(c.nome); }
      const dups = Object.values(groups).filter((g) => g.length > 1).map((g) => ({ nome: g[0], quantidade: g.length }));
      return { ok: true, tipo: "clientes_duplicados", total_clientes: (data || []).length, grupos_duplicados: dups.length, duplicados: dups.slice(0, 30) };
    }
    if (name === "buscar_clientes") {
      const termo = String(args.termo || "").trim();
      if (!termo) return { ok: false, error: "informe o termo de busca" };
      const { data } = await service.from("clientes").select("nome").eq("office_id", officeId).eq("deletado", false).ilike("nome", `%${termo}%`).limit(15);
      return { ok: true, tipo: "busca_clientes", termo, encontrados: (data || []).map((c: { nome?: string }) => c.nome) };
    }
    if (name === "criar_cliente") {
      if (!args.nome) return { ok: false, error: "faltou o nome" };
      const { data, error } = await service.from("clientes").insert({ office_id: officeId, user_id: uid, nome: args.nome, telefone: args.telefone || null, email: args.email || null }).select("id").single();
      if (error) throw error;
      return { ok: true, tipo: "cliente", id: data.id, nome: args.nome };
    }
    if (name === "buscar_processos") {
      const termo = String(args.termo || "").trim();
      if (!termo) return { ok: false, error: "informe o termo" };
      const num = clean(termo);
      const esc = termo.replace(/[%,()]/g, " ");
      const orExpr = `titulo.ilike.%${esc}%,parte_autora.ilike.%${esc}%` + (num ? `,numero_processo.ilike.%${num}%` : "");
      const { data } = await service.from("processos").select("titulo, numero_processo, parte_autora").eq("office_id", officeId).eq("deletado", false).or(orExpr).limit(10);
      return { ok: true, tipo: "busca_processos", termo, encontrados: (data || []).map((p: { titulo?: string; numero_processo?: string; parte_autora?: string }) => ({ titulo: p.titulo, numero: p.numero_processo, parte: p.parte_autora })) };
    }
    if (name === "registrar_andamento") {
      if (!args.processo_numero || !args.descricao) return { ok: false, error: "faltou processo ou descrição" };
      const pid = await resolveProcesso(args.processo_numero);
      if (!pid) return { ok: false, error: "processo não encontrado pelo número informado" };
      const dt = args.data ? new Date(`${args.data}T12:00:00-03:00`).toISOString() : new Date().toISOString();
      const { data, error } = await service.from("movimentacoes_processo").insert({ office_id: officeId, processo_id: pid, descricao: args.descricao, data_movimentacao: dt, tipo: "manual" }).select("id").single();
      if (error) throw error;
      return { ok: true, tipo: "andamento", id: data.id };
    }
    if (name === "resumo_financeiro") {
      const { data } = await service.from("financeiro").select("tipo, valor, status").eq("office_id", officeId).eq("deletado", false);
      let aReceber = 0, aPagar = 0;
      for (const f of (data || [])) {
        if (f.status !== "pendente" && f.status !== "vencido") continue;
        if (f.tipo === "receita") aReceber += Number(f.valor || 0);
        else if (f.tipo === "despesa") aPagar += Number(f.valor || 0);
      }
      return { ok: true, tipo: "resumo_financeiro", a_receber: aReceber, a_pagar: aPagar };
    }
    if (name === "concluir_tarefa") {
      const termo = String(args.termo || "").trim();
      if (!termo) return { ok: false, error: "informe qual tarefa" };
      const { data } = await service.from("tarefas").select("id, titulo").eq("office_id", officeId).eq("deletado", false).neq("status", "concluida").ilike("titulo", `%${termo}%`).limit(3);
      if (!data || !data.length) return { ok: false, error: "nenhuma tarefa pendente com esse nome" };
      if (data.length > 1) return { ok: false, error: "varias casaram: " + data.map((t: { titulo?: string }) => t.titulo).join("; ") + ". Peca ao usuario para especificar." };
      await service.from("tarefas").update({ concluida: true, status: "concluida" }).eq("id", data[0].id);
      return { ok: true, tipo: "tarefa_concluida", titulo: data[0].titulo };
    }
    if (name === "concluir_prazo") {
      const termo = String(args.termo || "").trim();
      if (!termo) return { ok: false, error: "informe qual prazo" };
      const { data } = await service.from("prazos").select("id, titulo").eq("office_id", officeId).neq("status", "concluido").ilike("titulo", `%${termo}%`).limit(3);
      if (!data || !data.length) return { ok: false, error: "nenhum prazo pendente com esse nome" };
      if (data.length > 1) return { ok: false, error: "varios casaram: " + data.map((t: { titulo?: string }) => t.titulo).join("; ") + ". Peca para especificar." };
      await service.from("prazos").update({ status: "concluido" }).eq("id", data[0].id);
      return { ok: true, tipo: "prazo_concluido", titulo: data[0].titulo };
    }
    if (name === "criar_correspondente") {
      if (!args.nome) return { ok: false, error: "faltou o nome" };
      const cidades = String(args.cidades || "").split(",").map((s) => s.trim()).filter(Boolean);
      const { data, error } = await service.from("correspondentes").insert({ office_id: officeId, user_id: uid, nome: args.nome, oab: args.oab || null, uf: args.uf || null, telefone: args.telefone || null, cidades }).select("id").single();
      if (error) throw error;
      return { ok: true, tipo: "correspondente", id: data.id, nome: args.nome };
    }
    if (name === "criar_diligencia") {
      let corrId: string | null = null;
      if (args.correspondente_nome) { const { data: c } = await service.from("correspondentes").select("id").eq("office_id", officeId).ilike("nome", `%${args.correspondente_nome}%`).limit(1).maybeSingle(); corrId = c?.id ?? null; }
      const dt = args.data ? new Date(`${args.data}T12:00:00-03:00`).toISOString() : null;
      const { data, error } = await service.from("diligencias").insert({ office_id: officeId, user_id: uid, correspondente_id: corrId, tipo: args.tipo || "audiencia", comarca: args.comarca || null, uf: args.uf || null, data_diligencia: dt, valor: args.valor != null ? Number(args.valor) : null, status: "solicitada" }).select("id").single();
      if (error) throw error;
      return { ok: true, tipo: "diligencia", id: data.id };
    }
    if (name === "criar_lancamento_financeiro") {
      if (!args.fin_tipo || !args.descricao || args.valor == null || !args.data) return { ok: false, error: "faltou tipo, descricao, valor ou data" };
      const { data, error } = await service.from("financeiro").insert({ office_id: officeId, user_id: uid, tipo: args.fin_tipo, descricao: args.descricao, valor: Number(args.valor), data_vencimento: args.data, status: "pendente" }).select("id").single();
      if (error) throw error;
      return { ok: true, tipo: "lancamento_financeiro", id: data.id, fin_tipo: args.fin_tipo, valor: Number(args.valor) };
    }
    if (name === "listar_prazos") {
      const dias = Number(args.dias) || 14;
      const hoje = new Date().toISOString().slice(0, 10);
      const ate = new Date(Date.now() + dias * 86400000).toISOString().slice(0, 10);
      const { data } = await service.from("prazos").select("titulo, data_fim_prazo").eq("office_id", officeId).neq("status", "concluido").lte("data_fim_prazo", ate).order("data_fim_prazo").limit(20);
      return { ok: true, tipo: "lista_prazos", hoje, prazos: (data || []).map((p: { titulo?: string; data_fim_prazo?: string }) => ({ titulo: p.titulo, data: p.data_fim_prazo, vencido: (p.data_fim_prazo || "") < hoje })) };
    }
    if (name === "listar_audiencias") {
      const dias = Number(args.dias) || 30;
      const nowI = new Date().toISOString();
      const ate = new Date(Date.now() + dias * 86400000).toISOString();
      const { data } = await service.from("audiencias").select("titulo, data_audiencia").eq("office_id", officeId).not("status", "in", "(cancelada,realizada)").gte("data_audiencia", nowI).lte("data_audiencia", ate).order("data_audiencia").limit(20);
      return { ok: true, tipo: "lista_audiencias", audiencias: (data || []).map((a: { titulo?: string; data_audiencia?: string }) => ({ titulo: a.titulo, data: a.data_audiencia })) };
    }
    return { ok: false, error: "ferramenta desconhecida" };
  } catch (e) {
    return { ok: false, error: String((e as Error).message || e) };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildSnapshot(service: any, officeId: string, officeName: string, period: string) {
  const dias = periodDays[period] ?? 7;
  const hoje = new Date().toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();
  const ate = new Date(Date.now() + dias * 86400000).toISOString().slice(0, 10);
  const desde = new Date(Date.now() - dias * 86400000).toISOString();
  const q = service;
  const [
    procAtivos, prazosVencendo, prazosVencidos, audProximas, pubNovas, tarefasPend, tarefasVencidas, diligPagar, movRecentes, listaPrazos, listaAud, listaPub,
  ] = await Promise.all([
    q.from("processos").select("id", { count: "exact", head: true }).eq("office_id", officeId).eq("status", "ativo").eq("deletado", false),
    q.from("prazos").select("id", { count: "exact", head: true }).eq("office_id", officeId).neq("status", "concluido").gte("data_fim_prazo", hoje).lte("data_fim_prazo", ate),
    q.from("prazos").select("id", { count: "exact", head: true }).eq("office_id", officeId).neq("status", "concluido").lt("data_fim_prazo", hoje),
    q.from("audiencias").select("id", { count: "exact", head: true }).eq("office_id", officeId).not("status", "in", "(cancelada,realizada)").gte("data_audiencia", nowIso).lte("data_audiencia", ate + "T23:59:59"),
    q.from("publicacoes").select("id", { count: "exact", head: true }).eq("office_id", officeId).eq("status", "nova"),
    q.from("tarefas").select("id", { count: "exact", head: true }).eq("office_id", officeId).eq("status", "pendente").eq("deletado", false),
    q.from("tarefas").select("id", { count: "exact", head: true }).eq("office_id", officeId).eq("status", "pendente").eq("deletado", false).lt("data_vencimento", hoje),
    q.from("diligencias").select("valor").eq("office_id", officeId).eq("status", "realizada").eq("pago", false),
    q.from("movimentacoes_processo").select("id", { count: "exact", head: true }).eq("office_id", officeId).gte("data_movimentacao", desde),
    q.from("prazos").select("titulo, data_fim_prazo").eq("office_id", officeId).neq("status", "concluido").gte("data_fim_prazo", hoje).lte("data_fim_prazo", ate).order("data_fim_prazo").limit(6),
    q.from("audiencias").select("titulo, data_audiencia").eq("office_id", officeId).not("status", "in", "(cancelada,realizada)").gte("data_audiencia", nowIso).order("data_audiencia").limit(6),
    q.from("publicacoes").select("titulo, data_publicacao").eq("office_id", officeId).eq("status", "nova").order("data_publicacao", { ascending: false }).limit(6),
  ]);
  const diligValor = (diligPagar.data || []).reduce((s: number, d: { valor?: number | null }) => s + Number(d.valor || 0), 0);
  return {
    escritorio: officeName || "escritório", periodo: periodLabel[period] || "esta semana",
    numeros: {
      processos_ativos: procAtivos.count ?? 0, prazos_vencendo: prazosVencendo.count ?? 0, prazos_vencidos: prazosVencidos.count ?? 0,
      audiencias_proximas: audProximas.count ?? 0, publicacoes_nao_tratadas: pubNovas.count ?? 0, tarefas_pendentes: tarefasPend.count ?? 0,
      tarefas_atrasadas: tarefasVencidas.count ?? 0, diligencias_a_pagar: (diligPagar.data || []).length, valor_diligencias_a_pagar: diligValor,
      movimentacoes_no_periodo: movRecentes.count ?? 0,
    },
    prazos_proximos: (listaPrazos.data || []).map((p: { titulo?: string; data_fim_prazo?: string }) => ({ titulo: p.titulo, data: p.data_fim_prazo })),
    audiencias_proximas: (listaAud.data || []).map((a: { titulo?: string; data_audiencia?: string }) => ({ titulo: a.titulo, data: a.data_audiencia })),
    publicacoes_novas: (listaPub.data || []).map((p: { titulo?: string; data_publicacao?: string }) => ({ titulo: p.titulo, data: p.data_publicacao })),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const anon = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
    const { data: u } = await anon.auth.getUser();
    const uid = u?.user?.id;
    if (!uid) return json({ error: "nao-autenticado" }, 401);

    const service = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: prof } = await service.from("profiles").select("role, office_id").eq("user_id", uid).maybeSingle();
    let officeId = prof?.office_id as string | null;
    if (!officeId) {
      const { data: ou } = await service.from("office_users").select("office_id").eq("user_id", uid).eq("active", true).order("joined_at").limit(1).maybeSingle();
      officeId = ou?.office_id ?? null;
    }
    if (!officeId) return json({ error: "sem-escritorio" }, 400);

    const { data: office } = await service.from("offices").select("name, plan, access_type").eq("id", officeId).maybeSingle();
    const isSuper = prof?.role === "super_admin";
    const hasIA = isSuper || office?.access_type === "lifetime" || office?.access_type === "courtesy" || office?.plan === "premium" || office?.plan === "cortesia";
    if (!hasIA) return json({ error: "premium-required", message: "O Conselheiro IA está disponível no plano Premium." }, 403);
    if (!OPENAI_KEY) return json({ error: "openai-nao-configurada", message: "A IA ainda não foi configurada. Defina o segredo OPENAI_API_KEY." }, 503);

    const body = await req.json().catch(() => ({}));
    const mode = String(body?.mode || "chat");
    const nowIso = new Date().toISOString();

    // ── CHAT (conversa + ações) ──
    if (mode === "chat") {
      const raw = Array.isArray(body?.messages) ? body.messages : [];
      const history: OAIMsg[] = raw.filter((m: OAIMsg) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string").slice(-12).map((m: OAIMsg) => ({ role: m.role, content: String(m.content).slice(0, 4000) }));
      if (!history.length) return json({ error: "sem-mensagem" }, 400);
      const snap = await buildSnapshot(service, officeId, office?.name || "", "semana");
      const system =
        `Você é o "Conselheiro IA", assistente de gestão do escritório de advocacia "${office?.name || ""}" na plataforma VextriaHub. Cordial, direto, em português do Brasil.\n` +
        `ESTILO: seja ENXUTO por padrão — responda curto e direto (1-3 frases ou uma lista curta). Se houver muito a dizer, dê só o essencial e ofereça detalhar ("quer que eu detalhe?"). Só se aprofunde quando pedirem. NÃO use títulos de markdown (#, ##, ###) nem tabelas; pode usar **negrito** e listas com "-".\n` +
        `AÇÕES: você PODE criar (prazo, audiência, tarefa, caso/processo, cliente, correspondente, diligência, lançamento financeiro), registrar andamento, concluir tarefa/prazo, e CONSULTAR (clientes duplicados, buscar clientes, buscar processos, resumo financeiro, listar prazos, listar audiências), usando as ferramentas. Para consultas, chame a ferramenta direto e responda com o resultado. Para CRIAR/alterar: (1) só quando o usuário claramente pedir; (2) ANTES de criar/concluir, confirme os dados essenciais em 1 frase e só chame a ferramenta após um "sim"; (3) nunca invente datas ou nomes — se faltar algo essencial, pergunte; (4) datas no formato YYYY-MM-DD; (5) ao agir, diga em 1 frase o que foi feito.\n` +
        `Panorama atual do escritório (use quando ajudar, sem inventar além disto): ${JSON.stringify(snap.numeros)}`;

      const msgs: OAIMsg[] = [{ role: "system", content: system }, ...history];
      const actions: Array<Record<string, unknown>> = [];
      let reply = "Pronto.";
      for (let turn = 0; turn < 4; turn++) {
        const r = await openaiRaw(msgs, { tools: TOOLS });
        const m = r.choices?.[0]?.message;
        if (m?.tool_calls?.length) {
          msgs.push(m);
          for (const tc of m.tool_calls) {
            let a: ToolArgs = {};
            try { a = JSON.parse(tc.function.arguments || "{}"); } catch { a = {}; }
            const result = await executeTool(service, officeId, uid, tc.function.name, a);
            if (result.ok && (/^(criar_|concluir_)/.test(tc.function.name) || tc.function.name === "registrar_andamento")) actions.push(result);
            msgs.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result) });
          }
          continue;
        }
        reply = m?.content || "Pronto.";
        break;
      }
      return json({ ok: true, mode, reply, actions });
    }

    // ── RESUMO DE PROCESSO ──
    if (mode === "resumo_processo") {
      const processoId = String(body?.processoId || "");
      if (!processoId) return json({ error: "processoId-obrigatorio" }, 400);
      const { data: p } = await service.from("processos").select("id, titulo, numero_processo, parte_autora, requerido, status, classe_judicial, assunto_principal, tribunal, vara, comarca, valor_causa").eq("id", processoId).eq("office_id", officeId).eq("deletado", false).maybeSingle();
      if (!p) return json({ error: "processo-nao-encontrado" }, 404);
      const { data: movs } = await service.from("movimentacoes_processo").select("data_movimentacao, descricao, tipo").eq("processo_id", processoId).order("data_movimentacao", { ascending: false }).limit(40);
      const { data: prazos } = await service.from("prazos").select("titulo, data_fim_prazo, status").eq("processo_id", processoId).neq("status", "concluido").limit(10);
      const { data: auds } = await service.from("audiencias").select("titulo, data_audiencia, status").eq("processo_id", processoId).gte("data_audiencia", nowIso).limit(10);
      const payload = { processo: p, andamentos: (movs || []).map((m: { data_movimentacao?: string; descricao?: string; tipo?: string }) => ({ data: m.data_movimentacao, texto: m.descricao, tipo: m.tipo })), prazos_abertos: prazos || [], proximas_audiencias: auds || [] };
      const out = parseJson(await chatCompletion([{ role: "system", content: "Você é um advogado sênior que resume processos para colegas do mesmo escritório. Objetivo, técnico e claro. Nunca invente fatos fora dos andamentos. Responda SEMPRE em JSON com as chaves: resumo (string 2-4 frases), situacao_atual (string uma frase), proximos_passos (array de strings acionáveis). Em português do Brasil." }, { role: "user", content: JSON.stringify(payload) }], true));
      return json({ ok: true, mode, data: out });
    }

    // ── RESUMO DE PUBLICAÇÃO ──
    if (mode === "resumo_publicacao") {
      const publicacaoId = String(body?.publicacaoId || "");
      if (!publicacaoId) return json({ error: "publicacaoId-obrigatorio" }, 400);
      const { data: pub } = await service.from("publicacoes").select("id, titulo, conteudo, data_publicacao, tribunal, tipo_documento").eq("id", publicacaoId).eq("office_id", officeId).maybeSingle();
      if (!pub) return json({ error: "publicacao-nao-encontrada" }, 404);
      const out = parseJson(await chatCompletion([{ role: "system", content: "Você é um advogado que lê publicações de diário oficial e orienta a equipe. Responda SEMPRE em JSON com as chaves: resumo (string clara), urgencia ('alta'|'media'|'baixa'), prazo_sugerido (objeto {titulo, dias number a partir de hoje, tipo, descricao}) ou null. Nunca invente prazos legais com falsa certeza; se não for claro, dias null e explique no resumo. Em português do Brasil." }, { role: "user", content: JSON.stringify({ titulo: pub.titulo, tribunal: pub.tribunal, tipo: pub.tipo_documento, data: pub.data_publicacao, conteudo: String(pub.conteudo || "").slice(0, 6000) }) }], true));
      return json({ ok: true, mode, data: out });
    }

    // ── INSIGHTS ──
    const period = String(body?.period || "semana");
    const snap = await buildSnapshot(service, officeId, office?.name || "", period);
    const out = parseJson(await chatCompletion([{ role: "system", content: "Você é um conselheiro de gestão para escritórios de advocacia — analítico, direto e prático. Recebe um panorama numérico e devolve orientação acionável, priorizando riscos (prazos e audiências) e produtividade. Não invente dados além do panorama. Responda SEMPRE em JSON com as chaves: resumo (string 2-3 frases), alertas (array), recomendacoes (array), produtividade (array), plano_acao (array na ordem de execução). Cada item curto. Em português do Brasil." }, { role: "user", content: JSON.stringify(snap) }], true));
    return json({ ok: true, mode: "insights", period, snapshot: snap.numeros, data: out });
  } catch (e) {
    return json({ error: String((e as Error).message) }, 500);
  }
});
