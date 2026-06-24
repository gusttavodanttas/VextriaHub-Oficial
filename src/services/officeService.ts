
import { supabase } from '@/integrations/supabase/client';
import { Office, OfficeUser } from '@/types/database';

export const officeService = {
  /**
   * Busca os dados do escritório vinculado a um usuário
   */
  async getOfficeData(userId: string): Promise<{ officeUser: OfficeUser | null, office: Office | null }> {
    try {
      const { data: officeUserData, error: officeUserError } = await supabase
        .from('office_users')
        .select(`
          *,
          office:offices(
            *,
            is_lifetime,
            manual_discount_percent
          )
        `)
        .eq('user_id', userId)
        .eq('active', true)
        .maybeSingle();

      if (officeUserError || !officeUserData) {
        return { officeUser: null, office: null };
      }

      const office = (officeUserData as any).office as Office;

      return { 
        officeUser: officeUserData as OfficeUser, 
        office: office
      };
    } catch (error) {
      console.error('Error fetching office data:', error);
      return { officeUser: null, office: null };
    }
  },

  /**
   * Vincula um usuário a um escritório
   */
  async joinOffice(userId: string, officeId: string, role: 'user' | 'admin' = 'user'): Promise<void> {
    const { error } = await supabase
      .from('office_users')
      .insert({
        user_id: userId,
        office_id: officeId,
        role: role,
        active: true,
        joined_at: new Date().toISOString()
      });
    
    if (error) throw error;
  }
};
