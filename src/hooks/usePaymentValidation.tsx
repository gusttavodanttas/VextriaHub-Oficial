import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PaymentValidationResult {
  needsPayment: boolean;
  daysRegistered: number;
  hasActiveSubscription: boolean;
  paymentStatus: 'paid' | 'pending' | 'overdue' | 'canceled' | 'unknown' | 'trial';
  message?: string;
}

// Portão de acesso baseado no Asaas (por escritório). Lê office_subscriptions —
// a fonte-da-verdade escrita pelas edge functions asaas-billing/asaas-webhook.
export const usePaymentValidation = () => {
  const [loading, setLoading] = useState(false);

  const validatePayment = useCallback(async (userId: string, officeId?: string | null): Promise<PaymentValidationResult> => {
    if (!userId) {
      return { needsPayment: false, daysRegistered: 0, hasActiveSubscription: false, paymentStatus: 'unknown', message: 'Usuário não encontrado' };
    }

    setLoading(true);
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, office_id')
        .eq('user_id', userId)
        .maybeSingle();

      // Super admin sempre liberado
      if (profile?.role === 'super_admin') {
        return { needsPayment: false, daysRegistered: 0, hasActiveSubscription: true, paymentStatus: 'paid', message: 'Super admin' };
      }

      const targetOfficeId = officeId || profile?.office_id;
      if (!targetOfficeId) {
        // Sem escritório ainda (ex.: acabou de cadastrar) → não bloqueia.
        return { needsPayment: false, daysRegistered: 0, hasActiveSubscription: false, paymentStatus: 'unknown' };
      }

      const { data: sub } = await supabase
        .from('office_subscriptions')
        .select('status, trial_ends_at, is_lifetime, next_due_date')
        .eq('office_id', targetOfficeId)
        .maybeSingle();

      // Sem linha ainda (o trigger cria no login) → não bloqueia.
      if (!sub) {
        return { needsPayment: false, daysRegistered: 0, hasActiveSubscription: true, paymentStatus: 'trial', message: 'Período de teste' };
      }

      const today = new Date(); today.setHours(0, 0, 0, 0);
      const trialEnds = sub.trial_ends_at ? new Date(sub.trial_ends_at + 'T00:00:00') : null;
      // Espelha office_has_access (servidor): o teste vale para 'trial' E 'pendente' (ex.: boleto
      // gerado no meio do trial) e exige data futura — evita expulsar do app quem está convertendo.
      const trialActive = !!trialEnds && trialEnds >= today && (sub.status === 'trial' || sub.status === 'pendente');
      const daysLeft = trialEnds ? Math.max(0, Math.ceil((trialEnds.getTime() - today.getTime()) / 86400000)) : 0;
      const paidAccess = sub.is_lifetime || sub.status === 'ativa' || sub.status === 'cortesia';

      if (paidAccess || trialActive) {
        return {
          needsPayment: false,
          daysRegistered: 0,
          hasActiveSubscription: true,
          paymentStatus: paidAccess ? 'paid' : 'trial',
          message: trialActive ? `Período de teste: ${daysLeft} dia(s) restante(s)` : undefined,
        };
      }

      // Sem acesso → bloquear.
      const paymentStatus: PaymentValidationResult['paymentStatus'] =
        sub.status === 'atrasada' ? 'overdue' : sub.status === 'cancelada' ? 'canceled' : 'pending';
      const message =
        sub.status === 'atrasada' ? 'Pagamento em atraso. Regularize para continuar.' :
        sub.status === 'cancelada' ? 'Assinatura cancelada.' :
        sub.status === 'trial' ? 'Período de teste expirado. Assine para continuar.' :
        'Assinatura pendente. Conclua o pagamento para continuar.';
      return { needsPayment: true, daysRegistered: 0, hasActiveSubscription: false, paymentStatus, message };
    } catch (error) {
      console.error('Erro na validação de pagamento:', error);
      // Fail-open: erro transitório não bloqueia o usuário.
      return { needsPayment: false, daysRegistered: 0, hasActiveSubscription: false, paymentStatus: 'unknown', message: 'Erro ao validar status de pagamento' };
    } finally {
      setLoading(false);
    }
  }, []);

  return { validatePayment, loading };
};
