import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// asaas-webhook — recebe eventos de cobrança do Asaas e libera/bloqueia o acesso do ESCRITÓRIO.
// Público (o Asaas chama de fora), protegido por token: header asaas-access-token OU ?token= na URL,
// comparado com o segredo ASAAS_WEBHOOK_TOKEN. Deploy com --no-verify-jwt.
serve(async (req) => {
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });
  try {
    const SECRET = Deno.env.get("ASAAS_WEBHOOK_TOKEN") || "";
    const url = new URL(req.url);
    const provided = req.headers.get("asaas-access-token") || url.searchParams.get("token") || "";
    if (!SECRET || provided !== SECRET) return json({ error: "token-invalido" }, 401);

    const payload = await req.json().catch(() => ({}));
    const event = String(payload?.event || "");
    const pay = payload?.payment || {};
    const subId = pay?.subscription || null;
    const custId = pay?.customer || null;

    const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Acha o escritório pela subscription, ou pelo customer como fallback.
    let row: any = null;
    if (subId) {
      const r = await service.from("office_subscriptions").select("*").eq("asaas_subscription_id", subId).maybeSingle();
      row = r.data;
    }
    if (!row && custId) {
      const r = await service.from("office_subscriptions").select("*").eq("asaas_customer_id", custId).maybeSingle();
      row = r.data;
    }

    // Log sempre (mesmo sem casar), pra rastreio.
    await service.from("billing_events").insert({
      office_id: row?.office_id || null,
      asaas_payment_id: pay?.id || null,
      asaas_subscription_id: subId,
      event,
      status: pay?.status || null,
      value: pay?.value ?? null,
      due_date: pay?.dueDate || null,
      invoice_url: pay?.invoiceUrl || null,
      raw: payload,
    });

    if (!row) return json({ ok: true, matched: false });

    const paid = ["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED", "PAYMENT_RECEIVED_IN_CASH"].includes(event);
    const overdue = event === "PAYMENT_OVERDUE";
    const dead = ["PAYMENT_REFUNDED", "PAYMENT_CHARGEBACK_REQUESTED", "PAYMENT_CHARGEBACK_DISPUTE"].includes(event);

    let newStatus: string | null = null;
    if (paid) newStatus = "ativa";
    else if (overdue) newStatus = "atrasada";
    else if (dead) newStatus = "cancelada";

    const upd: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (newStatus) upd.status = newStatus;
    if (pay?.invoiceUrl) upd.last_invoice_url = pay.invoiceUrl;
    if (pay?.dueDate) upd.next_due_date = pay.dueDate;
    const { error: updErr } = await service.from("office_subscriptions").update(upd).eq("office_id", row.office_id);
    if (updErr) return json({ error: "falha ao atualizar assinatura", detail: updErr.message }, 500); // 5xx → Asaas reenvia (não perder pagamento)

    return json({ ok: true, matched: true, status: newStatus });
  } catch (e) {
    return json({ error: String((e as Error).message) }, 500); // 5xx → Asaas reenvia
  }
});
