import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// asaas-reconcile — rede de segurança do webhook. Roda por cron: reconsulta o
// Asaas de cada escritório com assinatura e corrige o status em office_subscriptions
// (ativa/atrasada/pendente). Garante que um evento de webhook perdido não deixe
// cliente trancado (com o bloqueio total da RLS) nem pagando bloqueado.
// Auth: x-robot-secret (fail-closed). Deploy com --no-verify-jwt.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const BASE = Deno.env.get("ASAAS_BASE_URL") || "https://api.asaas.com/v3";
const KEY = Deno.env.get("ASAAS_API_KEY") || "";

async function asaas(path: string) {
  const res = await fetch(BASE + path, { headers: { access_token: KEY, "Content-Type": "application/json" } });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data } as { ok: boolean; data: any };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors, status: 204 });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
  try {
    const ROBOT_SECRET = Deno.env.get("ROBOT_SECRET") || "";
    const secret = req.headers.get("x-robot-secret") || "";
    if (!ROBOT_SECRET || secret !== ROBOT_SECRET) return json({ ok: false, error: "unauthorized" }, 401);
    if (!KEY) return json({ ok: false, error: "sem-asaas-key" }, 500);

    const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Só assinaturas pagas do Asaas (ignora cortesia/lifetime/sem assinatura).
    const { data: subs } = await service
      .from("office_subscriptions")
      .select("office_id, asaas_subscription_id, status, next_due_date, last_invoice_url")
      .not("asaas_subscription_id", "is", null)
      .not("status", "in", "(cortesia,cancelada)");

    let atualizados = 0;
    const detalhes: any[] = [];

    for (const s of (subs as any[]) || []) {
      try {
        const pays = await asaas(`/subscriptions/${s.asaas_subscription_id}/payments?limit=10`);
        const list: any[] = pays.ok && Array.isArray(pays.data?.data) ? pays.data.data : [];
        if (!list.length) continue;
        const anyReceived = list.some((p) => ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(p.status));
        const anyOverdue = list.some((p) => p.status === "OVERDUE");
        const pending = list.find((p) => ["PENDING", "OVERDUE"].includes(p.status));
        const newStatus = anyOverdue ? "atrasada" : anyReceived ? "ativa" : (s.status === "trial" ? "trial" : "pendente");

        const upd: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (pending?.invoiceUrl) upd.last_invoice_url = pending.invoiceUrl;
        if (pending?.dueDate) upd.next_due_date = pending.dueDate;
        // Só grava se mudou o status (evita writes à toa) — mas sempre atualiza fatura/vencimento.
        if (newStatus !== s.status) { upd.status = newStatus; atualizados++; detalhes.push({ office: s.office_id, de: s.status, para: newStatus }); }
        await service.from("office_subscriptions").update(upd).eq("office_id", s.office_id);
      } catch (e) {
        detalhes.push({ office: s.office_id, erro: String((e as Error).message) });
      }
    }

    return json({ ok: true, atualizados, total: (subs as any[])?.length || 0, detalhes });
  } catch (e) {
    return json({ ok: false, error: String((e as Error).message) }, 500);
  }
});
