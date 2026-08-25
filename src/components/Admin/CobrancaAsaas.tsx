import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Loader2, RefreshCw, Search, CreditCard, Copy, Check, XCircle, RotateCw, ExternalLink, Gift, Users, TrendingUp, AlertTriangle, CheckCircle2,
} from "lucide-react";
import { formatCpfCnpj, onlyDigits, isValidCpfCnpj } from "@/lib/document";
import { formatBRL } from "@/lib/currency";

interface SubRow {
  asaas_subscription_id?: string | null;
  status: string; plan_name: string | null; value: number; cycle: string;
  billing_type: string; next_due_date: string | null; last_invoice_url: string | null; is_lifetime: boolean;
}
interface OfficeRow { id: string; name: string; email: string | null; sub: SubRow | null }

const CYCLES = [
  { v: "SEMIANNUALLY", l: "Semestral" }, { v: "YEARLY", l: "Anual" },
  { v: "MONTHLY", l: "Mensal" }, { v: "QUARTERLY", l: "Trimestral" },
];
const BILLING = [
  { v: "UNDEFINED", l: "Cliente escolhe" }, { v: "PIX", l: "PIX" },
  { v: "BOLETO", l: "Boleto" }, { v: "CREDIT_CARD", l: "Cartão" },
];
const TRIAL_DAYS = 7;
const brl = (n: number | null) => (n == null ? "—" : formatBRL(n));
const fmtDate = (d: string | null) => (d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—");
const maskMoney = (s: string) => { const d = onlyDigits(s); return d ? (parseInt(d, 10) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : ""; };
const moneyToNumber = (s: string) => { const d = onlyDigits(s); return d ? parseInt(d, 10) / 100 : 0; };

const STATUS: Record<string, { label: string; cls: string }> = {
  ativa: { label: "Ativa", cls: "bg-emerald-100 text-emerald-700" },
  cortesia: { label: "Cortesia", cls: "bg-violet-100 text-violet-700" },
  trial: { label: "Trial", cls: "bg-blue-100 text-blue-700" },
  pendente: { label: "Pendente", cls: "bg-amber-100 text-amber-700" },
  atrasada: { label: "Atrasada", cls: "bg-red-100 text-red-700" },
  cancelada: { label: "Cancelada", cls: "bg-gray-200 text-gray-600" },
};
const errMap: Record<string, string> = {
  "sem-asaas-key": "Chave do Asaas não configurada (ASAAS_API_KEY nos segredos do Supabase).",
  "cpfcnpj-invalido": "CPF/CNPJ inválido.", "valor-invalido": "Informe um valor válido.",
  "nao-autorizado": "Sem permissão.", "sem-assinatura": "Este escritório ainda não tem assinatura.",
  "plano-invalido": "Plano não encontrado.",
};

export default function CobrancaAsaas() {
  const { toast } = useToast();
  const [rows, setRows] = useState<OfficeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const [mode, setMode] = useState<"cobranca" | "cortesia">("cobranca");
  const [cpf, setCpf] = useState("");
  const [plan, setPlan] = useState("");
  const [value, setValue] = useState("");
  const [cycle, setCycle] = useState("SEMIANNUALLY");
  const [billing, setBilling] = useState("UNDEFINED");
  const [trial, setTrial] = useState(false);

  const docDigits = onlyDigits(cpf);
  const docOk = isValidCpfCnpj(cpf, docDigits.length > 11 ? "juridica" : "fisica");

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: offices }, { data: subs }] = await Promise.all([
      supabase.from("offices").select("id, name, email").order("created_at", { ascending: false }),
      supabase.from("office_subscriptions").select("*"),
    ]);
    const byOffice = new Map<string, SubRow>();
    ((subs as unknown as (SubRow & { office_id: string })[]) || []).forEach((s) => byOffice.set(s.office_id, s));
    setRows(((offices as { id: string; name: string; email: string | null }[]) || []).map((o) => ({ ...o, sub: byOffice.get(o.id) || null })));
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows.filter((r) => !t || `${r.name || ""} ${r.email || ""}`.toLowerCase().includes(t));
  }, [rows, q]);

  const metrics = useMemo(() => ({
    total: rows.length,
    ativos: rows.filter((r) => ["ativa", "cortesia"].includes(r.sub?.status || "")).length,
    inadimplentes: rows.filter((r) => ["atrasada", "pendente"].includes(r.sub?.status || "")).length,
    receita: rows.reduce((a, r) => a + (r.sub?.status === "ativa" ? Number(r.sub?.value || 0) : 0), 0),
  }), [rows]);

  const resetForm = () => { setMode("cobranca"); setCpf(""); setPlan(""); setValue(""); setCycle("SEMIANNUALLY"); setBilling("UNDEFINED"); setTrial(false); };

  const call = async (action: string, office_id: string, extra: Record<string, unknown> = {}) => {
    setBusy(office_id);
    const { data, error } = await supabase.functions.invoke("asaas-billing", { body: { action, office_id, ...extra } });
    setBusy(null);
    let payload: { error?: string } | null = data;
    if (error) { try { payload = await (error as { context?: Response }).context?.json() ?? null; } catch { payload = null; } }
    if (payload?.error || error) {
      toast({ title: "Não consegui concluir", description: errMap[payload?.error || ""] || payload?.error || "Erro de conexão.", variant: "destructive" });
      return null;
    }
    return payload;
  };

  const setup = async (r: OfficeRow) => {
    if (!plan.trim()) { toast({ title: "Informe o nome do plano", variant: "destructive" }); return; }
    if (!docOk) { toast({ title: "CPF/CNPJ inválido", variant: "destructive" }); return; }
    const num = moneyToNumber(value);
    if (num < 5) { toast({ title: "Valor mínimo R$ 5,00", description: "O Asaas não aceita cobranças abaixo disso.", variant: "destructive" }); return; }
    const res = await call("setup", r.id, { cpfCnpj: docDigits, plan_name: plan, value: num, cycle, billing_type: billing, trial, trial_days: TRIAL_DAYS });
    if (res) { toast({ title: trial ? "Teste liberado! 🎁" : "Cobrança criada!", description: trial ? `Acesso ativo; 1ª cobrança em ${TRIAL_DAYS} dias.` : "Copie o link e envie ao cliente." }); setOpenId(null); resetForm(); load(); }
  };
  const courtesy = async (r: OfficeRow) => { const res = await call("courtesy", r.id, { plan_name: plan.trim() || "Cortesia" }); if (res) { toast({ title: "Cortesia liberada! 🎟️" }); setOpenId(null); resetForm(); load(); } };
  const sync = async (r: OfficeRow) => { const res = await call("sync", r.id); if (res) { toast({ title: "Status atualizado" }); load(); } };
  const cancel = async (r: OfficeRow) => {
    if (!confirm(`Cancelar a cobrança de ${r.name}? O acesso será bloqueado.`)) return;
    const res = await call("cancel", r.id); if (res) { toast({ title: "Cobrança cancelada" }); load(); }
  };
  const copyLink = async (url: string, id: string) => { await navigator.clipboard.writeText(url); setCopied(id); setTimeout(() => setCopied(null), 1600); };

  const Metric = ({ icon: Icon, label, value: v, cls }: { icon: typeof Users; label: string; value: string | number; cls?: string }) => (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">{label}</span><Icon className={`h-4 w-4 ${cls || "text-muted-foreground"}`} /></div>
      <div className={`text-2xl font-bold mt-1 ${cls || ""}`}>{v}</div>
    </div>
  );

  return (
    <section className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Metric icon={Users} label="Escritórios" value={metrics.total} />
        <Metric icon={CheckCircle2} label="Ativos / cortesia" value={metrics.ativos} cls="text-emerald-600" />
        <Metric icon={AlertTriangle} label="Pendentes / atrasados" value={metrics.inadimplentes} cls="text-red-600" />
        <Metric icon={TrendingUp} label="Receita ativa (mês-base)" value={brl(metrics.receita)} cls="text-blue-600" />
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar escritório…" className="pl-9" />
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}><RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /></Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : shown.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">Nenhum escritório.</p>
      ) : (
        <div className="space-y-2">
          {shown.map((r) => {
            const isBusy = busy === r.id;
            const open = openId === r.id;
            const st = r.sub?.status || "sem";
            const showSetup = !r.sub || ["cancelada", "trial", "pendente"].includes(st);
            const isCourtesy = st === "cortesia";
            return (
              <div key={r.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{r.name || "Sem nome"}</p>
                    <p className="text-xs text-muted-foreground truncate">{r.email || "—"}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={STATUS[st]?.cls || "bg-gray-100 text-gray-600"}>{STATUS[st]?.label || "Sem plano"}</Badge>
                    {r.sub && r.sub.value > 0 && <span className="text-xs text-muted-foreground">{brl(r.sub.value)} · {st === "trial" ? "cobra" : "vence"} {fmtDate(r.sub.next_due_date)}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <Button size="sm" variant={open ? "secondary" : "default"} onClick={() => { setOpenId(open ? null : r.id); resetForm(); if (r.sub?.plan_name) setPlan(r.sub.plan_name); }}>
                    <CreditCard className="w-4 h-4 mr-1.5" /> {open ? "Fechar" : "Configurar plano"}
                  </Button>
                  {r.sub?.last_invoice_url && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => copyLink(r.sub!.last_invoice_url!, r.id)}>
                        {copied === r.id ? <><Check className="w-4 h-4 mr-1.5 text-emerald-500" /> Copiado</> : <><Copy className="w-4 h-4 mr-1.5" /> Copiar link</>}
                      </Button>
                      <a href={r.sub.last_invoice_url} target="_blank" rel="noreferrer" className="text-xs text-primary inline-flex items-center gap-1 hover:underline"><ExternalLink className="w-3.5 h-3.5" /> fatura</a>
                    </>
                  )}
                  {r.sub?.asaas_subscription_id && (
                    <Button size="sm" variant="ghost" onClick={() => sync(r)} disabled={isBusy}>
                      {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><RotateCw className="w-4 h-4 mr-1.5" /> Sincronizar</>}
                    </Button>
                  )}
                  {r.sub && !["cancelada"].includes(st) && (
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => cancel(r)} disabled={isBusy}>
                      <XCircle className="w-4 h-4 mr-1.5" /> {isCourtesy ? "Remover cortesia" : "Cancelar"}
                    </Button>
                  )}
                </div>

                {open && (
                  <div className="mt-3 rounded-lg border border-border p-3 space-y-3">
                    <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1 w-fit">
                      <button onClick={() => setMode("cobranca")} className={`text-xs font-medium px-3 py-1.5 rounded-md ${mode === "cobranca" ? "bg-background shadow-sm" : "text-muted-foreground"}`}>Cobrança</button>
                      <button onClick={() => setMode("cortesia")} className={`text-xs font-medium px-3 py-1.5 rounded-md ${mode === "cortesia" ? "bg-background shadow-sm" : "text-muted-foreground"}`}>Cortesia</button>
                    </div>

                    {mode === "cortesia" ? (
                      <div className="space-y-3">
                        <p className="text-[11px] text-muted-foreground">Acesso grátis e sem cobrança, por tempo indeterminado. Nenhuma assinatura é criada no Asaas.</p>
                        <div className="space-y-1"><label className="text-xs text-muted-foreground">Nome / motivo (opcional)</label><Input value={plan} onChange={(e) => setPlan(e.target.value)} placeholder="Ex: Parceiro, VIP" /></div>
                        <Button size="sm" onClick={() => courtesy(r)} disabled={isBusy}>{isBusy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Gift className="w-4 h-4 mr-1.5" />} Liberar cortesia</Button>
                      </div>
                    ) : (
                      <>
                        {cycle !== "MONTHLY" && (
                          <div className="flex items-center justify-between gap-3 rounded-lg bg-blue-500/5 border border-blue-500/20 px-3 py-2">
                            <div className="flex items-center gap-2"><Gift className="w-4 h-4 text-blue-500" /><div><p className="text-sm font-medium">{TRIAL_DAYS} dias grátis</p><p className="text-[11px] text-muted-foreground">Acesso na hora; 1ª cobrança depois de {TRIAL_DAYS} dias.</p></div></div>
                            <Switch checked={trial} onCheckedChange={setTrial} />
                          </div>
                        )}
                        <div className="grid sm:grid-cols-2 gap-3">
                          <div className="space-y-1"><label className="text-xs text-muted-foreground">CPF/CNPJ do cliente</label><Input value={cpf} onChange={(e) => setCpf(formatCpfCnpj(e.target.value))} placeholder="000.000.000-00" inputMode="numeric" className={docDigits.length >= 11 && !docOk ? "border-destructive" : ""} /></div>
                          <div className="space-y-1"><label className="text-xs text-muted-foreground">Nome do plano</label><Input value={plan} onChange={(e) => setPlan(e.target.value)} placeholder="Ex: Plano Pro" /></div>
                          <div className="space-y-1"><label className="text-xs text-muted-foreground">Valor</label><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span><Input value={value} onChange={(e) => setValue(maskMoney(e.target.value))} placeholder="0,00" inputMode="numeric" className="pl-9" /></div></div>
                          <div className="space-y-1"><label className="text-xs text-muted-foreground">Ciclo</label><select value={cycle} onChange={(e) => { setCycle(e.target.value); if (e.target.value === "MONTHLY") setTrial(false); }} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">{CYCLES.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}</select></div>
                          <div className="space-y-1"><label className="text-xs text-muted-foreground">Forma de pagamento</label><select value={billing} onChange={(e) => setBilling(e.target.value)} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">{BILLING.map((b) => <option key={b.v} value={b.v}>{b.l}</option>)}</select></div>
                        </div>
                        <Button size="sm" onClick={() => setup(r)} disabled={isBusy}>{isBusy ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Criando…</> : trial ? <><Gift className="w-4 h-4 mr-1.5" /> Liberar {TRIAL_DAYS} dias grátis</> : <><CreditCard className="w-4 h-4 mr-1.5" /> Criar cobrança</>}</Button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
