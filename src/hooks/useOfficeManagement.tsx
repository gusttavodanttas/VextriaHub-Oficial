import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Office, NovoOffice } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';

export const useOfficeManagement = () => {
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isSuperAdmin, user } = useAuth();

  const fetchOffices = async () => {
    try {
      setError(null);
      let query = supabase.from('offices').select(`
        *,
        office_users(id, role, user_id, active),
        subscriptions(id, plan, status, start_date, end_date)
      `);

      // Se não for super admin, buscar apenas o próprio escritório e apenas se estiver ativo
      if (!isSuperAdmin) {
        query = query
          .eq('office_users.user_id', user?.id)
          .eq('office_users.active', true)
          .eq('active', true);
      }

      const { data, error: fetchError } = await query
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('📊 [Office Query Error]:', fetchError);
        throw fetchError;
      }

      console.log('📊 [Office Data Loaded]:', data?.length || 0, 'registros');
      setOffices(data || []);
    } catch (err) {
      console.error('Error fetching offices:', err);
      setError('Erro ao carregar escritórios');
    } finally {
      setLoading(false);
    }
  };

  const createOffice = async (officeData: NovoOffice) => {
    if (!isSuperAdmin) {
      setError('Apenas super administradores podem criar escritórios');
      return null;
    }

    try {
      setError(null);
      const { data, error: createError } = await supabase
        .from('offices')
        .insert({
          ...officeData,
          created_by: user?.id
        })
        .select()
        .single();

      if (createError) throw createError;

      setOffices(prev => [data, ...prev]);
      return data;
    } catch (err) {
      console.error('Error creating office:', err);
      setError('Erro ao criar escritório');
      return null;
    }
  };

  const updateOffice = async (officeId: string, updates: Partial<Office>) => {
    try {
      setError(null);
      const { data, error: updateError } = await supabase
        .from('offices')
        .update(updates)
        .eq('id', officeId)
        .select()
        .single();

      if (updateError) throw updateError;

      setOffices(prev => prev.map(o => o.id === officeId ? data : o));
      return data;
    } catch (err) {
      console.error('Error updating office:', err);
      setError('Erro ao atualizar escritório');
      return null;
    }
  };

  const deactivateOffice = async (officeId: string) => {
    if (!isSuperAdmin) {
      setError('Apenas super administradores podem desativar escritórios');
      return false;
    }

    try {
      setError(null);
      const { error: updateError } = await supabase
        .from('offices')
        .update({ active: false })
        .eq('id', officeId);

      if (updateError) throw updateError;

      setOffices(prev => prev.filter(o => o.id !== officeId));
      return true;
    } catch (err) {
      console.error('Error deactivating office:', err);
      setError('Erro ao desativar escritório');
      return false;
    }
  };

  const getOfficeStats = async (officeId: string) => {
    try {
      setError(null);
      
      // Buscar estatísticas do escritório
      const [usersResult, subscriptionResult] = await Promise.all([
        supabase
          .from('office_users')
          .select('id, role')
          .eq('office_id', officeId)
          .eq('active', true),
        supabase
          .from('subscriptions')
          .select('plan, status')
          .eq('office_id', officeId)
          .eq('status', 'active')
          .single()
      ]);

      const users = usersResult.data || [];
      const subscription = subscriptionResult.data;

      return {
        totalUsers: users.length,
        adminUsers: users.filter(u => u.role === 'admin' || u.role === 'super_admin').length,
        regularUsers: users.filter(u => u.role === 'user').length,
        currentPlan: subscription?.plan || 'free',
        planStatus: subscription?.status || 'inactive'
      };
    } catch (err) {
      console.error('Error getting office stats:', err);
      return null;
    }
  };

  useEffect(() => {
    fetchOffices();
  }, [isSuperAdmin, user?.id]);

  return {
    offices,
    loading,
    error,
    refresh: fetchOffices,
    createOffice,
    updateOffice,
    deactivateOffice,
    getOfficeStats,
    isEmpty: offices.length === 0,
    canCreateOffices: isSuperAdmin
  };
};