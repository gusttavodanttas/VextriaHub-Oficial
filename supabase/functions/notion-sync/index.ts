import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  APP_URL, CLIENTE_FIELDS, PROCESSO_FIELDS, NotionError, PropDef, Schema,
  digitsCNJ, faseFromNotion, faseToNotion, fmtCNJ, fromProp, getSchema, instanciaFromNotion, instanciaToNotion,
  isEmptyProp, normId, notion, pick, statusFromNotion, statusToNotion, toProp,
} from "../_shared/notion.ts";

// notion-sync — sincronização VextriaHub ⇄ Notion por escritório.
//   1. PULL: páginas editadas no Notion desde a última rodada (ignorando as editadas
//      pelo próprio bot) → atualiza/cria processos e clientes via notion_apply_change
//      (que não reenfileira). Campos vazios no Notion nunca apagam dado do VextriaHub.
//   2. PUSH: esvazia notion_sync_queue (clientes antes de processos). Valores vazios
//      no VextriaHub nunca apagam dado do Notion; na carga inicial (mode=fill) só
//      preenche propriedades vazias.
// Auth: x-robot-secret (cron: todos os escritórios conectados, ou body.office_id)
//       OU JWT do usuário ("Sincronizar agora" do próprio escritório; body.full=true
//       reenfileira tudo, só admin).
// verify_jwt=false (a checagem é feita aqui).

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-robot-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const TIME_BUDGET_MS = 100_000;
const PUSH_BATCH = 150;
const MAX_ATTEMPTS = 5;
const CNJ = /^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/;

type Entity = "processo" | "cliente";
type Ctx = {
  service: SupabaseClient;
  office: string;
  token: string;
  botId: string | null;
  dbs: { processos: string; clientes: string };
  schemas: { processo: Schema; cliente: Schema };
  deadline: number;
  stats: { enviados: number; arquivados: number; recebidos: number; criados_no_vextria: number; erros: number };
};

const today = () => new Date().toISOString().slice(0, 10);
const timeLeft = (c: Ctx) => c.deadline - Date.now();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
  const started = Date.now();
  try {
    const body = await req.json().catch(() => ({}));
    const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    let offices: string[] = [];
    const robot = req.headers.get("x-robot-secret");
    if (robot && robot === Deno.env.get("ROBOT_SECRET")) {
      if (body?.office_id) offices = [String(body.office_id)];
      else {
        const { data } = await service.from("office_integrations").select("office_id")
          .eq("provider", "notion").eq("enabled", true).eq("status", "conectado");
        offices = (data || []).map((r: { office_id: string }) => r.office_id);
      }
    } else {
      const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
      });
      const { data: { user } } = await supa.auth.getUser();
      if (!user) return json({ error: "nao-autenticado" }, 401);
      const { data: st } = await supa.rpc("notion_status");
      const status = Array.isArray(st) ? st[0] : st;
      if (!status?.office_id) return json({ error: "sem-escritorio" }, 400);
      if (!status.permitido) return json({ error: "plano-sem-notion" }, 403);
      if (body?.full) {
        if (!status.pode_gerenciar) return json({ error: "apenas-admin-do-escritorio" }, 403);
        await supa.rpc("notion_enqueue_all", { p_office: status.office_id });
      }
      offices = [status.office_id];
    }

    const results: Record<string, unknown> = {};
    for (const office of offices) {
      const remaining = TIME_BUDGET_MS - (Date.now() - started);
      if (remaining < 8_000) { results[office] = { adiado: true }; continue; }
      results[office] = await syncOffice(service, office, Date.now() + remaining);
    }
    return json({ ok: true, escritorios: offices.length, results });
  } catch (e) {
    return json({ error: String((e as Error).message) }, 500);
  }
});

async function setIntegration(service: SupabaseClient, office: string, patch: Record<string, unknown>) {
  await service.from("office_integrations").update(patch).eq("office_id", office).eq("provider", "notion");
}

async function syncOffice(service: SupabaseClient, office: string, deadline: number) {
  const { data: integ } = await service.from("office_integrations").select("*")
    .eq("office_id", office).eq("provider", "notion").maybeSingle();
  if (!integ || !integ.enabled || integ.status !== "conectado") return { pulado: "desligado-ou-desconectado" };
  const { data: allowed } = await service.rpc("office_notion_allowed", { p_office: office });
  if (!allowed) return { pulado: "plano-sem-notion" };
  const { data: sec } = await service.from("office_integration_secrets").select("access_token, bot_id")
    .eq("integration_id", integ.id).maybeSingle();
  if (!sec?.access_token) {
    await setIntegration(service, office, { status: "erro", last_error: "Token ausente. Reconecte o Notion." });
    return { erro: "sem-token" };
  }
  const dbs = integ.database_ids || {};
  if (!dbs.processos || !dbs.clientes) {
    await setIntegration(service, office, { status: "erro", last_error: "Bases do Notion não configuradas. Reconecte." });
    return { erro: "sem-bases" };
  }

  const ctx: Ctx = {
    service, office, token: sec.access_token, botId: sec.bot_id ?? null,
    dbs, schemas: { processo: {}, cliente: {} }, deadline,
    stats: { enviados: 0, arquivados: 0, recebidos: 0, criados_no_vextria: 0, erros: 0 },
  };
  const pullStartedAt = new Date().toISOString();
  try {
    ctx.schemas.cliente = await getSchema(ctx.token, dbs.clientes);
    ctx.schemas.processo = await getSchema(ctx.token, dbs.processos);

    const since = new Date(new Date(integ.last_sync_at || integ.connected_at || Date.now()).getTime() - 2 * 60_000).toISOString();
    await pull(ctx, "cliente", since);
    await pull(ctx, "processo", since);
    await push(ctx);

    await setIntegration(service, office, { last_sync_at: pullStartedAt, last_error: null, status: "conectado" });
    return ctx.stats;
  } catch (e) {
    const msg = e instanceof NotionError ? describe(e) : String((e as Error).message);
    const fatal = e instanceof NotionError && (e.status === 401 || e.code === "unauthorized" || e.status === 404);
    await setIntegration(service, office, { last_error: msg, ...(fatal ? { status: "erro" } : {}) });
    return { ...ctx.stats, erro: msg };
  }
}

function describe(e: NotionError) {
  if (e.status === 401) return "O acesso ao Notion foi revogado. Reconecte a integração.";
  if (e.status === 404) return "Uma das bases (Processos/Clientes) não está mais compartilhada com o VextriaHub. Reconecte.";
  return `Notion: ${e.message}`;
}

// ───────────────────────── PULL (Notion → VextriaHub) ─────────────────────────

async function pull(ctx: Ctx, entity: Entity, since: string) {
  const dbId = entity === "processo" ? ctx.dbs.processos : ctx.dbs.clientes;
  let cursor: string | undefined;
  do {
    if (timeLeft(ctx) < 30_000) return; // deixa tempo para o push
    const r: any = await notion(ctx.token, "POST", `databases/${dbId}/query`, {
      filter: { timestamp: "last_edited_time", last_edited_time: { on_or_after: since } },
      sorts: [{ timestamp: "last_edited_time", direction: "ascending" }],
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    });
    for (const page of r.results || []) {
      if (timeLeft(ctx) < 30_000) return;
      if (ctx.botId && page.last_edited_by?.id === ctx.botId) continue;
      try {
        if (entity === "cliente") await applyCliente(ctx, page);
        else await applyProcesso(ctx, page);
      } catch (_e) {
        ctx.stats.erros++;
      }
    }
    cursor = r.has_more ? r.next_cursor : undefined;
  } while (cursor);
}

function reader(ctx: Ctx, entity: Entity, page: any) {
  const schema = ctx.schemas[entity];
  const fields = entity === "processo" ? PROCESSO_FIELDS : CLIENTE_FIELDS;
  return {
    def: (k: string) => pick(schema, fields, k),
    val: (k: string) => { const d = pick(schema, fields, k); return d ? fromProp(page.properties?.[d.name]) : ""; },
  };
}

async function findRow(ctx: Ctx, table: string, page: any, idFromNotion: string) {
  const pid = normId(page.id);
  const { data } = await ctx.service.from(table).select("*").eq("office_id", ctx.office)
    .in("notion_page_id", [pid, page.id]).limit(1);
  if (data?.[0]) return data[0];
  if (/^[0-9a-f-]{36}$/i.test(idFromNotion)) {
    const { data: byId } = await ctx.service.from(table).select("*").eq("office_id", ctx.office).eq("id", idFromNotion).maybeSingle();
    if (byId) return byId;
  }
  return null;
}

async function apply(ctx: Ctx, entity: Entity, id: string | null, data: Record<string, unknown>): Promise<string> {
  const { data: out, error } = await ctx.service.rpc("notion_apply_change", {
    p_office: ctx.office, p_entity: entity, p_id: id, p_data: data,
  });
  if (error) throw new Error(error.message);
  return out as string;
}

/** Depois de criar o registro no VextriaHub, grava o ID e o link na página (como bot). */
async function stampPage(ctx: Ctx, entity: Entity, pageId: string, id: string) {
  const schema = ctx.schemas[entity];
  const fields = entity === "processo" ? PROCESSO_FIELDS : CLIENTE_FIELDS;
  const props: Record<string, unknown> = {};
  const put = (k: string, v: string) => { const d = pick(schema, fields, k); const p = d && toProp(d, v); if (d && p) props[d.name] = p; };
  put("id", id);
  put("link", `${APP_URL}/${entity === "processo" ? "processos" : "clientes"}?openId=${id}`);
  put("sincronizado", today());
  if (Object.keys(props).length) await notion(ctx.token, "PATCH", `pages/${pageId}`, { properties: props });
}

async function applyCliente(ctx: Ctx, page: any) {
  const { val } = reader(ctx, "cliente", page);
  const nome = val("nome");
  const row = await findRow(ctx, "clientes", page, val("id"));
  const notionStatus = val("status");
  if (!row) {
    if (!nome) return;
    const data: Record<string, unknown> = { nome, status: statusFromNotion(notionStatus, "cliente") || "ativo", notion_page_id: normId(page.id) };
    if (val("email")) data.email = val("email");
    if (val("telefone")) data.telefone = val("telefone");
    if (val("documento")) data.cpf_cnpj = val("documento");
    const id = await apply(ctx, "cliente", null, data);
    await stampPage(ctx, "cliente", page.id, id);
    ctx.stats.criados_no_vextria++;
    return;
  }
  const patch: Record<string, unknown> = {};
  if (nome && nome !== row.nome) patch.nome = nome;
  if (val("email") && val("email") !== (row.email || "")) patch.email = val("email");
  if (val("telefone") && val("telefone") !== (row.telefone || "")) patch.telefone = val("telefone");
  if (val("documento") && val("documento") !== (row.cpf_cnpj || "")) patch.cpf_cnpj = val("documento");
  if (notionStatus && statusToNotion(row.status) !== notionStatus) {
    const s = statusFromNotion(notionStatus, "cliente");
    if (s) patch.status = s;
  }
  if (row.notion_page_id !== normId(page.id)) patch.notion_page_id = normId(page.id);
  if (Object.keys(patch).length) {
    await apply(ctx, "cliente", row.id, patch);
    ctx.stats.recebidos++;
  }
}

async function clienteIdFromRelation(ctx: Ctx, relation: string): Promise<{ ids: string[]; first: string | null }> {
  const pages = relation.split(",").filter(Boolean);
  if (!pages.length) return { ids: [], first: null };
  const norm = pages.map(normId);
  const { data } = await ctx.service.from("clientes").select("id, notion_page_id").eq("office_id", ctx.office)
    .in("notion_page_id", [...norm, ...pages]);
  const byPage = new Map((data || []).map((r: { id: string; notion_page_id: string }) => [normId(r.notion_page_id), r.id]));
  const ids = norm.map((p) => byPage.get(p)).filter(Boolean) as string[];
  return { ids, first: ids[0] ?? null };
}

async function applyProcesso(ctx: Ctx, page: any) {
  const { val, def } = reader(ctx, "processo", page);
  const titulo = val("titulo");
  const row = await findRow(ctx, "processos", page, val("id"));
  const rel = await clienteIdFromRelation(ctx, val("cliente"));

  // Campo do VextriaHub ← propriedade do Notion (só quando o Notion tem valor e ele difere).
  const simple: [string, string][] = [
    ["foro", "comarca"], ["vara", "vara"], ["sistema", "sistema_tribunal"], ["tribunal", "tribunal"],
    ["tipo", "tipo_processo"], ["polo_ativo", "parte_autora"], ["polo_passivo", "requerido"], ["prazo", "proximo_prazo"],
  ];

  if (!row) {
    if (!titulo) return;
    const data: Record<string, unknown> = {
      numero_processo: CNJ.test(titulo) ? digitsCNJ(titulo) : "",
      titulo,
      status: statusFromNotion(val("status"), "processo") || "ativo",
      notion_page_id: normId(page.id),
    };
    for (const [k, col] of simple) if (val(k)) data[col] = val(k);
    if (val("fase")) data.fase_processual = faseFromNotion(val("fase"));
    if (val("instancia")) data.instancia = instanciaFromNotion(val("instancia"));
    if (rel.first) data.cliente_id = rel.first;
    const id = await apply(ctx, "processo", null, data);
    await stampPage(ctx, "processo", page.id, id);
    ctx.stats.criados_no_vextria++;
    return;
  }

  const patch: Record<string, unknown> = {};
  for (const [k, col] of simple) {
    const v = val(k);
    if (v && v !== String(row[col] ?? "").slice(0, k === "prazo" ? 10 : undefined)) patch[col] = v;
  }
  const fase = val("fase");
  if (fase && faseToNotion(def("fase"), row.fase_processual) !== fase) patch.fase_processual = faseFromNotion(fase);
  const inst = val("instancia");
  if (inst && instanciaToNotion(def("instancia"), row.instancia) !== inst) patch.instancia = instanciaFromNotion(inst);
  const st = val("status");
  if (st && statusToNotion(row.status) !== st) {
    const s = statusFromNotion(st, "processo");
    if (s) patch.status = s;
  }
  if (titulo && CNJ.test(titulo) && !row.numero_processo) patch.numero_processo = digitsCNJ(titulo);
  if (rel.ids.length && (!row.cliente_id || !rel.ids.includes(row.cliente_id))) patch.cliente_id = rel.first;
  if (row.notion_page_id !== normId(page.id)) patch.notion_page_id = normId(page.id);

  if (Object.keys(patch).length) {
    await apply(ctx, "processo", row.id, patch);
    ctx.stats.recebidos++;
  }
}

// ───────────────────────── PUSH (VextriaHub → Notion) ─────────────────────────

async function push(ctx: Ctx) {
  const { data: queue } = await ctx.service.from("notion_sync_queue").select("*")
    .eq("office_id", ctx.office).lt("attempts", MAX_ATTEMPTS)
    .order("entity", { ascending: true })   // 'cliente' antes de 'processo'
    .order("created_at", { ascending: true })
    .limit(PUSH_BATCH);
  for (const q of queue || []) {
    if (timeLeft(ctx) < 5_000) return;
    try {
      await pushOne(ctx, q);
      // Só remove se não foi reenfileirado durante o envio.
      await ctx.service.from("notion_sync_queue").delete().eq("id", q.id).eq("created_at", q.created_at);
    } catch (e) {
      if (e instanceof NotionError && (e.status === 401 || e.code === "unauthorized")) throw e;
      ctx.stats.erros++;
      await ctx.service.from("notion_sync_queue")
        .update({ attempts: (q.attempts || 0) + 1, last_error: String((e as Error).message).slice(0, 500) })
        .eq("id", q.id);
    }
  }
}

async function archivePage(ctx: Ctx, pageId: string | null) {
  if (!pageId) return;
  try {
    await notion(ctx.token, "PATCH", `pages/${pageId}`, { archived: true });
    ctx.stats.arquivados++;
  } catch (e) {
    if (!(e instanceof NotionError && (e.status === 404 || e.status === 400))) throw e;
  }
}

async function getPage(ctx: Ctx, pageId: string): Promise<any | null> {
  try {
    return await notion(ctx.token, "GET", `pages/${pageId}`);
  } catch (e) {
    if (e instanceof NotionError && (e.status === 404 || e.status === 400)) return null;
    throw e;
  }
}

/** Procura a página já existente: pelo ID VextriaHub e, na carga inicial, pelo título. */
async function findPage(ctx: Ctx, entity: Entity, id: string, title: string, mode: string): Promise<any | null> {
  const schema = ctx.schemas[entity];
  const fields = entity === "processo" ? PROCESSO_FIELDS : CLIENTE_FIELDS;
  const dbId = entity === "processo" ? ctx.dbs.processos : ctx.dbs.clientes;
  const idDef = pick(schema, fields, "id");
  if (idDef && (idDef.type === "rich_text" || idDef.type === "title")) {
    const r: any = await notion(ctx.token, "POST", `databases/${dbId}/query`, {
      filter: { property: idDef.name, [idDef.type]: { equals: id } }, page_size: 1,
    });
    if (r.results?.[0]) return r.results[0];
  }
  const titleDef = pick(schema, fields, entity === "processo" ? "titulo" : "nome");
  const byTitle = entity === "processo" ? CNJ.test(title) : mode === "fill";
  if (titleDef && title && byTitle) {
    const r: any = await notion(ctx.token, "POST", `databases/${dbId}/query`, {
      filter: { property: titleDef.name, title: { equals: title } }, page_size: 2,
    });
    if (r.results?.length === 1) return r.results[0];
  }
  return null;
}

async function pushOne(ctx: Ctx, q: any) {
  const entity: Entity = q.entity;
  const table = entity === "processo" ? "processos" : "clientes";
  if (q.op === "delete") {
    const { data: still } = await ctx.service.from(table).select("id, deletado, notion_page_id").eq("id", q.entity_id).maybeSingle();
    if (still && !still.deletado) return; // restaurado antes do envio: o trigger já reenfileirou como upsert
    await archivePage(ctx, q.notion_page_id || still?.notion_page_id || null);
    return;
  }
  const { data: row } = await ctx.service.from(table).select("*").eq("id", q.entity_id).maybeSingle();
  if (!row) return;
  if (row.deletado) { await archivePage(ctx, row.notion_page_id); return; }

  const schema = ctx.schemas[entity];
  const fields = entity === "processo" ? PROCESSO_FIELDS : CLIENTE_FIELDS;
  const title = entity === "processo" ? (fmtCNJ(row.numero_processo) || row.titulo || "") : (row.nome || "");

  // Página existente?
  let page: any = row.notion_page_id ? await getPage(ctx, row.notion_page_id) : null;
  if (page && page.parent?.database_id && normId(page.parent.database_id) !== normId(entity === "processo" ? ctx.dbs.processos : ctx.dbs.clientes)) {
    page = null; // vínculo de outro workspace/base
  }
  if (!page) page = await findPage(ctx, entity, row.id, title, q.mode);

  // Valores a enviar (vazios nunca são enviados).
  const values: [string, unknown][] = [];
  const add = (k: string, v: unknown) => { if (v != null && String(v).trim() !== "") values.push([k, v]); };
  add(entity === "processo" ? "titulo" : "nome", title);
  add("id", row.id);
  add("link", `${APP_URL}/${table}?openId=${row.id}`);
  add("sincronizado", today());
  if (entity === "processo") {
    add("sistema", row.sistema_tribunal);
    add("tribunal", row.tribunal);
    add("instancia", instanciaToNotion(pick(schema, fields, "instancia"), row.instancia));
    add("foro", row.comarca);
    add("vara", row.vara);
    add("fase", faseToNotion(pick(schema, fields, "fase"), row.fase_processual));
    add("tipo", row.tipo_processo || row.classe_judicial);
    add("polo_ativo", row.parte_autora);
    add("polo_passivo", row.requerido);
    add("status", statusToNotion(row.status));
    add("prazo", row.proximo_prazo);
    if (row.cliente_id) {
      const { data: cli } = await ctx.service.from("clientes").select("notion_page_id").eq("id", row.cliente_id).maybeSingle();
      if (cli?.notion_page_id) add("cliente", cli.notion_page_id);
    }
  } else {
    add("email", row.email);
    add("telefone", row.telefone);
    add("documento", row.cpf_cnpj);
    add("status", statusToNotion(row.status));
  }

  const ALWAYS = new Set(["id", "link", "sincronizado"]);
  const props: Record<string, unknown> = {};
  for (const [k, v] of values) {
    const d: PropDef | null = pick(schema, fields, k);
    if (!d) continue;
    const current = page?.properties?.[d.name];
    if (k === "cliente") {
      // Relação: acrescenta o cliente sem tirar outros já relacionados no Notion.
      const ids: string[] = (current?.relation || []).map((r: { id: string }) => normId(r.id));
      const target = normId(String(v));
      if (ids.includes(target)) continue;
      if (q.mode === "fill" && ids.length) continue;
      props[d.name] = { relation: [...ids, target].map((id) => ({ id })) };
      continue;
    }
    if (page && q.mode === "fill" && !ALWAYS.has(k) && !isEmptyProp(current)) continue;
    if (page && current && fromProp(current) === String(v).slice(0, d.type === "date" ? 10 : undefined)) continue;
    const p = toProp(d, v);
    if (p !== undefined) props[d.name] = p;
  }

  let pageId: string;
  if (page) {
    pageId = page.id;
    const unarchive = page.archived || page.in_trash;
    if (Object.keys(props).length || unarchive) {
      await notion(ctx.token, "PATCH", `pages/${pageId}`, { properties: props, ...(unarchive ? { archived: false } : {}) });
    }
  } else {
    const dbId = entity === "processo" ? ctx.dbs.processos : ctx.dbs.clientes;
    const created: any = await notion(ctx.token, "POST", "pages", { parent: { database_id: dbId }, properties: props });
    pageId = created.id;
  }
  ctx.stats.enviados++;

  if (normId(pageId) !== (row.notion_page_id || "")) {
    try { await apply(ctx, entity, row.id, { notion_page_id: normId(pageId) }); }
    catch { /* página já vinculada a outro registro (duplicado): mantém sem vínculo */ }
  }
}
