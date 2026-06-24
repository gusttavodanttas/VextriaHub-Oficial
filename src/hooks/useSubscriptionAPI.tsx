import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface SubscriptionData {
  id: string;
  user_id: string;
  office_id: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  stripe_payment_intent_id?: string;
  payment_status: 'paid' | 'pending' | 'overdue' | 'canceled' | 'unknown';
  access_status: 'active' | 'suspended' | 'blocked';
  plan_type: 'trial' | 'basico' | 'intermediario' | 'avancado' | 'premium';
  monthly_fee: number;
  due_date?: string;
  paid_date?: string;
  days_overdue: number;
  manual_override: boolean;
  override_reason?: string;
  override_by?: string;
  created_at: string;
  updated_at: string;
  profiles?: {
    id: string;
    email: string;
    full_name: string;
    created_at: string;
  };
  offices?: {
    id: string;
    name: string;
    created_at: string;
  };
}

export interface SubscriptionStats {
  total_users: number;
  active_users: number;
  blocked_users: number;
  suspended_users: number;
  paid_users: number;
  overdue_users: number;
  pending_users: number;
  total_revenue: number;
  paid_revenue: number;
  users_at_risk: number;
  max_overdue_days: number;
}

export interface OverrideAction {
  user_id: string;
  action: 'block' | 'unblock' | 'activate' | 'suspend';
  reason: string;
  access_status?: 'active' | 'blocked' | 'suspended';
  payment_status?: 'paid' | 'pending' | 'overdue' | 'canceled';
  extend_days?: number;
}

export function useSubscriptionAPI() {
  const [subscriptions, setSubscriptions] = useState<SubscriptionData[]>([]);
  const [stats, setStats] = useState<SubscriptionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { user } = useAuth();

  // Função para fazer chamadas às Edge Functions
  const callEdgeFunction = useCallback(async (functionName: string, options: any = {}) => {
    try {
      const { data, error } = await supabase.functions.invoke(functionName, {
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        ...options
      });

      if (error) {
        throw error;
      }

      return data;
    } catch (err: any) {
      console.error(`Error calling ${functionName}:`, err);
      throw new Error(err.message || `Error calling ${functionName}`);
    }
  }, []);

  // Buscar dados de assinaturas
  const fetchSubscriptions = useCallback(async (filters: any = {}) => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: filters.page || '1',
        limit: filters.limit || '50',
        ...(filters.status && { status: filters.status }),
        ...(filters.access_status && { access_status: filters.access_status }),
        ...(filters.search && { search: filters.search }),
        sort_by: filters.sort_by || 'updated_at',
        sort_order: filters.sort_order || 'desc'
      });

      const response = await callEdgeFunction('subscription-status', {
        method: 'GET'
      });

      if (response.success) {
        setSubscriptions(response.data || []);
        setStats(response.stats || null);
      } else {
        throw new Error(response.error || 'Failed to fetch subscriptions');
      }

    } catch (err: any) {
      console.error('Error fetching subscriptions:', err);
      setError(err.message || 'Erro ao carregar dados de assinaturas');
      setSubscriptions([]);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [user, callEdgeFunction]);

  // Executar override manual
  const executeOverride = useCallback(async (overrideData: OverrideAction) => {
    try {
      const response = await callEdgeFunction('manual-override', {
        method: 'POST',
        body: JSON.stringify(overrideData)
      });

      if (response.success) {
        // Recarregar dados após override
        await fetchSubscriptions();
        return response;
      } else {
        throw new Error(response.error || 'Failed to execute override');
      }

    } catch (err: any) {
      console.error('Error executing override:', err);
      throw new Error(err.message || 'Erro ao executar alteração manual');
    }
  }, [callEdgeFunction, fetchSubscriptions]);

  // Buscar logs de override
  const fetchOverrideLogs = useCallback(async (userId?: string, page: number = 1) => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(userId && { user_id: userId })
      });

      const response = await callEdgeFunction('manual-override', {
        method: 'GET'
      });

      if (response.success) {
        return response.data || [];
      } else {
        throw new Error(response.error || 'Failed to fetch override logs');
      }

    } catch (err: any) {
      console.error('Error fetching override logs:', err);
      throw new Error(err.message || 'Erro ao carregar logs de alterações');
    }
  }, [callEdgeFunction]);

  // Filtrar dados localmente
  const filterSubscriptions = useCallback((filters: any) => {
    let filtered = subscriptions;

    if (filters.search) {
      const search = filters.search.toLowerCase();
      filtered = filtered.filter(sub => 
        sub.profiles?.full_name?.toLowerCase().includes(search) ||
        sub.profiles?.email?.toLowerCase().includes(search) ||
        sub.offices?.name?.toLowerCase().includes(search)
      );
    }

    if (filters.payment_status) {
      filtered = filtered.filter(sub => sub.payment_status === filters.payment_status);
    }

    if (filters.access_status) {
      filtered = filtered.filter(sub => sub.access_status === filters.access_status);
    }

    return filtered;
  }, [subscriptions]);

  // Carregar dados iniciais
  useEffect(() => {
    if (user) {
      fetchSubscriptions();
    }
  }, [user, fetchSubscriptions]);

  // Função para recarregar dados
  const refetch = useCallback(() => {
    return fetchSubscriptions();
  }, [fetchSubscriptions]);

  // Funções de conveniência para ações específicas
  const blockUser = useCallback(async (userId: string, reason: string) => {
    return executeOverride({
      user_id: userId,
      action: 'block',
      reason,
      access_status: 'blocked'
    });
  }, [executeOverride]);

  const unblockUser = useCallback(async (userId: string, reason: string, extendDays?: number) => {
    return executeOverride({
      user_id: userId,
      action: 'unblock',
      reason,
      access_status: 'active',
      payment_status: 'paid',
      extend_days: extendDays
    });
  }, [executeOverride]);

  const suspendUser = useCallback(async (userId: string, reason: string) => {
    return executeOverride({
      user_id: userId,
      action: 'suspend',
      reason,
      access_status: 'suspended'
    });
  }, [executeOverride]);

  const activateUser = useCallback(async (userId: string, reason: string, extendDays?: number) => {
    return executeOverride({
      user_id: userId,
      action: 'activate',
      reason,
      access_status: 'active',
      payment_status: 'paid',
      extend_days: extendDays
    });
  }, [executeOverride]);

  return {
    // Dados
    subscriptions,
    stats,
    loading,
    error,
    
    // Funções
    fetchSubscriptions,
    refetch,
    filterSubscriptions,
    
    // Override functions
    executeOverride,
    blockUser,
    unblockUser,
    suspendUser,
    activateUser,
    fetchOverrideLogs,
    
    // Utilitários
    isEmpty: subscriptions.length === 0,
    isError: !!error,
    hasStats: !!stats
  };
}