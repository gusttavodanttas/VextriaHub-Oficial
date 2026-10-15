// Utilitários da integração com o Notion (API pública, versão 2022-06-28).
// Usado por notion-oauth-callback (criar/achar as bases) e notion-sync (fila e pull).
//
// A escrita é ADAPTATIVA: cada campo lógico do VextriaHub tem uma lista de nomes
// aceitos no Notion e o valor é convertido para o tipo real da propriedade da base
// (title, rich_text, select, date, url...). Assim o escritório pode renomear/ajustar
// tipos sem quebrar a sincronização; propriedades ausentes são simplesmente ignoradas.

export const NOTION_VERSION = "2022-06-28";
export const APP_URL = Deno.env.get("APP_URL") || "https://vextriahub.com.br";

export class NotionError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let lastCall = 0;

/** Chamada à API do Notion com limite de ~3 req/s e retry em 429/5xx. */
export async function notion<T = any>(token: string, method: string, path: string, body?: unknown): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const wait = lastCall + 340 - Date.now();
    if (wait > 0) await sleep(wait);
    lastCall = Date.now();
    const res = await fetch(`https://api.notion.com/v1/${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.status === 429 || res.status >= 500) {
      const ra = Number(res.headers.get("Retry-After") || "1");
      await sleep(Math.min(10, Math.max(1, ra)) * 1000);
      continue;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new NotionError(res.status, data?.code || "erro", data?.message || `HTTP ${res.status}`);
    return data as T;
  }
  throw new NotionError(429, "rate_limited", "Notion ocupado; tente de novo em instantes.");
}

// ───────────────────────── Esquema das bases ─────────────────────────

export type PropDef = { id: string; name: string; type: string; select?: { options: { name: string }[] } };
export type Schema = Record<string, PropDef>;

/** Campos lógicos → nomes aceitos no Notion (o primeiro que existir na base é usado). */
export const PROCESSO_FIELDS: Record<string, string[]> = {
  titulo: ["Processo", "Nome", "Título"],
  id: ["ID VextriaHub"],
  link: ["Abrir no VextriaHub"],
  cliente: ["Cliente", "Clientes"],
  sistema: ["Sistema"],
  tribunal: ["Tribunal"],
  instancia: ["Instância"],
  foro: ["Foro", "Comarca"],
  vara: ["Órgão / vara", "Vara", "Órgão julgador"],
  fase: ["Fase", "Fase processual"],
  tipo: ["Classe", "Tipo de ação", "Tipo"],
  polo_ativo: ["Polo ativo", "Parte autora"],
  polo_passivo: ["Polo passivo", "Parte contrária", "Requerido"],
  status: ["Status", "Situação"],
  prazo: ["Próximo prazo"],
  sincronizado: ["Sincronizado em"],
};

export const CLIENTE_FIELDS: Record<string, string[]> = {
  nome: ["Nome", "Cliente"],
  id: ["ID VextriaHub"],
  link: ["Abrir no VextriaHub"],
  email: ["E-mail", "Email"],
  telefone: ["WhatsApp", "Telefone", "Telefone/WhatsApp", "Celular"],
  documento: ["CPF/CNPJ", "Documento"],
  status: ["Status"],
  sincronizado: ["Sincronizado em"],
};

/** Esquema canônico usado quando o VextriaHub cria as bases no workspace do escritório. */
export function processosSchema(clientesDbId: string) {
  const sel = (names: string[]) => ({ select: { options: names.map((name) => ({ name })) } });
  return {
    "Processo": { title: {} },
    "Cliente": { relation: { database_id: clientesDbId, type: "dual_property", dual_property: {} } },
    "ID VextriaHub": { rich_text: {} },
    "Abrir no VextriaHub": { url: {} },
    "Sistema": { select: {} },
    "Tribunal": { select: {} },
    "Instância": sel(["1º grau", "2º grau", "Tribunais superiores", "INSS (administrativo)"]),
    "Foro": { select: {} },
    "Órgão / vara": { rich_text: {} },
    "Fase": sel(["Inicial", "Instrução", "Sentenciado", "Recurso", "Trânsito", "Cumprimento", "Arquivado provisoriamente", "Arquivado"]),
    "Classe": { rich_text: {} },
    "Polo ativo": { rich_text: {} },
    "Polo passivo": { rich_text: {} },
    "Status": sel(["Ativo", "Suspenso", "Encerrado"]),
    "Próximo prazo": { date: {} },
    "Sincronizado em": { date: {} },
  };
}

export const CLIENTES_SCHEMA = {
  "Nome": { title: {} },
  "ID VextriaHub": { rich_text: {} },
  "Abrir no VextriaHub": { url: {} },
  "E-mail": { email: {} },
  "WhatsApp": { phone_number: {} },
  "CPF/CNPJ": { rich_text: {} },
  "Status": { select: { options: [{ name: "Ativo" }, { name: "Lead" }, { name: "Encerrado" }] } },
  "Sincronizado em": { date: {} },
};

export function pick(schema: Schema, fields: Record<string, string[]>, key: string): PropDef | null {
  for (const n of fields[key] || []) if (schema[n]) return schema[n];
  return null;
}

// ───────────────────────── Leitura / escrita de propriedades ─────────────────────────

const rt = (s: string) => [{ type: "text", text: { content: s.slice(0, 1990) } }];

/** Converte um valor para o formato da propriedade. undefined = não escrever. */
export function toProp(def: PropDef, value: unknown): unknown {
  const s = value == null ? "" : String(value).trim();
  switch (def.type) {
    case "title": return { title: s ? rt(s) : [] };
    case "rich_text": return { rich_text: s ? rt(s) : [] };
    case "url": return { url: s || null };
    case "email": return { email: s || null };
    case "phone_number": return { phone_number: s || null };
    case "number": { const n = Number(s.replace(",", ".")); return { number: s && !isNaN(n) ? n : null }; }
    case "checkbox": return { checkbox: !!value };
    case "date": return { date: s ? { start: s.slice(0, s.length > 10 ? 25 : 10) } : null };
    case "select": return { select: s ? { name: s.replace(/,/g, " ").slice(0, 100) } : null };
    case "multi_select": return { multi_select: s ? s.split(/\s*[;,]\s*/).filter(Boolean).map((name) => ({ name: name.slice(0, 100) })) : [] };
    case "status": {
      const opts = (def as any).status?.options as { name: string }[] | undefined;
      const hit = opts?.find((o) => o.name.toLowerCase() === s.toLowerCase());
      return hit ? { status: { name: hit.name } } : undefined;
    }
    case "relation": return { relation: (Array.isArray(value) ? value : value ? [value] : []).map((id) => ({ id: String(id) })) };
    default: return undefined; // fórmula, rollup, pessoas etc.: não escrevemos
  }
}

/** Texto simples de qualquer propriedade (para comparar e para o pull). */
export function fromProp(p: any): string {
  if (!p) return "";
  switch (p.type) {
    case "title": return (p.title || []).map((t: any) => t.plain_text).join("").trim();
    case "rich_text": return (p.rich_text || []).map((t: any) => t.plain_text).join("").trim();
    case "url": return p.url || "";
    case "email": return p.email || "";
    case "phone_number": return p.phone_number || "";
    case "number": return p.number == null ? "" : String(p.number);
    case "checkbox": return p.checkbox ? "true" : "";
    case "date": return p.date?.start ? String(p.date.start).slice(0, 10) : "";
    case "select": return p.select?.name || "";
    case "status": return p.status?.name || "";
    case "multi_select": return (p.multi_select || []).map((o: any) => o.name).join(", ");
    case "relation": return (p.relation || []).map((r: any) => r.id).join(",");
    case "formula": return p.formula?.string ?? (p.formula?.number != null ? String(p.formula.number) : "");
    default: return "";
  }
}

/** O VextriaHub guarda o nº CNJ só com dígitos; no Notion ele aparece formatado. */
export function fmtCNJ(n: string | null | undefined): string {
  const d = (n || "").replace(/\D/g, "");
  return d.length === 20 ? `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13, 14)}.${d.slice(14, 16)}.${d.slice(16)}` : (n || "");
}
export const digitsCNJ = (n: string) => n.replace(/\D/g, "");

export const isEmptyProp = (p: any) => fromProp(p) === "";
export const normId = (id: string) => id.replace(/-/g, "").toLowerCase();

// ───────────────────────── Mapeamentos de valores ─────────────────────────

const FASE_TO_NOTION: [RegExp, string][] = [
  [/arquivad.*provis/i, "Arquivado provisoriamente"],
  [/arquivad/i, "Arquivado"],
  [/inicial/i, "Inicial"],
  [/instru|andamento|concluso/i, "Instrução"],
  [/julgamento|sentenc/i, "Sentenciado"],
  [/recurs/i, "Recurso"],
  [/tr[aâ]nsito/i, "Trânsito"],
  [/cumprimento|execu/i, "Cumprimento"],
];
const FASE_FROM_NOTION: Record<string, string> = {
  "Inicial": "Fase Inicial",
  "Instrução": "Fase Instrutória",
  "Sentenciado": "Fase de Julgamento",
  "Recurso": "Fase Recursal",
  "Trânsito": "Trânsito em julgado",
  "Cumprimento": "Cumprimento de sentença",
  "Arquivado provisoriamente": "Arquivado provisoriamente",
  "Arquivado": "Arquivado",
};
/** Fase do VextriaHub → opção do Notion (só converte se a base usa as opções padrão). */
export function faseToNotion(def: PropDef | null, fase: string | null): string {
  const f = (fase || "").trim();
  if (!f) return "";
  const opts = def?.select?.options?.map((o) => o.name) || [];
  if (opts.includes(f)) return f;
  for (const [re, name] of FASE_TO_NOTION) if (re.test(f) && (!opts.length || opts.includes(name))) return name;
  return f;
}
export const faseFromNotion = (v: string) => FASE_FROM_NOTION[v] || v;

export function instanciaToNotion(def: PropDef | null, v: string | null): string {
  const s = (v || "").trim();
  if (!s) return "";
  const opts = def?.select?.options?.map((o) => o.name) || [];
  if (opts.includes(s)) return s;
  let m = s;
  if (/^\s*1/.test(s) || /primeir/i.test(s)) m = "1º grau";
  else if (/^\s*2/.test(s) || /segund/i.test(s)) m = "2º grau";
  else if (/superior|stj|stf|tst/i.test(s)) m = "Tribunais superiores";
  else if (/inss|administr/i.test(s)) m = "INSS (administrativo)";
  return !opts.length || opts.includes(m) ? m : s;
}
export function instanciaFromNotion(v: string): string {
  if (v === "1º grau") return "1ª Instância";
  if (v === "2º grau") return "2ª Instância";
  return v;
}

export const statusToNotion = (s: string | null) => {
  const v = (s || "").toLowerCase();
  if (!v) return "";
  if (/ativ|andamento/.test(v)) return "Ativo";
  if (/lead/.test(v)) return "Lead";
  if (/suspen/.test(v)) return "Suspenso";
  return "Encerrado";
};
export const statusFromNotion = (s: string, entity: "processo" | "cliente") => {
  const v = s.toLowerCase();
  if (/ativ/.test(v)) return "ativo";
  if (/lead/.test(v)) return "lead";
  if (/suspen/.test(v)) return "suspenso";
  if (/encerr|conclu|arquiv|inativ/.test(v)) return entity === "processo" ? "concluido" : "inativo";
  return "";
};

// ───────────────────────── Descoberta / criação das bases ─────────────────────────

const dbTitle = (db: any) => (db?.title || []).map((t: any) => t.plain_text).join("").trim().toLowerCase();

/** Procura bases "Processos" e "Clientes" já compartilhadas com a integração. */
export async function findDatabases(token: string): Promise<{ processos?: string; clientes?: string }> {
  const out: { processos?: string; clientes?: string } = {};
  let cursor: string | undefined;
  for (let i = 0; i < 5; i++) {
    const r: any = await notion(token, "POST", "search", {
      filter: { property: "object", value: "database" }, page_size: 100, ...(cursor ? { start_cursor: cursor } : {}),
    });
    for (const db of r.results || []) {
      if (db.archived || db.in_trash) continue;
      const t = dbTitle(db);
      if (!out.processos && t === "processos") out.processos = db.id;
      if (!out.clientes && t === "clientes") out.clientes = db.id;
    }
    if (!r.has_more || (out.processos && out.clientes)) break;
    cursor = r.next_cursor;
  }
  return out;
}

/** Primeira página compartilhada com a integração (onde criar as bases, se preciso). */
export async function firstSharedPage(token: string): Promise<string | null> {
  const r: any = await notion(token, "POST", "search", { filter: { property: "object", value: "page" }, page_size: 25 });
  const page = (r.results || []).find((p: any) => !p.archived && !p.in_trash && p.parent?.type !== "database_id");
  return page?.id ?? null;
}

export async function createDatabases(token: string, parentPageId: string, existing: { processos?: string; clientes?: string }) {
  let clientes = existing.clientes;
  if (!clientes) {
    const c: any = await notion(token, "POST", "databases", {
      parent: { type: "page_id", page_id: parentPageId },
      title: [{ type: "text", text: { content: "Clientes" } }],
      icon: { type: "emoji", emoji: "👤" },
      properties: CLIENTES_SCHEMA,
    });
    clientes = c.id as string;
  }
  let processos = existing.processos;
  if (!processos) {
    const p: any = await notion(token, "POST", "databases", {
      parent: { type: "page_id", page_id: parentPageId },
      title: [{ type: "text", text: { content: "Processos" } }],
      icon: { type: "emoji", emoji: "⚖️" },
      properties: processosSchema(clientes!),
    });
    processos = p.id as string;
  }
  return { processos: processos!, clientes: clientes! };
}

export async function getSchema(token: string, dbId: string): Promise<Schema> {
  const db: any = await notion(token, "GET", `databases/${dbId}`);
  return db.properties as Schema;
}
