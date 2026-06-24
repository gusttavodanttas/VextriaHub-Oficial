import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, CreditCard, Clock, CheckCircle } from 'lucide-react';
import { PaymentValidationResult } from '@/hooks/usePaymentValidation';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface PaymentRequiredModalProps {
  open: boolean;
  onClose: () => void;
  validationResult: PaymentValidationResult;
  onProceedToPayment: () => void;
  onLogout: () => void;
}

export const PaymentRequiredModal = () => {
  const { paymentValidation, showPaymentModal, setShowPaymentModal, logout } = useAuth();

  const handlePayment = () => {
    // Aqui você pode implementar a lógica de redirecionamento para pagamento
    console.log('Redirecionando para pagamento...');
    toast.success('Redirecionando para o sistema de pagamento...');
  };

  const handleLogout = () => {
    setShowPaymentModal(false);
    logout();
  };

  if (!showPaymentModal || !paymentValidation || !paymentValidation.needsPayment) {
    return null;
  }

  const getStatusIcon = () => {
    if (!paymentValidation?.paymentStatus) {
      return <CreditCard className="h-8 w-8 text-blue-500" />;
    }
    switch (paymentValidation.paymentStatus) {
      case 'overdue':
        return <AlertTriangle className="h-8 w-8 text-red-500" />;
      case 'pending':
        return <Clock className="h-8 w-8 text-yellow-500" />;
      case 'paid':
        return <CheckCircle className="h-8 w-8 text-green-500" />;
      default:
        return <CreditCard className="h-8 w-8 text-blue-500" />;
    }
  };

  const getStatusColor = () => {
    if (!paymentValidation?.paymentStatus) {
      return 'border-blue-200 bg-blue-50';
    }
    switch (paymentValidation.paymentStatus) {
      case 'overdue':
        return 'border-red-200 bg-red-50';
      case 'pending':
        return 'border-yellow-200 bg-yellow-50';
      case 'paid':
        return 'border-green-200 bg-green-50';
      default:
        return 'border-blue-200 bg-blue-50';
    }
  };

  const getTitle = () => {
    if (!paymentValidation?.paymentStatus) {
      return 'Pagamento Necessário';
    }
    switch (paymentValidation.paymentStatus) {
      case 'overdue':
        return 'Pagamento em Atraso';
      case 'pending':
        return 'Pagamento Pendente';
      default:
        return 'Pagamento Necessário';
    }
  };

  return (
    <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getStatusIcon()}
            {getTitle()}
          </DialogTitle>
          <DialogDescription>
            Para continuar usando o sistema, é necessário regularizar sua situação de pagamento.
          </DialogDescription>
        </DialogHeader>

        <Card className={`${getStatusColor()} border-2`}>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Status da Conta</CardTitle>
            <CardDescription>
              Você está cadastrado há {paymentValidation?.daysRegistered || 0} dias
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Status do Pagamento:</span>
                <span className="font-medium capitalize">
                  {!paymentValidation?.paymentStatus || paymentValidation.paymentStatus === 'unknown' ? 'Não encontrado' : paymentValidation.paymentStatus}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Assinatura Ativa:</span>
                <span className="font-medium">
                  {paymentValidation?.hasActiveSubscription ? 'Sim' : 'Não'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Dias Cadastrado:</span>
                <span className="font-medium">{paymentValidation?.daysRegistered || 0}</span>
              </div>
            </div>

            {paymentValidation?.message && (
              <div className="p-3 rounded-md bg-background/50 border">
                <p className="text-sm text-muted-foreground">
                  {paymentValidation?.message}
                </p>
              </div>
            )}

            <div className="space-y-2 pt-2">
              <Button 
                onClick={handlePayment} 
                className="w-full"
                size="lg"
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Realizar Pagamento
              </Button>
              
              <Button 
                onClick={handleLogout} 
                variant="outline" 
                className="w-full"
                size="lg"
              >
                Sair do Sistema
              </Button>
            </div>

            <div className="text-xs text-muted-foreground text-center pt-2">
              <p>
                Dúvidas? Entre em contato conosco em{' '}
                <a 
                  href="mailto:contato@vextriahub.com.br" 
                  className="text-primary hover:underline"
                >
                  contato@vextriahub.com.br
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
};