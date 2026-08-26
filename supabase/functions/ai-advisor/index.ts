import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Conselheiro IA (OpenAI) ────────────────────────────────────────────────
// Recurso PREMIUM. A chave é da Vextria (segredo OPENAI_API_KEY — nunca no código
// nem no chat). Modos:
//   insights          → panorama + alertas + recomendações + plano de ação (por período)
//   resumo_processo   → resumo do processo a partir dos andamentos
//   resumo_publicacao → resumo da publicação + sugestão de prazo
// Segurança: só usuário autenticado; só escritório premium/vitalício/cortesia (ou
// super admin). TODA leitura é escopada no office_id do próprio usuário — nunca lê
// dado de outro escritório. processoId/publicacaoId são validados contra o office.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") || "";
const OPENAI_MODEL = Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini";

const periodDays: Record<string, number> = { hoje: 1, semana: 7, mes: 30, ano: 365 };
const periodLabel: Record<string, string> = { hoje: "hoje", semana: "esta semana", mes: "este mês", ano: "este ano" };

async function callOpenAI(system: string, user: string): Promise<Record<string, unknown>> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || `openai-${res.status}`);
  }
  const content = data?.choices?.[0]?.message?.content || "{}";
  try {
    return JSON.parse(content);
  } catch {
    return { resumo: String(content).slice(0, 4000) };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const anon = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    });
    const { data: u } = await anon.auth.getUser();
    const uid = u?.user?.id;
    if (!uid) return json({ error: "nao-autenticado" }, 401);

    const service = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Resolve escritório do usuário + verifica premium
    const { data: prof } = await service.from("profiles").select("role, office_id").eq("user_id", uid).maybeSingle();
    let officeId = prof?.office_id as string | null;
    if (!officeId) {
      const { data: ou } = await service.from("office_users").select("office_id").eq("user_id", uid).eq("active", true).order("joined_at").limit(1).maybeSingle();
      officeId = ou?.office_id ?? null;
    }
    if (!officeId) return json({ error: "sem-escritorio" }, 400);

    const { data: office } = await service.from("offices").select("name, plan, access_type").eq("id", officeId).maybeSingle();
    const isSuper = prof?.role === "super_admin";
    const hasIA = isSuper
      || office?.access_type === "lifetime" || office?.access_type === "courtesy"
      || office?.plan === "premium" || office?.plan === "cortesia";
    if (!hasIA) return json({ error: "premium-required", message: "O Conselheiro IA está disponível no plano Premium." }, 403);

    if (!OPENAI_KEY) return json({ error: "openai-nao-configurada", message: "A IA ainda não foi configurada. Defina o segredo OPENAI_API_KEY." }, 503);

    const body = await req.json().catch(() => ({}));
    const mode = String(body?.mode || "insights");
    const hoje = new Date().toISOString().slice(0, 10);
    const nowIso = new Date().toISOString();

    // ── RESUMO DE PROCESSO ──
    if (mode === "resumo_processo") {
      const processoId = String(body?.processoId || "");
      if (!processoId) return json({ error: "processoId-obrigatorio" }, 400);
      const { data: p } = await service.from("processos")
        .select("id, titulo, numero_processo, parte_autora, requerido, status, classe_judicial, assunto_principal, tribunal, vara, comarca, valor_causa")
        .eq("id", processoId).eq("office_id", officeId).eq("deletado", false).maybeSingle();
      if (!p) return json({ error: "processo-nao-encontrado" }, 404);

      const { data: movs } = await service.from("movimentacoes_processo")
        .select("data_movimentacao, descricao, tipo").eq("processo_id", processoId)
        .order("data_movimentacao", { ascending: false }).limit(40);
      const { data: prazos } = await service.from("prazos")
        .select("titulo, data_fim_prazo, status").eq("processo_id", processoId).neq("status", "concluido").limit(10);
      const { data: auds } = await service.from("audiencias")
        .select("titulo, data_audiencia, status").eq("processo_id", processoId).gte("data_audiencia", nowIso).limit(10);

      const payload = {
        processo: p,
        andamentos: (movs || []).map((m) => ({ data: m.data_movimentacao, texto: m.descricao, tipo: m.tipo })),
        prazos_abertos: prazos || [],
        proximas_audiencias: auds || [],
      };
      const out = await callOpenAI(
        "Você é um advogado sênior que resume processos para outros advogados do mesmo escritório. Seja objetivo, técnico e claro. Nunca invente fatos que não estejam nos andamentos. Responda SEMPRE em JSON com as chaves: resumo (string, 2-4 frases da história do caso), situacao_atual (string, uma frase do estado atual), proximos_passos (array de strings curtas e acionáveis). Em português do Brasil.",
        JSON.stringify(payload),
      );
      return json({ ok: true, mode, data: out });
    }

    // ── RESUMO DE PUBLICAÇÃO + SUGESTÃO DE PRAZO ──
    if (mode === "resumo_publicacao") {
      const publicacaoId = String(body?.publicacaoId || "");
      if (!publicacaoId) return json({ error: "publicacaoId-obrigatorio" }, 400);
      const { data: pub } = await service.from("publicacoes")
        .select("id, titulo, conteudo, data_publicacao, tribunal, tipo_documento")
        .eq("id", publicacaoId).eq("office_id", officeId).maybeSingle();
      if (!pub) return json({ error: "publicacao-nao-encontrada" }, 404);

      const out = await callOpenAI(
        "Você é um advogado que lê publicações de diário oficial e orienta a equipe. Responda SEMPRE em JSON com as chaves: resumo (string em linguagem clara do que a publicação significa), urgencia ('alta'|'media'|'baixa'), prazo_sugerido (objeto com: titulo string, dias number = prazo em dias corridos a partir de hoje, tipo string ex 'contestação'/'recurso'/'manifestação', descricao string) ou null se não houver prazo a cumprir. Nunca invente prazos legais específicos com falsa certeza — se não for claro, use dias null e explique no resumo. Em português do Brasil.",
        JSON.stringify({ titulo: pub.titulo, tribunal: pub.tribunal, tipo: pub.tipo_documento, data: pub.data_publicacao, conteudo: String(pub.conteudo || "").slice(0, 6000) }),
      );
      return json({ ok: true, mode, data: out });
    }

    // ── INSIGHTS (conselheiro por período) ──
    const period = String(body?.period || "semana");
    const dias = periodDays[period] ?? 7;
    const ate = new Date(Date.now() + dias * 86400000).toISOString().slice(0, 10);
    const desde = new Date(Date.now() - dias * 86400000).toISOString();

    const q = service; // service role, sempre filtrado por office
    const [
      procAtivos, prazosVencendo, prazosVencidos, audProximas, pubNovas,
      tarefasPend, tarefasVencidas, diligPagar, movRecentes,
      listaPrazos, listaAud, listaPub,
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
    const snapshot = {
      escritorio: office?.name || "escritório",
      periodo: periodLabel[period] || "esta semana",
      numeros: {
        processos_ativos: procAtivos.count ?? 0,
        prazos_vencendo: prazosVencendo.count ?? 0,
        prazos_vencidos: prazosVencidos.count ?? 0,
        audiencias_proximas: audProximas.count ?? 0,
        publicacoes_nao_tratadas: pubNovas.count ?? 0,
        tarefas_pendentes: tarefasPend.count ?? 0,
        tarefas_atrasadas: tarefasVencidas.count ?? 0,
        diligencias_a_pagar: (diligPagar.data || []).length,
        valor_diligencias_a_pagar: diligValor,
        movimentacoes_no_periodo: movRecentes.count ?? 0,
      },
      prazos_proximos: (listaPrazos.data || []).map((p: { titulo?: string; data_fim_prazo?: string }) => ({ titulo: p.titulo, data: p.data_fim_prazo })),
      audiencias_proximas: (listaAud.data || []).map((a: { titulo?: string; data_audiencia?: string }) => ({ titulo: a.titulo, data: a.data_audiencia })),
      publicacoes_novas: (listaPub.data || []).map((p: { titulo?: string; data_publicacao?: string }) => ({ titulo: p.titulo, data: p.data_publicacao })),
    };

    const out = await callOpenAI(
      "Você é um conselheiro de gestão para escritórios de advocacia — analítico, direto e prático. Recebe um panorama numérico do escritório e devolve orientação acionável, priorizando riscos (prazos e audiências) e produtividade. Não invente dados além do panorama. Responda SEMPRE em JSON com as chaves: resumo (string, 2-3 frases sobre como está o escritório no período), alertas (array de strings — riscos urgentes, ex prazos vencidos/vencendo, audiências próximas, publicações não tratadas), recomendacoes (array de strings — o que priorizar agora), produtividade (array de strings — sugestões de melhoria de performance/organização), plano_acao (array de strings — passos objetivos na ordem de execução). Cada item curto (1 frase). Em português do Brasil. Se estiver tudo tranquilo, diga isso com honestidade.",
      JSON.stringify(snapshot),
    );

    return json({ ok: true, mode: "insights", period, snapshot: snapshot.numeros, data: out });
  } catch (e) {
    return json({ error: String((e as Error).message) }, 500);
  }
});
