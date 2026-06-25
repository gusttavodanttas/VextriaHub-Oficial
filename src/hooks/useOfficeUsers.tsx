import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { OfficeUser, NovoOfficeUser } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';

interface Profile {
  user_id: string;
  full_name: string | null;
  email: string | null;
}

type OfficeUserWithProfile = OfficeUser & { profile: Profile | null };

// office_users e profiles não têm FK direta — enriquecemos com uma segunda query em batch
const enrichWithProfiles = async (officeUsers: OfficeUser[]): Promise<OfficeUserWithProfile[]> => {
  if (!officeUsers.length) return officeUsers.map(u => ({ ...u, profile: null }));
  const userIds = officeUsers.map(u => u.user_id).filter(Boolean) as string[];
  if (!userIds.length) return officeUsers.map(u => ({ ...u, profile: null }));

  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, full_name, email')
    .in('user_id', userIds);

  const profileMap: Record<string, Profile> = {};
  (profiles || []).forEach(p => { profileMap[p.user_id] = p; });

  return officeUsers.map(u => ({ ...u, profile: profileMap[u.user_id] || null }));
};

export const useOfficeUsers = () => {
  const [users, setUsers] = useState<OfficeUserWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { office } = useAuth();

  const fetchUsers = async () => {
    if (!office?.id) {
      setUsers([]);
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('office_users')
        .select('*')
        .eq('office_id', office.id)
        .eq('active', true)
        .order('joined_at', { ascending: false });
      if (fetchError) throw fetchError;
      setUsers(await enrichWithProfiles(data || []));
    } catch (err) {
      console.error('Error fetching office users:', err);
      setError('Erro ao carregar usuários do escritório');
    } finally {
      setLoading(false);
    }
  };

  const addUser = async (userData: NovoOfficeUser): Promise<OfficeUserWithProfile | null> => {
    if (!office?.id) return null;
    try {
      setError(null);
      const { data, error: addError } = await supabase
        .from('office_users')
        .insert({ ...userData, office_id: office.id })
        .select('*')
        .single();
      if (addError) throw addError;
      const [enriched] = await enrichWithProfiles([data]);
      setUsers(prev => [enriched, ...prev]);
      return enriched;
    } catch (err) {
      console.error('Error adding user:', err);
      setError('Erro ao adicionar usuário');
      return null;
    }
  };

  const updateUser = async (userId: string, updates: Partial<OfficeUser>): Promise<OfficeUserWithProfile | null> => {
    try {
      setError(null);
      const { data, error: updateError } = await supabase
        .from('office_users')
        .update(updates)
        .eq('id', userId)
        .select('*')
        .single();
      if (updateError) throw updateError;
      const [enriched] = await enrichWithProfiles([data]);
      setUsers(prev => prev.map(u => u.id === userId ? enriched : u));
      return enriched;
    } catch (err) {
      console.error('Error updating user:', err);
      setError('Erro ao atualizar usuário');
      return null;
    }
  };

  const removeUser = async (userId: string): Promise<boolean> => {
    try {
      setError(null);
      const { error: removeError } = await supabase
        .from('office_users')
        .update({ active: false })
        .eq('id', userId);
      if (removeError) throw removeError;
      setUsers(prev => prev.filter(u => u.id !== userId));
      return true;
    } catch (err) {
      console.error('Error removing user:', err);
      setError('Erro ao remover usuário');
      return false;
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [office?.id]);

  return {
    users,
    loading,
    error,
    refresh: fetchUsers,
    addUser,
    updateUser,
    removeUser,
    isEmpty: users.length === 0,
  };
};
