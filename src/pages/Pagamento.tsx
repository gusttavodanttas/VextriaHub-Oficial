import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { CreditCard, FileText, QrCode, Loader2 } from 'lucide-react';

interface CheckoutData {
  id: string;
  plan_name: string;
  plan_price_cents: number;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  status: string;
  expires_at: string;
  billing_types: string[];
  trial_days: number;
}

function Pagamento() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [checkout, setCheckout] = useState<CheckoutData | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [selectedBillingType, setSelectedBillingType] = useState<string>('PIX');

  const checkoutId = searchParams.get('checkout');

  useEffect(() => {
    if (!checkoutId) {
      navigate('/');
      return;
    }

    loadCheckoutData();
  }, [checkoutId]);

  const loadCheckoutData = async () => {
    try {
      const { data, error } = await supabase
        .from('stripe_checkouts' as any)
        .select('*')
        .eq('id', checkoutId)
        .single();

      if (error || !data) {
        toast({
          title: "Erro",
          description: "Checkout não encontrado",
          variant: "destructive",
        });
        navigate('/');
        return;
      }

      // Check if checkout is expired
      if (new Date((data as any).expires_at) < new Date()) {
        toast({
          title: "Checkout Expirado",
          description: "Este link de pagamento expirou. Tente novamente.",
          variant: "destructive",
        });
        navigate('/');
        return;
      }

      setCheckout(data as unknown as CheckoutData);
    } catch (error) {
      console.error('Error loading checkout:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados do pagamento",
        variant: "destructive",
      });
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const processPayment = async () => {
    if (!checkout) return;

    setProcessingPayment(true);
    try {
      toast({
        title: "Processando Pagamento",
        description: "Criando sessão de checkout no Stripe...",
      });

      // Prepare payment data
      const paymentData: any = {
        checkoutId: checkout.id,
        billingType: selectedBillingType,
      };

      // Add credit card data if selected
      if (selectedBillingType === 'CREDIT_CARD') {
        // For demonstration, we'll use mock data
        // In a real app, you'd collect this from a secure form
        paymentData.creditCardData = {
          holderName: "João Silva",
          number: "5162306219378829",
          expiryMonth: "12",
          expiryYear: "2028",
          ccv: "318"
        };
        paymentData.creditCardHolderInfo = {
          name: "João Silva",
          email: "joao@email.com",
          cpfCnpj: "11111111111",
          postalCode: "89223-005",
          addressNumber: "277",
          phone: "4738010919"
        };
      }

      // Call payment processing edge function
      const { data: paymentResult, error: paymentError } = await supabase.functions.invoke(
        'process-payment',
        {
          body: paymentData
        }
      );

      if (paymentError || !paymentResult?.success) {
        console.error('Payment error:', paymentError);
        throw new Error(paymentResult?.error || 'Erro ao processar pagamento');
      }

      // Handle different payment types
      if (selectedBillingType === 'PIX') {
        toast({
          title: "PIX Gerado!",
          description: "Escaneie o QR Code ou copie o código PIX para pagar",
        });
        
        // Store PIX data for display
        localStorage.setItem('pixData', JSON.stringify({
          pixCode: paymentResult.pixCode,
          pixQrCodeImage: paymentResult.pixQrCodeImage,
          value: paymentResult.value,
          dueDate: paymentResult.dueDate,
        }));

      } else if (selectedBillingType === 'BOLETO') {
        toast({
          title: "Boleto Gerado!",
          description: "Clique no link para imprimir ou visualizar",
        });
        
        // Open boleto in new tab
        if (paymentResult.bankSlipUrl) {
          window.open(paymentResult.bankSlipUrl, '_blank');
        }

      } else if (selectedBillingType === 'CREDIT_CARD') {
        toast({
          title: "Pagamento Processado!",
          description: "Aguardando confirmação do cartão...",
        });
      }

      // Redirect to thank you page
      navigate(`/obrigado?checkout=${checkout.id}&billing=${selectedBillingType}&payment=${paymentResult.paymentId}`);

    } catch (error) {
      console.error('Error processing payment:', error);
      toast({
        title: "Erro no Pagamento",
        description: error instanceof Error ? error.message : "Erro ao processar pagamento. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setProcessingPayment(false);
    }
  };

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(cents / 100);
  };

  const getBillingTypeIcon = (type: string) => {
    switch (type) {
      case 'PIX':
        return <QrCode className="h-5 w-5" />;
      case 'BOLETO':
        return <FileText className="h-5 w-5" />;
      case 'CREDIT_CARD':
        return <CreditCard className="h-5 w-5" />;
      default:
        return null;
    }
  };

  const getBillingTypeLabel = (type: string) => {
    switch (type) {
      case 'PIX':
        return 'PIX (Instantâneo)';
      case 'BOLETO':
        return 'Boleto Bancário';
      case 'CREDIT_CARD':
        return 'Cartão de Crédito';
      default:
        return type;
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 flex items-center justify-center min-h-screen">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Carregando...</span>
        </div>
      </div>
    );
  }

  if (!checkout) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Finalizar Pagamento</h1>
          <p className="text-muted-foreground mt-2">
            Escolha a forma de pagamento para ativar sua assinatura
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Plano {checkout.plan_name}
              <Badge variant="secondary">
                {checkout.trial_days} dias grátis
              </Badge>
            </CardTitle>
            <CardDescription>
              Assinatura mensal - Cobrança recorrente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center text-lg font-semibold">
              <span>Total:</span>
              <span className="text-primary">{formatPrice(checkout.plan_price_cents)}/mês</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Forma de Pagamento</CardTitle>
            <CardDescription>
              Escolha como deseja pagar sua assinatura
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {checkout.billing_types.map((type) => (
              <div
                key={type}
                className={`flex items-center space-x-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                  selectedBillingType === type
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
                onClick={() => setSelectedBillingType(type)}
              >
                <input
                  type="radio"
                  name="billingType"
                  value={type}
                  checked={selectedBillingType === type}
                  onChange={(e) => setSelectedBillingType(e.target.value)}
                  className="text-primary"
                />
                {getBillingTypeIcon(type)}
                <span className="font-medium">{getBillingTypeLabel(type)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Separator />

        <div className="flex flex-col space-y-3">
          <Button
            onClick={processPayment}
            disabled={processingPayment}
            size="lg"
            className="w-full"
          >
            {processingPayment ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              `Pagar ${formatPrice(checkout.plan_price_cents)}`
            )}
          </Button>
          
          <Button
            variant="outline"
            onClick={() => navigate('/')}
            className="w-full"
          >
            Cancelar
          </Button>
        </div>

        <div className="text-center text-sm text-muted-foreground">
          <p>
            Ao continuar, você aceita nossos termos de serviço e política de privacidade.
          </p>
          <p className="mt-1">
            Você pode cancelar sua assinatura a qualquer momento.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Pagamento;
