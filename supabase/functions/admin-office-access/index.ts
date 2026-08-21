import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Ações de ACESSO do SUPER-ADMIN sobre um escritório: vitalício (grátis), revogar e desconto.
// Grava em office_subscriptions (fonte da verdade do office_has_access) e reflete no Asaas.
// Isolada da asaas-billing crítica de propósito. Só super_admin.
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
    const { data: prof } = await service.from("profiles").select("role").eq("user_id", uid).maybeSingle();
    if (prof?.role !== "super_admin") return json({ error: "somente-super-admin" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");
    const officeId = String(body?.office_id || "");
    if (!officeId) return json({ error: "office_id-obrigatorio" }, 400);

    const { data: sub } = await service
      .from("office_subscriptions").select("*").eq("office_id", officeId).maybeSingle();
    const now = new Date().toISOString();

    // VITALÍCIO — acesso grátis para sempre. Cancela a cobrança no Asaas.
    if (action === "grant_lifetime") {
      if (sub?.asaas_subscription_id && KEY) await asaas(`/subscriptions/${sub.asaas_subscription_id}`, "DELETE");
      await service.from("office_subscriptions").upsert({
        office_id: officeId, is_lifetime: true, status: "cortesia", value: 0,
        plan_name: sub?.plan_name || "Vitalício", manual_discount_percent: 0,
        asaas_subscription_id: null, next_due_date: null, trial_ends_at: null, updated_at: now,
      }, { onConflict: "office_id" });
      return json({ ok: true, status: "cortesia", is_lifetime: true });
    }

    // REVOGAR VITALÍCIO — remove o acesso grátis (bloqueia até nova cobrança).
    if (action === "revoke_lifetime") {
      if (sub?.asaas_subscription_id && KEY) await asaas(`/subscriptions/${sub.asaas_subscription_id}`, "DELETE");
      await service.from("office_subscriptions").upsert({
        office_id: officeId, is_lifetime: false, status: "cancelada",
        asaas_subscription_id: null, updated_at: now,
      }, { onConflict: "office_id" });
      return json({ ok: true, status: "cancelada", is_lifetime: false });
    }

    // DESCONTO — reduz o valor recorrente. Idempotente: sempre calcula a partir de base_value.
    if (action === "apply_discount") {
      const d = Math.min(Math.max(Number(body?.discount_percent) || 0, 0), 100);
      const base = Number(sub?.base_value ?? sub?.value) || 0;
      const newValue = Math.round(base * (1 - d / 100) * 100) / 100;
      // Se existe assinatura ativa no Asaas, ajusta o valor recorrente lá (sem gerar nova fatura).
      if (sub?.asaas_subscription_id && KEY) {
        const up = await asaas(`/subscriptions/${sub.asaas_subscription_id}`, "POST", { value: newValue });
        if (!up.ok) return json({ error: asaasErr(up.data), etapa: "asaas-update" }, 400);
      }
      await service.from("office_subscriptions").upsert({
        office_id: officeId, value: newValue, base_value: base, manual_discount_percent: d, updated_at: now,
      }, { onConflict: "office_id" });
      return json({ ok: true, value: newValue, discount: d });
    }

    // TRIAL ESTENDIDO — libera um período maior de teste (em vez de cortesia).
    if (action === "grant_trial") {
      const days = Math.min(Math.max(Number(body?.trial_days) || 0, 1), 3650);
      const ends = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
      if (sub?.asaas_subscription_id && KEY) await asaas(`/subscriptions/${sub.asaas_subscription_id}`, "DELETE");
      await service.from("office_subscriptions").upsert({
        office_id: officeId, status: "trial", trial_ends_at: ends, is_lifetime: false,
        plan_name: sub?.plan_name || "Trial estendido", asaas_subscription_id: null, updated_at: now,
      }, { onConflict: "office_id" });
      return json({ ok: true, status: "trial", trial_ends_at: ends });
    }

    return json({ error: "acao-invalida" }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message) }, 500);
  }
});
