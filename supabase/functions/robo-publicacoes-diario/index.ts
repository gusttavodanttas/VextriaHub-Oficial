// Robô diário (cron) de PUBLICAÇÕES: varre as OABs MONITORADAS de cada escritório,
// busca intimações no PJE-Comunica (fetch-by-oab), grava em `publicacoes` (com dedup),
// deriva urgência e dispara o cálculo de prazo (calculate-prazo). Roda com o app fechado.
//
// OABs monitoradas por escritório (respeita o limite do plano):
//   offices.settings.publicacoes_oabs_monitoradas : string[]  (user_ids escolhidos)
//   offices.settings.publicacoes_oab_limite        : number    (teto do plano; padrão 1)
// Se a lista estiver vazia, monitora por padrão a OAB do DONO do escritório (1).
//
// Termos livres monitorados (tabela `monitoramento_termos`, ativo=true): além das
// OABs curadas acima, cada escritório pode monitorar nome de parte, número de
// processo, CPF/CNPJ ou uma OAB avulsa (ex.: a parte contrária) — sem precisar
// que essa OAB pertença a um advogado do escritório. Usa o mesmo fetch-by-oab
// (modo `termo`) e o mesmo pipeline de gravação/dedup/prazo das OABs monitoradas.
// Além da publicação, processo ainda não cadastrado no escritório também cai na
// caixa "Processos Encontrados" (mesma tabela/UX que a busca nacional por OAB
// já usa) — é como o achado por termo vira sugestão de processo novo.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-robot-secret",
};

const onlyDigits = (s: string) => (s || "").replace(/\D/g, "");
const toISODate = (v: any) => { try { return new Date(v).toISOString().split("T")[0]; } catch { return null; } };

// Urgência automática: publicação que dispara prazo/ato = alta
function deriveUrgencia(conteudo: string, tipo?: string | null): "alta" | "media" {
  const t = `${conteudo || ""} ${tipo || ""}`.toLowerCase();
  return /(prazo|intim|manifest|contest|impugna|recurso|apelaç|agravo|embargos|contrarraz|cite-se|cita[çc]|r[ée]plica|cumprimento de senten|penhora|leil[aã]o|audi[êe]ncia)/.test(t)
    ? "alta" : "media";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders, status: 204 });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ROBOT_SECRET = Deno.env.get("ROBOT_SECRET") || "";
  const secret = req.headers.get("x-robot-secret") || "";
  if (!ROBOT_SECRET || secret !== ROBOT_SECRET) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const supa = createClient(SUPABASE_URL, SERVICE_ROLE);
  const authHeaders = { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE_ROLE}`, "apikey": SERVICE_ROLE, "x-robot-secret": ROBOT_SECRET };

  // Janela padrão 7 dias (cobre fins de semana/feriados); aceita override via body {"days":N}
  const body = await req.json().catch(() => ({}));
  const DAYS = Number((body as any)?.days) || 7;
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  // Chama o fetch-by-oab com retry/backoff (PJE-Comunica é instável / faz rate limit)
  const fetchByOab = async (oab: string, uf: string) => {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/fetch-by-oab`, {
          method: "POST", headers: authHeaders, body: JSON.stringify({ oab, uf, days: DAYS }),
        });
        if (resp.ok) return await resp.json();
      } catch (_e) { /* rede/timeout — tenta de novo */ }
      if (attempt < 3) await sleep(attempt * 1500); // 1.5s, 3s
    }
    return null;
  };

  const fetchByTermo = async (termo: string, tipo: string, seccional: string | null) => {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/fetch-by-oab`, {
          method: "POST", headers: authHeaders, body: JSON.stringify({ termo, tipo, seccional, days: DAYS }),
        });
        if (resp.ok) return await resp.json();
      } catch (_e) { /* rede/timeout — tenta de novo */ }
      if (attempt < 3) await sleep(attempt * 1500);
    }
    return null;
  };

  // Grava os itens retornados pelo fetch-by-oab em `publicacoes` (dedup por
  // office+numero+data) e dispara o cálculo de prazo. Compartilhado entre o
  // fluxo de OABs monitoradas e o de termos livres.
  const gravarPublicacoes = async (items, officeId: string, userId: string | null, tagExtra?: string) => {
    const numeros = items.map((i: any) => onlyDigits(i.numeroProcesso)).filter(Boolean);
    const procMap = new Map<string, string>();
    if (numeros.length) {
      const { data: procs } = await supa.from("processos").select("id, numero_processo").eq("office_id", officeId).in("numero_processo", numeros);
      (procs || []).forEach((pr: any) => procMap.set(pr.numero_processo, pr.id));
    }

    let novas = 0;
    for (const item of items) {
      if (item.fonte === "datajud") continue; // andamentos, não publicações
      const conteudo = item.conteudo || item.ultimoAndamento?.descricao || "";
      if (!conteudo || conteudo.length < 10) continue;

      const dataPub = toISODate(item.data_disponibilizacao) || toISODate(item.ultimoAndamento?.data) || new Date().toISOString().split("T")[0];
      const numero = item.numeroProcesso;
      const titulo = item.titulo && !String(item.titulo).startsWith("Publicação")
        ? item.titulo : (item.tipo_documento || item.tipo_comunicacao || `Publicação ${numero}`);
      const processoId = procMap.get(onlyDigits(numero)) || null;

      const { data: existing } = await supa.from("publicacoes")
        .select("id, conteudo, processo_id")
        .eq("office_id", officeId).eq("numero_processo", numero).eq("data_publicacao", dataPub).maybeSingle();

      if (existing) {
        const patch: Record<string, any> = {};
        if (conteudo.length > ((existing as any).conteudo?.length || 0)) { patch.conteudo = conteudo; patch.tipo_documento = item.tipo_documento || null; }
        if (!(existing as any).processo_id && processoId) patch.processo_id = processoId;
        if (Object.keys(patch).length) await supa.from("publicacoes").update(patch).eq("id", (existing as any).id);
        continue;
      }

      const urgencia = deriveUrgencia(conteudo, item.tipo_documento || item.tipo_comunicacao);
      const tags = [String(item.tribunal || "TRIBUNAL").toUpperCase(), "pje_comunica"];
      if (tagExtra) tags.push(tagExtra);
      const { data: novo } = await supa.from("publicacoes").insert({
        office_id: officeId, user_id: userId,
        titulo, conteudo, data_publicacao: dataPub, numero_processo: numero,
        status: "nova", urgencia, tags,
        tribunal: item.tribunal || null, comarca: item.comarca || null, vara: item.vara || null,
        tipo_documento: item.tipo_documento || null, nome_orgao: item.nome_orgao || item.vara || null,
        processo_id: processoId,
      }).select("id").single();

      if ((novo as any)?.id) {
        novas++;
        // Calcula e persiste o prazo (best-effort)
        await fetch(`${SUPABASE_URL}/functions/v1/calculate-prazo`, {
          method: "POST", headers: authHeaders,
          body: JSON.stringify({ publicacao_id: (novo as any).id, data_disponibilizacao: dataPub, tipo_documento: item.tipo_documento || null, nome_orgao: item.nome_orgao || null, conteudo }),
        }).catch(() => {});
      }
    }
    return novas;
  };

  // Processos ainda não cadastrados no escritório (nem descartados antes) viram
  // sugestão na caixa "Processos Encontrados" — mesma lógica do robo-oab-diario.
  const gravarProcessosEncontrados = async (items, officeId: string) => {
    const numeros = items.map((i) => onlyDigits(i.numeroProcesso)).filter(Boolean);
    if (!numeros.length) return 0;

    const [{ data: existentes }, { data: descartados }] = await Promise.all([
      supa.from("processos").select("numero_processo").eq("office_id", officeId).in("numero_processo", numeros),
      supa.from("processos_descartados").select("numero_processo").eq("office_id", officeId).in("numero_processo", numeros),
    ]);
    const ocultos = new Set([
      ...(existentes || []).map((e) => e.numero_processo),
      ...(descartados || []).map((d) => d.numero_processo),
    ]);
    const novos = items.filter((i) => !ocultos.has(onlyDigits(i.numeroProcesso)));
    if (!novos.length) return 0;

    const rows = novos.map((i) => ({
      office_id: officeId,
      numero_processo: onlyDigits(i.numeroProcesso),
      titulo: i.titulo || null,
      tribunal: i.tribunal || null,
      autor: i.autor === "Não identificado" ? null : (i.autor || null),
      reu: i.reu === "Não identificado" ? null : (i.reu || null),
      fonte: i.fonte || "termo",
      payload: i,
    }));
    // ignoreDuplicates → não re-adiciona o que já está na caixa
    await supa.from("processos_encontrados").upsert(rows, { onConflict: "office_id,numero_processo", ignoreDuplicates: true });
    return novos.length;
  };

  try {
    const { data: offices } = await supa.from("offices").select("id, created_by, settings");
    let totalNovas = 0;
    const detalhes: any[] = [];

    for (const office of offices || []) {
      const officeId = (office as any).id;
      const settings = ((office as any).settings as any) || {};
      const escolhidas: string[] = Array.isArray(settings.publicacoes_oabs_monitoradas) ? settings.publicacoes_oabs_monitoradas : [];
      const limite: number = Number(settings.publicacoes_oab_limite ?? 1) || 1;

      // Quais advogados monitorar: os escolhidos (até o limite do plano) OU o dono
      let userIds: string[];
      if (escolhidas.length > 0) userIds = escolhidas.slice(0, Math.max(1, limite));
      else if ((office as any).created_by) userIds = [(office as any).created_by];
      else userIds = [];
      if (!userIds.length) continue;

      const { data: profs } = await supa.from("profiles").select("user_id, oab, oab_uf").in("user_id", userIds).not("oab", "is", null);

      for (const p of profs || []) {
        const oab = onlyDigits((p as any).oab);
        const uf = (p as any).oab_uf;
        if (!oab || !uf) continue;

        const data = await fetchByOab(oab, uf);
        if (!data) { detalhes.push({ oab, uf, erro: "sem_resposta" }); continue; }
        const items = Array.isArray(data) ? data : (data?.items ?? []);
        if (!items.length) { detalhes.push({ oab, uf, novas: 0 }); continue; }

        const novasOab = await gravarPublicacoes(items, officeId, (p as any).user_id);
        totalNovas += novasOab;
        detalhes.push({ oab, uf, novas: novasOab });
        await sleep(800); // gentileza com o PJE entre OABs
      }
    }

    // Termos livres monitorados (nome de parte, número de processo, CPF/CNPJ,
    // OAB avulsa) — mesmo pipeline de gravação, sem vínculo a um advogado específico.
    const { data: termos } = await supa
      .from("monitoramento_termos")
      .select("id, office_id, termo, tipo, seccional")
      .eq("ativo", true);

    for (const t of termos || []) {
      const termoId = t.id;
      const officeId = t.office_id;
      const termo = t.termo;
      const tipo = t.tipo || "nome";
      const seccional = t.seccional || null;
      if (!termo || !officeId) continue;

      const data = await fetchByTermo(termo, tipo, seccional);
      await supa.from("monitoramento_termos").update({ ultima_busca: new Date().toISOString() }).eq("id", termoId);
      if (!data) { detalhes.push({ termo, tipo, erro: "sem_resposta" }); continue; }
      const items = Array.isArray(data) ? data : (data?.items ?? []);
      if (!items.length) { detalhes.push({ termo, tipo, novas: 0 }); continue; }

      const novasTermo = await gravarPublicacoes(items, officeId, null, `termo:${tipo}`);
      const encontradosTermo = await gravarProcessosEncontrados(items, officeId);
      totalNovas += novasTermo;
      detalhes.push({ termo, tipo, novas: novasTermo, processos_encontrados: encontradosTermo });
      await sleep(800); // gentileza com o PJE entre termos
    }

    return new Response(JSON.stringify({ ok: true, totalNovas, detalhes }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
