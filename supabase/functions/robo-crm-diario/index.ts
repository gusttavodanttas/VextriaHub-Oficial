// Robô CRM diário (cron): agenda o próximo contato (follow-up) dos leads ativos
// que estão sem data, respeitando o prazo configurado por escritório
// (offices.settings.crm_followup_dias, padrão 3).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-robot-secret",
};

const STATUS_ATIVOS = ["lead", "quente", "morno", "frio"];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders, status: 204 });

  // Proteção: só roda com o segredo do robô
  const robotSecret = req.headers.get("x-robot-secret");
  if (!robotSecret || robotSecret !== Deno.env.get("ROBOT_SECRET")) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const { data: offices } = await supa.from("offices").select("id, settings");
    let total = 0;
    const detalhes: any[] = [];
    const hoje = new Date();

    for (const o of offices || []) {
      const dias = Number(((o as any).settings || {}).crm_followup_dias) || 3;
      const d = new Date(hoje);
      d.setDate(d.getDate() + dias);
      const novaData = d.toISOString().slice(0, 10);

      const { data: updated, error } = await supa
        .from("clientes")
        .update({ proximo_contato: novaData })
        .eq("office_id", (o as any).id)
        .is("proximo_contato", null)
        .eq("deletado", false)
        .in("status", STATUS_ATIVOS)
        .select("id");

      if (!error && updated && updated.length) {
        total += updated.length;
        detalhes.push({ office: (o as any).id, agendados: updated.length });
      }
    }

    return new Response(JSON.stringify({ ok: true, total, detalhes }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
