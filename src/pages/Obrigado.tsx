import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, CreditCard, FileText, QrCode, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface CheckoutData {
  id: string;
  plan_name: string;
  plan_price_cents: number;
  status: string;
  trial_days: number;
}

function Obrigado() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [checkout, setCheckout] = useState<CheckoutData | null>(null);
  const [loading, setLoading] = useState(true);

  const checkoutId = searchParams.get('checkout');
  const billingType = searchParams.get('billing');

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
        navigate('/');
        return;
      }

      setCheckout(data as unknown as CheckoutData);
    } catch (error) {
      console.error('Error loading checkout:', error);
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(cents / 100);
  };

  const getBillingTypeInfo = (type: string | null) => {
    switch (type) {
      case 'PIX':
        return {
          icon: <QrCode className="h-6 w-6 text-green-600" />,
          title: 'PIX',
          description: 'Pagamento instantâneo',
          status: 'Aguardando confirmação automática'
        };
      case 'BOLETO':
        return {
          icon: <FileText className="h-6 w-6 text-blue-600" />,
          title: 'Boleto Bancário',
          description: 'Prazo para pagamento: até 3 dias úteis',
          status: 'Boleto gerado com sucesso'
        };
      case 'CREDIT_CARD':
        return {
          icon: <CreditCard className="h-6 w-6 text-purple-600" />,
          title: 'Cartão de Crédito',
          description: 'Pagamento processado',
          status: 'Aguardando confirmação'
        };
      default:
        return {
          icon: <CheckCircle className="h-6 w-6 text-green-600" />,
          title: 'Pagamento',
          description: 'Processando',
          status: 'Aguardando confirmação'
        };
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

  const billingInfo = getBillingTypeInfo(billingType);

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="space-y-6">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-green-600">Obrigado!</h1>
          <p className="text-muted-foreground mt-2">
            Seu pedido foi processado com sucesso
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Plano {checkout.plan_name}
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                {checkout.trial_days} dias grátis
              </Badge>
            </CardTitle>
            <CardDescription>
              Sua assinatura foi criada com sucesso
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="font-medium">Valor mensal:</span>
                <span className="text-lg font-semibold">{formatPrice(checkout.plan_price_cents)}</span>
              </div>
              
              <div className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
                {billingInfo.icon}
                <div>
                  <div className="font-medium">{billingInfo.title}</div>
                  <div className="text-sm text-muted-foreground">{billingInfo.description}</div>
                </div>
              </div>

              <div className="flex items-center space-x-2 text-sm">
                <Clock className="h-4 w-4" />
                <span>{billingInfo.status}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Próximos Passos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                  1
                </div>
                <div>
                  <div className="font-medium">Confirmação por email</div>
                  <div className="text-sm text-muted-foreground">
                    Você receberá um email de confirmação em alguns minutos
                  </div>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                  2
                </div>
                <div>
                  <div className="font-medium">Acesso liberado</div>
                  <div className="text-sm text-muted-foreground">
                    Após a confirmação do pagamento, seu acesso será liberado automaticamente
                  </div>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                  3
                </div>
                <div>
                  <div className="font-medium">Período de teste</div>
                  <div className="text-sm text-muted-foreground">
                    Aproveite seus {checkout.trial_days} dias grátis para explorar todas as funcionalidades
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col space-y-3">
          <Button
            onClick={() => navigate('/login')}
            size="lg"
            className="w-full"
          >
            Acessar Plataforma
          </Button>
          
          <Button
            variant="outline"
            onClick={() => navigate('/')}
            className="w-full"
          >
            Voltar ao Início
          </Button>
        </div>

        <div className="text-center text-sm text-muted-foreground">
          <p>
            Dúvidas? Entre em contato conosco através do email: contato@vextriahub.com.br
          </p>
        </div>
      </div>
    </div>
  );
}

export default Obrigado;
