import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatCpfCnpj, onlyDigits, isValidCpfCnpj } from '@/lib/document';
import { CreditCard, FileText, QrCode, Loader2, CheckCircle2, ExternalLink, Copy, Check } from 'lucide-react';

interface Plan { plan_type: string; plan_name: string; price_cents: number; cycle?: string; signup_only?: boolean }
const cicloLabel: Record<string, string> = { MONTHLY: 'por mês', QUARTERLY: 'por trimestre', SEMIANNUALLY: 'por semestre', YEARLY: 'por ano' };
interface Sub { status: string; plan_name: string | null; next_due_date: string | null; last_invoice_url: string | null }

const brl = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
const BILLING = [
  { v: 'PIX', label: 'PIX (instantâneo)', icon: QrCode },
  { v: 'BOLETO', label: 'Boleto bancário', icon: FileText },
  { v: 'CREDIT_CARD', label: 'Cartão de crédito', icon: CreditCard },
];

function Pagamento() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { office } = useAuth();

  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [sub, setSub] = useState<Sub | null>(null);
  const [planType, setPlanType] = useState('');
  const [cpf, setCpf] = useState('');
  const [billing, setBilling] = useState('PIX');
  const [submitting, setSubmitting] = useState(false);
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const docDigits = onlyDigits(cpf);
  const docOk = isValidCpfCnpj(cpf, docDigits.length > 11 ? 'juridica' : 'fisica');

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: planRows }, subRes] = await Promise.all([
      supabase.from('plan_configs').select('plan_type, plan_name, price_cents, cycle, signup_only').eq('is_active', true).order('price_cents'),
      office?.id
        ? supabase.from('office_subscriptions').select('status, plan_name, next_due_date, last_invoice_url').eq('office_id', office.id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    const rows = ((planRows as Plan[]) || []).filter((p) => !p.signup_only);
    setPlans(rows);
    const preset = searchParams.get('plano') || searchParams.get('plan');
    if (preset && rows.some((p) => p.plan_type === preset)) setPlanType(preset);
    setSub((subRes.data as Sub) || null);
    if (subRes.data?.last_invoice_url && ['pendente', 'atrasada', 'trial'].includes(subRes.data.status)) {
      setInvoiceUrl(subRes.data.last_invoice_url);
    }
    setLoading(false);
  }, [office?.id, searchParams]);

  useEffect(() => { load(); }, [load]);

  const assinar = async () => {
    if (!office?.id) { toast({ title: 'Escritório não encontrado', variant: 'destructive' }); return; }
    if (!planType) { toast({ title: 'Escolha um plano', variant: 'destructive' }); return; }
    if (!docOk) { toast({ title: 'CPF/CNPJ inválido', description: 'Confira os números.', variant: 'destructive' }); return; }
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke('asaas-billing', {
      body: { action: 'setup', office_id: office.id, plan_type: planType, cpfCnpj: docDigits, billing_type: billing, cycle: plans.find(p => p.plan_type === planType)?.cycle || 'MONTHLY' },
    });
    setSubmitting(false);
    let payload: { error?: string; invoice_url?: string } | null = data;
    if (error) { try { payload = await (error as { context?: Response }).context?.json(); } catch { payload = null; } }
    if (payload?.error || error) {
      toast({ title: 'Não consegui criar a cobrança', description: payload?.error || 'Tente novamente.', variant: 'destructive' });
      return;
    }
    toast({ title: 'Cobrança criada!', description: 'Use o link para pagar por Pix, boleto ou cartão.' });
    setInvoiceUrl(payload?.invoice_url || null);
    load();
  };

  const copy = async () => {
    if (!invoiceUrl) return;
    await navigator.clipboard.writeText(invoiceUrl);
    setCopied(true); setTimeout(() => setCopied(false), 1600);
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen gap-2"><Loader2 className="h-6 w-6 animate-spin" /> Carregando…</div>;
  }

  const active = sub && ['ativa', 'cortesia'].includes(sub.status);

  return (
    <div className="container mx-auto px-4 py-10 max-w-2xl space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Assinatura</h1>
        <p className="text-muted-foreground mt-2">
          {active ? 'Seu escritório está com o acesso ativo.' : 'Escolha um plano para ativar o acesso do seu escritório.'}
        </p>
      </div>

      {active ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-500" />
            <p className="font-semibold text-lg">Assinatura {sub?.status === 'cortesia' ? 'cortesia' : 'ativa'}</p>
            <p className="text-sm text-muted-foreground">{sub?.plan_name}{sub?.next_due_date ? ` · próxima cobrança ${new Date(sub.next_due_date + 'T00:00:00').toLocaleDateString('pt-BR')}` : ''}</p>
            <Button variant="outline" onClick={() => navigate('/dashboard')}>Ir para o dashboard</Button>
          </CardContent>
        </Card>
      ) : invoiceUrl ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <QrCode className="h-12 w-12 text-primary" />
            <div>
              <p className="font-semibold text-lg">Sua cobrança está pronta</p>
              <p className="text-sm text-muted-foreground">Abra o link para pagar por Pix, boleto ou cartão. O acesso libera assim que o pagamento for confirmado.</p>
            </div>
            <div className="flex gap-2">
              <a href={invoiceUrl} target="_blank" rel="noreferrer">
                <Button className="gap-2"><ExternalLink className="h-4 w-4" /> Abrir fatura</Button>
              </a>
              <Button variant="outline" onClick={copy} className="gap-2">
                {copied ? <><Check className="h-4 w-4 text-emerald-500" /> Copiado</> : <><Copy className="h-4 w-4" /> Copiar link</>}
              </Button>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setInvoiceUrl(null)}>Trocar de plano</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader><CardTitle>Escolha o plano</CardTitle><CardDescription>Cobrança recorrente — cancele quando quiser.</CardDescription></CardHeader>
            <CardContent className="space-y-2">
              {plans.length === 0 && <p className="text-sm text-muted-foreground">Nenhum plano disponível no momento.</p>}
              {plans.map((p) => (
                <button key={p.plan_type} type="button" onClick={() => setPlanType(p.plan_type)}
                  className={`w-full flex items-center justify-between p-4 border rounded-xl transition-colors text-left ${planType === p.plan_type ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}>
                  <span className="font-medium">{p.plan_name}</span>
                  <div className="text-right">
                    <Badge variant="secondary">{brl(p.price_cents)}</Badge>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{cicloLabel[p.cycle || 'MONTHLY']}</div>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Seus dados</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">CPF ou CNPJ do responsável</label>
                <Input value={cpf} onChange={(e) => setCpf(formatCpfCnpj(e.target.value))} placeholder="000.000.000-00" inputMode="numeric"
                  className={docDigits.length >= 11 && !docOk ? 'border-destructive' : ''} />
                {docDigits.length >= 11 && !docOk && <p className="text-xs text-destructive">Número inválido.</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Forma de pagamento</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {BILLING.map(({ v, label, icon: Icon }) => (
                    <button key={v} type="button" onClick={() => setBilling(v)}
                      className={`flex items-center gap-2 p-3 border rounded-lg transition-colors ${billing === v ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}>
                      <Icon className="h-4 w-4" /><span className="text-sm">{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Button size="lg" className="w-full" onClick={assinar} disabled={submitting || !planType || !docOk}>
            {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Criando cobrança…</> : 'Assinar'}
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => navigate('/dashboard')}>Voltar</Button>
        </>
      )}
    </div>
  );
}

export default Pagamento;
