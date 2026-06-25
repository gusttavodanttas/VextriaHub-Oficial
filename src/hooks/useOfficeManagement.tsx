import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Office, NovoOffice } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';

export const useOfficeManagement = () => {
  const { isSuperAdmin, user } = useAuth();
  const queryClient = useQueryClient();

  const { data: offices = [], isLoading: loading, error: queryError } = useQuery({
    queryKey: ['offices', isSuperAdmin, user?.id],
    queryFn: async () => {
      let query = supabase.from('offices').select(`
        *,
        office_users(id, role, user_id, active),
        subscriptions(id, plan, status, start_date, end_date)
      `);

      if (!isSuperAdmin) {
        query = query
          .eq('office_users.user_id', user?.id)
          .eq('office_users.active', true)
          .eq('active', true);
      }

      const { data, error: fetchError } = await query.order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      return data || [];
    },
    enabled: true,
  });

  const error = queryError ? 'Erro ao carregar escritórios' : null;

  const createOfficeMutation = useMutation({
    mutationFn: async (officeData: NovoOffice) => {
      if (!isSuperAdmin) throw new Error('Apenas super administradores podem criar escritórios');
      const { data, error: createError } = await supabase
        .from('offices')
        .insert({ ...officeData, created_by: user?.id })
        .select()
        .single();
      if (createError) throw createError;
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['offices', isSuperAdmin, user?.id], (old: Record<string, any>[] = []) => [data, ...old]);
    },
  });

  const updateOfficeMutation = useMutation({
    mutationFn: async ({ officeId, updates }: { officeId: string; updates: Partial<Office> }) => {
      const { data, error: updateError } = await supabase
        .from('offices')
        .update(updates)
        .eq('id', officeId)
        .select()
        .single();
      if (updateError) throw updateError;
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['offices', isSuperAdmin, user?.id], (old: Record<string, any>[] = []) => 
        old.map(o => o.id === data.id ? data : o)
      );
    },
  });

  const deactivateOfficeMutation = useMutation({
    mutationFn: async (officeId: string) => {
      if (!isSuperAdmin) throw new Error('Apenas super administradores podem desativar escritórios');
      const { error: updateError } = await supabase
        .from('offices')
        .update({ active: false })
        .eq('id', officeId);
      if (updateError) throw updateError;
      return true;
    },
    onSuccess: (_, officeId) => {
      queryClient.setQueryData(['offices', isSuperAdmin, user?.id], (old: Record<string, any>[] = []) => 
        old.filter(o => o.id !== officeId)
      );
    },
  });

  const getOfficeStats = async (officeId: string) => {
    try {
      const [usersResult, subscriptionResult] = await Promise.all([
        supabase.from('office_users').select('id, role').eq('office_id', officeId).eq('active', true),
        supabase.from('subscriptions').select('plan, status').eq('office_id', officeId).eq('status', 'active').single()
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

  return {
    offices,
    loading,
    error,
    refresh: () => queryClient.invalidateQueries({ queryKey: ['offices', isSuperAdmin, user?.id] }),
    createOffice: createOfficeMutation.mutateAsync,
    updateOffice: (officeId: string, updates: Partial<Office>) => updateOfficeMutation.mutateAsync({ officeId, updates }),
    deactivateOffice: deactivateOfficeMutation.mutateAsync,
    getOfficeStats,
    isEmpty: offices.length === 0,
    canCreateOffices: isSuperAdmin
  };
};