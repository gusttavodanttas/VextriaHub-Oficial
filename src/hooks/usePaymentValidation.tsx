import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { evaluateAccess, type SubscriptionSnapshot } from '@/lib/billing';

export interface PaymentValidationResult {
  needsPayment: boolean;
  daysRegistered: number;
  hasActiveSubscription: boolean;
  paymentStatus: 'paid' | 'pending' | 'overdue' | 'canceled' | 'unknown' | 'trial';
  message?: string;
}

// Portão de acesso baseado no Asaas (por escritório). Lê office_subscriptions —
// a fonte-da-verdade escrita pelas edge functions asaas-billing/asaas-webhook —
// e delega a DECISÃO para evaluateAccess (src/lib/billing.ts), que é pura e testada.
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

      const targetOfficeId = officeId || profile?.office_id;

      // Busca a assinatura só quando há escritório e não é super admin (evita query à toa).
      let sub: SubscriptionSnapshot | null = null;
      if (targetOfficeId && profile?.role !== 'super_admin') {
        const { data } = await supabase
          .from('office_subscriptions')
          .select('status, trial_ends_at, is_lifetime')
          .eq('office_id', targetOfficeId)
          .maybeSingle();
        sub = (data as SubscriptionSnapshot | null) ?? null;
      }

      const decision = evaluateAccess({
        role: profile?.role,
        hasOffice: !!targetOfficeId,
        subscription: sub,
      });

      return {
        needsPayment: decision.needsPayment,
        daysRegistered: 0,
        hasActiveSubscription: decision.hasActiveSubscription,
        paymentStatus: decision.paymentStatus,
        message: decision.message,
      };
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
