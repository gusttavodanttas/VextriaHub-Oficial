import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { OfficeUser, NovoOfficeUser } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';

export const useOfficeUsers = () => {
  const [users, setUsers] = useState<OfficeUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { office, user } = useAuth();

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
        .select(`
          *,
          profile:profiles(full_name, email)
        `)
        .eq('office_id', office.id)
        .eq('active', true)
        .order('joined_at', { ascending: false });

      if (fetchError) throw fetchError;

      setUsers(data || []);
    } catch (err) {
      console.error('Error fetching office users:', err);
      setError('Erro ao carregar usuários do escritório');
    } finally {
      setLoading(false);
    }
  };

  const addUser = async (userData: NovoOfficeUser) => {
    if (!office?.id) return null;

    try {
      setError(null);
      const { data, error: addError } = await supabase
        .from('office_users')
        .insert({
          ...userData,
          office_id: office.id
        })
        .select(`
          *,
          profile:profiles(full_name, email)
        `)
        .single();

      if (addError) throw addError;

      setUsers(prev => [data, ...prev]);
      return data;
    } catch (err) {
      console.error('Error adding user:', err);
      setError('Erro ao adicionar usuário');
      return null;
    }
  };

  const updateUser = async (userId: string, updates: Partial<OfficeUser>) => {
    try {
      setError(null);
      const { data, error: updateError } = await supabase
        .from('office_users')
        .update(updates)
        .eq('id', userId)
        .select(`
          *,
          profile:profiles(full_name, email)
        `)
        .single();

      if (updateError) throw updateError;

      setUsers(prev => prev.map(u => u.id === userId ? data : u));
      return data;
    } catch (err) {
      console.error('Error updating user:', err);
      setError('Erro ao atualizar usuário');
      return null;
    }
  };

  const removeUser = async (userId: string) => {
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
    isEmpty: users.length === 0
  };
};