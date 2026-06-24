
import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useStripe } from './useStripe';

export interface PaymentValidationResult {
  needsPayment: boolean;
  daysRegistered: number;
  hasActiveSubscription: boolean;
  paymentStatus: 'paid' | 'pending' | 'overdue' | 'canceled' | 'unknown' | 'trial';
  message?: string;
}

export const usePaymentValidation = () => {
  const [loading, setLoading] = useState(false);
  const { checkSubscription } = useStripe();

  const validatePayment = useCallback(async (userId: string, officeId?: string | null): Promise<PaymentValidationResult> => {
    if (!userId) {
      return {
        needsPayment: false,
        daysRegistered: 0,
        hasActiveSubscription: false,
        paymentStatus: 'unknown',
        message: 'Usuário não encontrado'
      };
    }

    setLoading(true);
    try {
      // Buscar dados do perfil do usuário
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('created_at, role, office_id')
        .eq('user_id', userId)
        .single();

      if (profileError || !profile) {
        return {
          needsPayment: false,
          daysRegistered: 0,
          hasActiveSubscription: false,
          paymentStatus: 'unknown',
          message: 'Erro ao verificar dados do usuário'
        };
      }

      // 1. Super Admin is always paid
      if (profile.role === 'super_admin') {
        return {
          needsPayment: false,
          daysRegistered: 0,
          hasActiveSubscription: true,
          paymentStatus: 'paid',
          message: 'Super admin - acesso liberado'
        };
      }

      // 2. Calculate days since registration
      const createdAt = new Date(profile.created_at);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - createdAt.getTime());
      const daysRegistered = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // 3. Check for Lifetime status
      const targetOfficeId = officeId || profile.office_id;
      if (targetOfficeId) {
        const { data: officeData } = await supabase
          .from('offices')
          .select('is_lifetime')
          .eq('id', targetOfficeId)
          .maybeSingle();

        if (officeData?.is_lifetime) {
          return {
            needsPayment: false,
            daysRegistered,
            hasActiveSubscription: true,
            paymentStatus: 'paid',
            message: 'Acesso Vitalício Ativado'
          };
        }
      }

      // 4. Trial period (7 days)
      const trialDays = 7;
      const isTrialActive = daysRegistered <= trialDays;

      // 5. Check Stripe Subscription
      try {
        const stripeSubscription = await checkSubscription();
        if (stripeSubscription.subscribed) {
          return {
            needsPayment: false,
            daysRegistered,
            hasActiveSubscription: true,
            paymentStatus: 'paid',
            message: 'Assinatura ativa'
          };
        }
      } catch (error) {
        console.error('Erro Stripe validation:', error);
      }

      // 6. Trial fallback
      if (isTrialActive) {
        return {
          needsPayment: false,
          daysRegistered,
          hasActiveSubscription: true,
          paymentStatus: 'trial',
          message: `Período de teste: ${trialDays - daysRegistered} dias restantes`
        };
      }

      // 7. Expired
      return {
        needsPayment: true,
        daysRegistered,
        hasActiveSubscription: false,
        paymentStatus: 'overdue',
        message: 'Período de teste expirado. Realize o pagamento.'
      };

    } catch (error) {
      console.error('Erro na validação de pagamento:', error);
      return {
        needsPayment: false,
        daysRegistered: 0,
        hasActiveSubscription: false,
        paymentStatus: 'unknown',
        message: 'Erro ao validar status de pagamento'
      };
    } finally {
      setLoading(false);
    }
  }, [checkSubscription]);

  return { validatePayment, loading };
};