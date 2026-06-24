import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Subscription, NovaSubscription } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';

export const useSubscriptions = () => {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { office, isSuperAdmin } = useAuth();

  const fetchSubscriptions = async () => {
    try {
      setError(null);
      let query = supabase.from('subscriptions').select(`
        *,
        office:offices(name, email)
      `);

      // Se não for super admin, filtrar apenas pelo escritório
      if (!isSuperAdmin && office?.id) {
        query = query.eq('office_id', office.id);
      }

      const { data, error: fetchError } = await query
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setSubscriptions(data || []);
    } catch (err) {
      console.error('Error fetching subscriptions:', err);
      setError('Erro ao carregar assinaturas');
    } finally {
      setLoading(false);
    }
  };

  const createSubscription = async (subscriptionData: NovaSubscription) => {
    try {
      setError(null);
      const { data, error: createError } = await supabase
        .from('subscriptions')
        .insert(subscriptionData)
        .select(`
          *,
          office:offices(name, email)
        `)
        .single();

      if (createError) throw createError;

      setSubscriptions(prev => [data, ...prev]);
      return data;
    } catch (err) {
      console.error('Error creating subscription:', err);
      setError('Erro ao criar assinatura');
      return null;
    }
  };

  const updateSubscription = async (subscriptionId: string, updates: Partial<Subscription>) => {
    try {
      setError(null);
      const { data, error: updateError } = await supabase
        .from('subscriptions')
        .update(updates)
        .eq('id', subscriptionId)
        .select(`
          *,
          office:offices(name, email)
        `)
        .single();

      if (updateError) throw updateError;

      setSubscriptions(prev => prev.map(s => s.id === subscriptionId ? data : s));
      return data;
    } catch (err) {
      console.error('Error updating subscription:', err);
      setError('Erro ao atualizar assinatura');
      return null;
    }
  };

  const cancelSubscription = async (subscriptionId: string) => {
    try {
      setError(null);
      const { data, error: updateError } = await supabase
        .from('subscriptions')
        .update({ 
          status: 'cancelled',
          end_date: new Date().toISOString().split('T')[0]
        })
        .eq('id', subscriptionId)
        .select(`
          *,
          office:offices(name, email)
        `)
        .single();

      if (updateError) throw updateError;

      setSubscriptions(prev => prev.map(s => s.id === subscriptionId ? data : s));
      return data;
    } catch (err) {
      console.error('Error canceling subscription:', err);
      setError('Erro ao cancelar assinatura');
      return null;
    }
  };

  const reactivateSubscription = async (subscriptionId: string) => {
    try {
      setError(null);
      const { data, error: updateError } = await supabase
        .from('subscriptions')
        .update({ 
          status: 'active',
          end_date: null
        })
        .eq('id', subscriptionId)
        .select(`
          *,
          office:offices(name, email)
        `)
        .single();

      if (updateError) throw updateError;

      setSubscriptions(prev => prev.map(s => s.id === subscriptionId ? data : s));
      return data;
    } catch (err) {
      console.error('Error reactivating subscription:', err);
      setError('Erro ao reativar assinatura');
      return null;
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
    createSubscription,
    updateSubscription,
    cancelSubscription,
    reactivateSubscription,
    isEmpty: subscriptions.length === 0,
    // Filtros úteis
    activeSubscriptions: subscriptions.filter(s => s.status === 'active'),
    cancelledSubscriptions: subscriptions.filter(s => s.status === 'cancelled'),
    expiredSubscriptions: subscriptions.filter(s => s.status === 'inactive'),
    // Assinatura atual do escritório
    currentSubscription: office?.id ? subscriptions.find(s => s.office_id === office.id && s.status === 'active') : null
  };
};