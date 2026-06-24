import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Invitation, NovaInvitation } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';

export const useInvitations = () => {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { office, user } = useAuth();

  const fetchInvitations = async () => {
    if (!office?.id) {
      setInvitations([]);
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('invitations')
        .select('*')
        .eq('office_id', office.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setInvitations(data || []);
    } catch (err) {
      console.error('Error fetching invitations:', err);
      setError('Erro ao carregar convites');
    } finally {
      setLoading(false);
    }
  };

  const createInvitation = async (invitationData: NovaInvitation) => {
    if (!office?.id || !user?.id) return null;

    try {
      setError(null);
      const { data, error: createError } = await supabase
        .from('invitations')
        .insert({
          ...invitationData,
          office_id: office.id,
          invited_by: user.id
        })
        .select()
        .single();

      if (createError) throw createError;

      setInvitations(prev => [data, ...prev]);
      return data;
    } catch (err) {
      console.error('Error creating invitation:', err);
      setError('Erro ao criar convite');
      return null;
    }
  };

  const updateInvitation = async (invitationId: string, updates: Partial<Invitation>) => {
    try {
      setError(null);
      const { data, error: updateError } = await supabase
        .from('invitations')
        .update(updates)
        .eq('id', invitationId)
        .select()
        .single();

      if (updateError) throw updateError;

      setInvitations(prev => prev.map(i => i.id === invitationId ? data : i));
      return data;
    } catch (err) {
      console.error('Error updating invitation:', err);
      setError('Erro ao atualizar convite');
      return null;
    }
  };

  const resendInvitation = async (invitationId: string) => {
    try {
      setError(null);
      // Aqui você pode implementar a lógica para reenviar o convite
      // Por exemplo, atualizar expires_at ou enviar novo email
      const newExpiresAt = new Date();
      newExpiresAt.setDate(newExpiresAt.getDate() + 7); // 7 dias

      const { data, error: updateError } = await supabase
        .from('invitations')
        .update({ 
          expires_at: newExpiresAt.toISOString(),
          status: 'pending'
        })
        .eq('id', invitationId)
        .select()
        .single();

      if (updateError) throw updateError;

      setInvitations(prev => prev.map(i => i.id === invitationId ? data : i));
      return data;
    } catch (err) {
      console.error('Error resending invitation:', err);
      setError('Erro ao reenviar convite');
      return null;
    }
  };

  const cancelInvitation = async (invitationId: string) => {
    try {
      setError(null);
      const { data, error: updateError } = await supabase
        .from('invitations')
        .update({ status: 'expired' })
        .eq('id', invitationId)
        .select()
        .single();

      if (updateError) throw updateError;

      setInvitations(prev => prev.map(i => i.id === invitationId ? data : i));
      return data;
    } catch (err) {
      console.error('Error canceling invitation:', err);
      setError('Erro ao cancelar convite');
      return null;
    }
  };

  useEffect(() => {
    fetchInvitations();
  }, [office?.id]);

  return {
    invitations,
    loading,
    error,
    refresh: fetchInvitations,
    createInvitation,
    updateInvitation,
    resendInvitation,
    cancelInvitation,
    isEmpty: invitations.length === 0,
    // Filtros úteis
    pendingInvitations: invitations.filter(i => i.status === 'pending'),
    expiredInvitations: invitations.filter(i => i.status === 'expired'),
    acceptedInvitations: invitations.filter(i => i.status === 'accepted')
  };
};