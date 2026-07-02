// Robô diário (cron) de PUBLICAÇÕES: varre as OABs MONITORADAS de cada escritório,
// busca intimações no PJE-Comunica (fetch-by-oab), grava em `publicacoes` (com dedup),
// deriva urgência e dispara o cálculo de prazo (calculate-prazo). Roda com o app fechado.
//
// OABs monitoradas por escritório (respeita o limite do plano):
//   offices.settings.publicacoes_oabs_monitoradas : string[]  (user_ids escolhidos)
//   offices.settings.publicacoes_oab_limite        : number    (teto do plano; padrão 1)
// Se a lista estiver vazia, monitora por padrão a OAB do DONO do escritório (1).
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
  if (ROBOT_SECRET && secret !== ROBOT_SECRET) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const supa = createClient(SUPABASE_URL, SERVICE_ROLE);
  const DAYS = 3; // janela de segurança (cobre fim de semana)
  const authHeaders = { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE_ROLE}`, "apikey": SERVICE_ROLE, "x-robot-secret": ROBOT_SECRET };

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

        const resp = await fetch(`${SUPABASE_URL}/functions/v1/fetch-by-oab`, {
          method: "POST", headers: authHeaders, body: JSON.stringify({ oab, uf, days: DAYS }),
        });
        if (!resp.ok) { detalhes.push({ oab, uf, erro: resp.status }); continue; }
        const data = await resp.json();
        const items = Array.isArray(data) ? data : (data?.items ?? []);
        if (!items.length) continue;

        // Vínculo automático a processos já cadastrados
        const numeros = items.map((i: any) => onlyDigits(i.numeroProcesso)).filter(Boolean);
        const procMap = new Map<string, string>();
        if (numeros.length) {
          const { data: procs } = await supa.from("processos").select("id, numero_processo").eq("office_id", officeId).in("numero_processo", numeros);
          (procs || []).forEach((pr: any) => procMap.set(pr.numero_processo, pr.id));
        }

        let novasOab = 0;
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
          const { data: novo } = await supa.from("publicacoes").insert({
            office_id: officeId, user_id: (p as any).user_id,
            titulo, conteudo, data_publicacao: dataPub, numero_processo: numero,
            status: "nova", urgencia,
            tags: [String(item.tribunal || "TRIBUNAL").toUpperCase(), "pje_comunica"],
            tribunal: item.tribunal || null, comarca: item.comarca || null, vara: item.vara || null,
            tipo_documento: item.tipo_documento || null, nome_orgao: item.nome_orgao || item.vara || null,
            processo_id: processoId,
          }).select("id").single();

          if ((novo as any)?.id) {
            novasOab++; totalNovas++;
            // Calcula e persiste o prazo (best-effort)
            await fetch(`${SUPABASE_URL}/functions/v1/calculate-prazo`, {
              method: "POST", headers: authHeaders,
              body: JSON.stringify({ publicacao_id: (novo as any).id, data_disponibilizacao: dataPub, tipo_documento: item.tipo_documento || null, nome_orgao: item.nome_orgao || null, conteudo }),
            }).catch(() => {});
          }
        }
        detalhes.push({ oab, uf, novas: novasOab });
      }
    }

    return new Response(JSON.stringify({ ok: true, totalNovas, detalhes }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
