import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// Lê a cobrança do Asaas (office_subscriptions) e mapeia para a forma que as
// métricas/telas usam. Substitui a leitura da antiga tabela Stripe `subscriptions`.
// 'ativa' -> 'active'; value -> price. (cortesia = acesso grátis, não conta como paga.)
const mapStatus = (s: string): string =>
  (({ ativa: 'active', atrasada: 'past_due', cancelada: 'cancelled', pendente: 'pending', trial: 'trialing', cortesia: 'courtesy' }) as Record<string, string>)[s] || s;

export interface OfficeSub {
  office_id: string;
  status: string;
  price: number;
  plan: string | null;
  next_due_date: string | null;
  office?: { name: string | null; email: string | null } | null;
}

export const useSubscriptions = () => {
  const [subscriptions, setSubscriptions] = useState<OfficeSub[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { office, isSuperAdmin } = useAuth();

  const fetchSubscriptions = async () => {
    try {
      setError(null);
      let query = supabase.from('office_subscriptions').select('*, office:offices(name, email)');
      if (!isSuperAdmin && office?.id) query = query.eq('office_id', office.id);
      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      const rows: OfficeSub[] = ((data as unknown as Record<string, unknown>[]) || []).map((r) => ({
        office_id: String(r.office_id),
        status: mapStatus(String(r.status)),
        price: Number(r.value || 0),
        plan: (r.plan_name as string) ?? null,
        next_due_date: (r.next_due_date as string) ?? null,
        office: (r.office as { name: string | null; email: string | null }) ?? null,
      }));
      setSubscriptions(rows);
    } catch (err) {
      console.error('Error fetching subscriptions:', err);
      setError('Erro ao carregar assinaturas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptions();
  }, [office?.id, isSuperAdmin]);

  return {
    subscriptions,
    loading,
    error,
    refresh: fetchSubscriptions,
    isEmpty: subscriptions.length === 0,
    activeSubscriptions: subscriptions.filter(s => s.status === 'active'),
    currentSubscription: office?.id ? subscriptions.find(s => s.office_id === office.id && s.status === 'active') : null,
  };
};
