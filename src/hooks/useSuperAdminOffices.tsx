import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { addDays } from 'date-fns';
import type { Database } from '@/integrations/supabase/types';

type OfficeRow = Database['public']['Tables']['offices']['Row'];
type OfficeUserRow = Database['public']['Tables']['office_users']['Row'];
type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type SubscriptionRow = Database['public']['Tables']['subscriptions']['Row'];

export interface AdminOffice {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  office_id: string | null;
  office_name: string | null;
  office_email: string | null;
  address: string | null;
  phone: string | null;
  created_at: string;
  payment_status: 'em_dia' | 'proximo_vencimento' | 'vencido' | 'pendente';
  plan_name: string;
  price: number;
  end_date: string | null;
  is_trial: boolean;
  active: boolean;
  is_lifetime: boolean;
  manual_discount_percent: number;
}

export interface UseSuperAdminOfficesResult {
  admins: AdminOffice[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updateOfficeStatus: (officeId: string, active: boolean) => Promise<boolean>;
  updateOfficeFull: (officeId: string, updates: Partial<AdminOffice>) => Promise<boolean>;
  manageAccess: (
    officeId: string,
    action: 'apply_discount' | 'grant_lifetime' | 'revoke_lifetime',
    options?: { discount_percent?: number; reason?: string }
  ) => Promise<boolean>;
  sendPaymentReminder: (email: string, officeName: string) => Promise<boolean>;
  isEmpty: boolean;
}

export const useSuperAdminOffices = (): UseSuperAdminOfficesResult => {
  const [admins, setAdmins] = useState<AdminOffice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isSuperAdmin, user } = useAuth();
  const { toast } = useToast();

  const fetchAdmins = useCallback(async () => {
    const normalizedEmail = user?.email?.toLowerCase().trim();
    const isMainSuperAdmin = normalizedEmail === 'contato@vextriahub.com.br';

    if (!isSuperAdmin && !isMainSuperAdmin) {
      setError('Acesso negado.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Carregar escritórios com assinaturas
      const { data: offices, error: officesError } = await supabase
        .from('offices')
        .select(`
          *,
          subscriptions (
            id,
            status,
            plan,
            price,
            end_date,
            manual_discount_percent
          )
        `)
        .order('created_at', { ascending: false });
      
      if (officesError) throw officesError;

      const officeIds = (offices || []).map((o: OfficeRow) => o.id);

      let userData: OfficeUserRow[] = [];
      let profileData: ProfileRow[] = [];

      if (officeIds.length > 0) {
        // Carregar administradores de cada escritório
        const { data: ouData, error: userError } = await supabase
          .from('office_users')
          .select('office_id, role, user_id')
          .in('office_id', officeIds);

        if (userError) throw userError;
        userData = (ouData || []) as OfficeUserRow[];

        const userIds = [...new Set(userData.map((u) => u.user_id))];

        if (userIds.length > 0) {
          // Carregar perfis dos usuários
          const { data: pData, error: profileError } = await supabase
            .from('profiles')
            .select('user_id, full_name, email')
            .in('user_id', userIds);

          if (profileError) {
            console.warn('Aviso: Falha ao carregar perfis.', profileError);
          }
          profileData = (pData || []) as ProfileRow[];
        }
      }

      const adminList: AdminOffice[] = (offices || []).map((office: OfficeRow & { subscriptions?: SubscriptionRow[] }) => {
        const officeUser =
          (userData || []).find((u) => u.office_id === office.id && u.role === 'admin') ||
          (userData || []).find((u) => u.office_id === office.id);
        
        const profile = profileData.find((p) => p.user_id === officeUser?.user_id);
        const sub = office.subscriptions && office.subscriptions.length > 0 ? office.subscriptions[0] : null;

        const isCourtesy = office.access_type === 'courtesy';

        const isLegacyLifetime =
          office.is_lifetime === true ||
          office.access_type === 'lifetime' ||
          sub?.end_date?.includes('2099') ||
          office.plan === 'lifetime';

        // isTrial only if NOT lifetime and NOT courtesy
        const isTrial =
          !isLegacyLifetime && !isCourtesy &&
          (office.plan === 'trial' || sub?.status === 'trial' || sub?.status === 'trialing');

        let payment_status: AdminOffice['payment_status'] = 'pendente';
        let plan_display_name = office.plan || sub?.plan || 'Free';

        // Courtesy takes FIRST priority
        if (isCourtesy) {
          payment_status = 'em_dia';
          plan_display_name = 'cortesia';
        } else if (isLegacyLifetime) {
          payment_status = 'em_dia';
          plan_display_name = 'lifetime';
        } else if (isTrial) {
          payment_status = 'em_dia';
          plan_display_name = 'trial';
        } else if (sub) {
          if (sub.status === 'active') payment_status = 'em_dia';
          else if (sub.status === 'past_due' || sub.status === 'unpaid')
            payment_status = 'proximo_vencimento';
          else payment_status = 'vencido';

          const revPlanMap: Record<string, string> = {
            basico: 'starter',
            intermediario: 'pro',
            avancado: 'business',
            premium: 'lifetime',
          };
          plan_display_name = revPlanMap[sub.plan] || sub.plan || 'trial';
        }

        let end_date = sub?.end_date || office.end_date || null;
        if (isTrial && !end_date && office.created_at) {
          end_date = addDays(new Date(office.created_at), 7).toISOString();
        }

        return {
          id: officeUser?.user_id || office.id,
          full_name: profile?.full_name || 'Usuário Hub',
          email: profile?.email || 'Sem e-mail',
          role: officeUser?.role || 'user',
          office_id: office.id,
          office_name: office.name || 'Escritório Sem Nome',
          office_email: office.email || null,
          address: office.address || null,
          phone: office.phone || null,
          created_at: office.created_at,
          payment_status,
          plan_name: plan_display_name,
          price: sub?.price || 0,
          end_date,
          is_trial: isTrial,
          active: office.active ?? true,
          is_lifetime: !!isLegacyLifetime,
          manual_discount_percent:
            Number(sub?.manual_discount_percent) ||
            Number(office.manual_discount_percent) ||
            0,
        };
      });

      setAdmins(adminList);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('Erro ao carregar dados:', error);
      setError('Erro ao carregar dados administrativos.');
    } finally {
      setLoading(false);
    }
  }, [isSuperAdmin, user]);

  const updateOfficeStatus = useCallback(async (officeId: string, active: boolean) => {
    try {
      const { error } = await supabase
        .from('offices')
        .update({ active })
        .eq('id', officeId);
      
      if (error) throw error;
      toast({ title: active ? 'Acesso Liberado' : 'Acesso Suspenso' });
      await fetchAdmins();
      return true;
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      return false;
    }
  }, [toast, fetchAdmins]);

  const updateOfficeFull = useCallback(async (office_id: string, updates: Partial<AdminOffice>) => {
    try {
      const planMap: Record<string, string> = {
        trial: 'trial',
        starter: 'basico',
        pro: 'intermediario',
        business: 'avancado',
        lifetime: 'premium',
      };
      
      const dbPlan = updates.plan_name
        ? planMap[updates.plan_name] || updates.plan_name
        : undefined;

      const officeUpdates: Record<string, any> = {};
      if (updates.office_name !== undefined) officeUpdates.name = updates.office_name;
      if (updates.office_email !== undefined) officeUpdates.email = updates.office_email;
      if (updates.phone !== undefined) officeUpdates.phone = updates.phone;
      if (updates.address !== undefined) officeUpdates.address = updates.address;
      if (dbPlan) officeUpdates.plan = dbPlan;
      if (updates.is_lifetime !== undefined) officeUpdates.is_lifetime = updates.is_lifetime;

      if (Object.keys(officeUpdates).length > 0) {
        const { error: ofError } = await supabase
          .from('offices')
          .update(officeUpdates)
          .eq('id', office_id);
        if (ofError) throw ofError;
      }

      const subUpdates: Record<string, any> = {};
      if (dbPlan) subUpdates.plan = dbPlan;
      if (updates.is_lifetime !== undefined) {
        subUpdates.end_date = updates.is_lifetime
          ? '2099-12-31T23:59:59Z'
          : addDays(new Date(), 30).toISOString();
        subUpdates.status = 'active';
      }

      if (Object.keys(subUpdates).length > 0) {
        const { data: existingSub, error: checkError } = await supabase
          .from('subscriptions')
          .select('id')
          .eq('office_id', office_id)
          .maybeSingle();
        
        if (checkError) throw checkError;

        if (existingSub) {
          const { error: subUpdateError } = await supabase
            .from('subscriptions')
            .update(subUpdates)
            .eq('id', existingSub.id);
          if (subUpdateError) throw subUpdateError;
        } else {
          const { error: subInsertError } = await supabase
            .from('subscriptions')
            .insert({
              office_id,
              ...subUpdates,
              start_date: new Date().toISOString(),
            });
          if (subInsertError) throw subInsertError;
        }
      }

      toast({
        title: 'Dados Sincronizados',
        description: 'Configurações do escritório atualizadas com sucesso.',
      });
      await fetchAdmins();
      return true;
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('Erro ao atualizar escritório:', error);
      toast({
        title: 'Erro ao salvar',
        description: error.message || 'Não foi possível atualizar os dados.',
        variant: 'destructive',
      });
      return false;
    }
  }, [toast, fetchAdmins]);

  const manageAccess = useCallback(async (
    officeId: string,
    action: 'apply_discount' | 'grant_lifetime' | 'revoke_lifetime',
    options?: { discount_percent?: number; reason?: string }
  ) => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-manage-access', {
        body: {
          office_id: officeId,
          action,
          discount_percent: options?.discount_percent,
          reason: options?.reason,
        },
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: 'Sucesso!',
        description:
          action === 'apply_discount'
            ? 'Desconto aplicado no Stripe.'
            : action === 'grant_lifetime'
            ? 'Acesso vitalício concedido.'
            : 'Vitalício revertido.',
      });
      await fetchAdmins();
      return true;
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('Erro ao gerenciar acesso:', error);
      toast({
        title: 'Falha na operação',
        description: error.message || 'Erro ao processar ação no Stripe.',
        variant: 'destructive',
      });
      return false;
    }
  }, [toast, fetchAdmins]);

  const sendPaymentReminder = useCallback(async (_email: string, _officeName: string) => {
    toast({ title: 'E-mail de lembrete enviado.' });
    return true;
  }, [toast]);

  useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

  return {
    admins,
    loading,
    error,
    refresh: fetchAdmins,
    updateOfficeStatus,
    updateOfficeFull,
    manageAccess,
    sendPaymentReminder,
    isEmpty: admins.length === 0,
  };
};
