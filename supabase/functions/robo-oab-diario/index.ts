// Robô diário (cron): varre as OABs cadastradas, busca processos em âmbito
// nacional e enche a caixa "Processos Encontrados" — ignorando os já
// adicionados (tabela processos) e os já descartados (processos_descartados).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const onlyDigits = (s: string) => (s || "").replace(/\D/g, "");

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders, status: 204 });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ROBOT_SECRET = Deno.env.get("ROBOT_SECRET") || "";
  const supa = createClient(SUPABASE_URL, SERVICE_ROLE);

  try {
    // OABs a buscar: cada advogado com OAB + escritório
    const { data: profs } = await supa
      .from("profiles")
      .select("user_id, office_id, oab, oab_uf")
      .not("oab", "is", null)
      .not("office_id", "is", null);

    let totalNovos = 0;
    const detalhes: any[] = [];

    for (const p of profs || []) {
      const oab = onlyDigits((p as any).oab);
      const uf = (p as any).oab_uf;
      const officeId = (p as any).office_id;
      if (!oab || !uf || !officeId) continue;

      // Busca nacional reutilizando a fetch-by-oab (com secret de robô)
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/fetch-by-oab`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SERVICE_ROLE}`,
          "apikey": SERVICE_ROLE,
          "x-robot-secret": ROBOT_SECRET,
        },
        body: JSON.stringify({ oab, uf, nacional: true }),
      });
      if (!resp.ok) { detalhes.push({ oab, uf, erro: resp.status }); continue; }

      const data = await resp.json();
      const items = Array.isArray(data) ? data : (data?.items ?? []);
      if (!items.length) continue;

      const numeros = items.map((i: any) => onlyDigits(i.numeroProcesso)).filter(Boolean);
      if (!numeros.length) continue;

      const [{ data: existentes }, { data: descartados }] = await Promise.all([
        supa.from("processos").select("numero_processo").eq("office_id", officeId).in("numero_processo", numeros),
        supa.from("processos_descartados").select("numero_processo").eq("office_id", officeId).in("numero_processo", numeros),
      ]);
      const ocultos = new Set([
        ...(existentes || []).map((e: any) => e.numero_processo),
        ...(descartados || []).map((d: any) => d.numero_processo),
      ]);
      const novos = items.filter((i: any) => !ocultos.has(onlyDigits(i.numeroProcesso)));
      if (!novos.length) continue;

      const rows = novos.map((i: any) => ({
        office_id: officeId,
        numero_processo: onlyDigits(i.numeroProcesso),
        titulo: i.titulo || null,
        tribunal: i.tribunal || null,
        autor: i.autor === "Não identificado" ? null : (i.autor || null),
        reu: i.reu === "Não identificado" ? null : (i.reu || null),
        fonte: i.fonte || "oab",
        payload: i,
        encontrado_por: (p as any).user_id,
      }));
      // ignoreDuplicates → não re-adiciona o que já está na caixa
      await supa.from("processos_encontrados").upsert(rows, { onConflict: "office_id,numero_processo", ignoreDuplicates: true });
      totalNovos += novos.length;
      detalhes.push({ oab, uf, novos: novos.length });
    }

    return new Response(JSON.stringify({ ok: true, totalNovos, detalhes }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
