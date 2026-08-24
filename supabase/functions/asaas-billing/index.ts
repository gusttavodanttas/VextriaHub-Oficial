import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Cobrança via Asaas, POR ESCRITÓRIO. Substitui o Stripe.
// Autoriza: super_admin (qualquer escritório) OU admin/owner do próprio escritório (self-serve).
// actions: setup (cria assinatura no Asaas), courtesy (grátis, super_admin), sync, cancel.
// O bloqueio/liberação por pagamento é do asaas-webhook. Env: ASAAS_API_KEY, ASAAS_BASE_URL (opcional).
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const BASE = Deno.env.get("ASAAS_BASE_URL") || "https://api.asaas.com/v3";
const KEY = Deno.env.get("ASAAS_API_KEY") || "";

async function asaas(path: string, method = "GET", body?: unknown) {
  const res = await fetch(BASE + path, {
    method,
    headers: { access_token: KEY, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data } as { ok: boolean; status: number; data: any };
}
const asaasErr = (d: any) => d?.errors?.[0]?.description || d?.message || "erro-asaas";
const plusDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

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

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");
    const officeId = String(body?.office_id || "");
    if (!officeId) return json({ error: "office_id-obrigatorio" }, 400);

    // Autorização: super_admin OU admin/owner ATIVO do escritório alvo.
    const { data: prof } = await service.from("profiles").select("role").eq("user_id", uid).maybeSingle();
    const isSuper = prof?.role === "super_admin";
    const { data: membership } = await service
      .from("office_users").select("role")
      .eq("user_id", uid).eq("office_id", officeId).eq("active", true).maybeSingle();
    const isOfficeAdmin = !!membership && ["admin", "owner"].includes(String(membership.role));
    if (!isSuper && !isOfficeAdmin) return json({ error: "nao-autorizado" }, 403);

    const { data: office } = await service.from("offices").select("name, email").eq("id", officeId).maybeSingle();
    const { data: sub } = await service.from("office_subscriptions").select("*").eq("office_id", officeId).maybeSingle();

    // COURTESY — acesso grátis sem cobrança. Só super_admin.
    if (action === "courtesy") {
      if (!isSuper) return json({ error: "somente-super-admin" }, 403);
      const planName = String(body?.plan_name || "Cortesia").trim() || "Cortesia";
      if (sub?.asaas_subscription_id && KEY) await asaas(`/subscriptions/${sub.asaas_subscription_id}`, "DELETE");
      await service.from("office_subscriptions").upsert({
        office_id: officeId, plan_name: planName, value: 0, cycle: "MONTHLY", billing_type: "UNDEFINED",
        status: "cortesia", trial_ends_at: null, next_due_date: null,
        asaas_customer_id: sub?.asaas_customer_id ?? null, asaas_subscription_id: null,
        last_invoice_url: null, is_lifetime: false, updated_at: new Date().toISOString(),
      }, { onConflict: "office_id" });
      return json({ ok: true, status: "cortesia" });
    }

    // SETUP — cria/atualiza a assinatura paga no Asaas.
    if (action === "setup") {
      if (!KEY) return json({ error: "sem-asaas-key" }, 500);
      const cpfCnpj = String(body?.cpfCnpj || "").replace(/[^0-9]/g, "");
      let cycle = String(body?.cycle || "MONTHLY");
      const billingType = String(body?.billing_type || "UNDEFINED");
      // Trial SÓ o super_admin concede — senão um admin do próprio escritório se
      // daria trial infinito (trial_days grande) e nunca pagaria. Dias limitados a 30.
      const trial = isSuper && !!body?.trial;
      const trialDays = Math.min(Math.max(Number(body?.trial_days) || 7, 1), 30);
      const nextDue = trial ? plusDays(trialDays) : String(body?.first_due_date || plusDays(3));

      // Valor/nome/CICLO do plano: self-serve (admin do escritório) DEVE usar um plano do
      // catálogo (plan_configs) — valor E ciclo vêm do SERVIDOR, não do body (anti-fraude:
      // impede casar preço anual com cobrança mensal). Super admin pode passar valor livre.
      let planName = String(body?.plan_name || "Plano").trim();
      let value = Number(body?.value);
      const planType = String(body?.plan_type || "").trim();
      if (planType) {
        const { data: plan } = await service
          .from("plan_configs").select("plan_name, price_cents, cycle")
          .eq("plan_type", planType).eq("is_active", true).maybeSingle();
        if (!plan) return json({ error: "plano-invalido" }, 400);
        planName = String(plan.plan_name || planName);
        value = Number(plan.price_cents) / 100;
        if (plan.cycle) cycle = String(plan.cycle);
      } else if (!isSuper) {
        return json({ error: "plano-obrigatorio" }, 400);
      }
      if (!cpfCnpj || cpfCnpj.length < 11) return json({ error: "cpfcnpj-invalido" }, 400);
      if (!value || value <= 0) return json({ error: "valor-invalido" }, 400);

      let customerId = sub?.asaas_customer_id as string | undefined;
      if (!customerId) {
        const c = await asaas("/customers", "POST", {
          name: office?.name || planName, email: office?.email || undefined, cpfCnpj,
        });
        if (!c.ok) return json({ error: asaasErr(c.data), etapa: "customer" }, 400);
        customerId = c.data.id;
      }

      // Troca de plano / re-setup: cancela a assinatura ANTIGA no Asaas antes de
      // criar a nova — senão as duas coexistem e o cliente é cobrado em duplicidade
      // (o id local é sobrescrito logo abaixo e a antiga ficaria órfã, cobrando pra sempre).
      // CHECA o resultado: se o cancelamento falhar, ABORTA (não cria a nova por cima da
      // antiga viva). Sem isso, um hiccup no DELETE resultava em cobrança em dobro.
      if (sub?.asaas_subscription_id) {
        const del = await asaas(`/subscriptions/${sub.asaas_subscription_id}`, "DELETE");
        // Tolera 404: a assinatura antiga já não existe no Asaas (ex.: foi cancelada antes, mas
        // o id local ficou) — seguir e criar a nova. Sem isso, reassinar travava em 404-loop.
        if (!del.ok && del.status !== 404) return json({ error: "falha ao cancelar a assinatura anterior; tente de novo", etapa: "cancel-old" }, 400);
      }

      const s = await asaas("/subscriptions", "POST", {
        customer: customerId, billingType, value, nextDueDate: nextDue, cycle, description: planName,
      });
      if (!s.ok) return json({ error: asaasErr(s.data), etapa: "subscription" }, 400);
      const subscriptionId = s.data.id;

      let invoiceUrl: string | null = null;
      const pays = await asaas(`/subscriptions/${subscriptionId}/payments?limit=1`);
      if (pays.ok && Array.isArray(pays.data?.data) && pays.data.data[0]) invoiceUrl = pays.data.data[0].invoiceUrl || null;

      await service.from("office_subscriptions").upsert({
        office_id: officeId, asaas_customer_id: customerId, asaas_subscription_id: subscriptionId,
        plan_name: planName, value, cycle, billing_type: billingType,
        status: trial ? "trial" : "pendente",
        // NÃO zera o trial ao gerar a cobrança: preserva o trial vigente para o
        // escritório não ser trancado no meio do teste (o office_has_access dá
        // acesso a 'pendente' enquanto trial_ends_at >= hoje).
        trial_ends_at: trial ? nextDue : (sub?.trial_ends_at ?? null), next_due_date: nextDue,
        last_invoice_url: invoiceUrl, is_lifetime: false, updated_at: new Date().toISOString(),
      }, { onConflict: "office_id" });

      return json({ ok: true, status: trial ? "trial" : "pendente", subscription_id: subscriptionId, invoice_url: invoiceUrl, next_due_date: nextDue });
    }

    // SYNC — reconsulta o Asaas e atualiza o status local.
    if (action === "sync") {
      if (!KEY) return json({ error: "sem-asaas-key" }, 500);
      if (!sub?.asaas_subscription_id) return json({ error: "sem-assinatura" }, 404);
      const pays = await asaas(`/subscriptions/${sub.asaas_subscription_id}/payments?limit=10`);
      const list: any[] = pays.ok && Array.isArray(pays.data?.data) ? pays.data.data : [];
      const pending = list.find((p) => ["PENDING", "OVERDUE"].includes(p.status));
      const anyReceived = list.some((p) => ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(p.status));
      const anyOverdue = list.some((p) => p.status === "OVERDUE");
      const status = anyOverdue ? "atrasada" : anyReceived ? "ativa" : (sub.status === "trial" ? "trial" : "pendente");
      const invoiceUrl = pending?.invoiceUrl || list[0]?.invoiceUrl || sub.last_invoice_url;
      const nextDue = pending?.dueDate || sub.next_due_date;
      await service.from("office_subscriptions").update({
        status, last_invoice_url: invoiceUrl, next_due_date: nextDue, updated_at: new Date().toISOString(),
      }).eq("office_id", officeId);
      return json({ ok: true, status, invoice_url: invoiceUrl });
    }

    // CANCEL — encerra a assinatura e bloqueia o acesso.
    if (action === "cancel") {
      if (sub?.asaas_subscription_id) {
        if (!KEY) return json({ error: "sem-asaas-key" }, 500);
        await asaas(`/subscriptions/${sub.asaas_subscription_id}`, "DELETE");
      }
      // Zera o id da assinatura: sem isso, o setup seguinte tentaria DELETE numa sub já
      // deletada (404) e travava. (Mesmo padrão do admin-office-access.)
      await service.from("office_subscriptions").update({
        status: "cancelada", asaas_subscription_id: null, updated_at: new Date().toISOString(),
      }).eq("office_id", officeId);
      return json({ ok: true, status: "cancelada" });
    }

    return json({ error: "acao-invalida" }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message) }, 500);
  }
});
