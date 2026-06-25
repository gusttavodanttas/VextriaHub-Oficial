import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { OfficeUser, NovoOfficeUser } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';

const enrichWithProfiles = async (officeUsers: Record<string, any>[]): Promise<Record<string, any>[]> => {
  if (!officeUsers.length) return officeUsers;
  const userIds = officeUsers.map(u => u.user_id).filter(Boolean);
  if (!userIds.length) return officeUsers;
  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, full_name, email')
    .in('user_id', userIds);
  const profileMap: Record<string, { full_name: string | null; email: string | null }> = {};
  (profiles || []).forEach(p => { profileMap[p.user_id] = { full_name: p.full_name, email: p.email }; });
  return officeUsers.map(u => ({ ...u, profile: profileMap[u.user_id] || null }));
};

export const useOfficeUsers = () => {
  const { office } = useAuth();
  const queryClient = useQueryClient();

  const { data: users = [], isLoading: loading, error: queryError } = useQuery({
    queryKey: ['office_users', office?.id],
    queryFn: async () => {
      if (!office?.id) return [];
      const { data, error: fetchError } = await supabase
        .from('office_users')
        .select('*')
        .eq('office_id', office.id)
        .eq('active', true)
        .order('joined_at', { ascending: false });
      if (fetchError) throw fetchError;
      return await enrichWithProfiles(data || []);
    },
    enabled: !!office?.id,
  });

  const error = queryError ? 'Erro ao carregar usuários do escritório' : null;

  const addUserMutation = useMutation({
    mutationFn: async (userData: NovoOfficeUser) => {
      if (!office?.id) return null;
      const { data, error: addError } = await supabase
        .from('office_users')
        .insert({ ...userData, office_id: office.id })
        .select('*')
        .single();
      if (addError) throw addError;
      const [enriched] = await enrichWithProfiles([data]);
      return enriched;
    },
    onSuccess: (enriched) => {
      if (enriched) {
        queryClient.setQueryData(['office_users', office?.id], (old: Record<string, any>[] = []) => [enriched, ...old]);
      }
    },
    onError: () => { /* error handled in component */ }
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, updates }: { userId: string; updates: Partial<OfficeUser> }) => {
      const { data, error: updateError } = await supabase
        .from('office_users')
        .update(updates)
        .eq('id', userId)
        .select('*')
        .single();
      if (updateError) throw updateError;
      const [enriched] = await enrichWithProfiles([data]);
      return enriched;
    },
    onSuccess: (enriched) => {
      if (enriched) {
        queryClient.setQueryData(['office_users', office?.id], (old: Record<string, any>[] = []) => 
          old.map(u => u.id === enriched.id ? enriched : u)
        );
      }
    },
    onError: () => { /* error handled in component */ }
  });

  const removeUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error: removeError } = await supabase
        .from('office_users')
        .update({ active: false })
        .eq('id', userId);
      if (removeError) throw removeError;
      return true;
    },
    onSuccess: (_, userId) => {
      queryClient.setQueryData(['office_users', office?.id], (old: Record<string, any>[] = []) => 
        old.filter(u => u.id !== userId)
      );
    },
    onError: () => { /* error handled in component */ }
  });

  return {
    users,
    loading,
    error,
    refresh: () => queryClient.invalidateQueries({ queryKey: ['office_users', office?.id] }),
    addUser: addUserMutation.mutateAsync,
    updateUser: (userId: string, updates: Partial<OfficeUser>) => updateUserMutation.mutateAsync({ userId, updates }),
    removeUser: removeUserMutation.mutateAsync,
    isEmpty: users.length === 0
  };
};
