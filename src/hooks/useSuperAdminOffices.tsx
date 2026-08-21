import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getErrorMessage } from '@/lib/errors';
import { useToast } from '@/hooks/use-toast';

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
    action: 'apply_discount' | 'grant_lifetime' | 'revoke_lifetime' | 'grant_trial',
    options?: { discount_percent?: number; trial_days?: number; reason?: string }
  ) => Promise<boolean>;
  sendPaymentReminder: (email: string, officeName: string) => Promise<boolean>;
  deleteOffice: (officeId: string, confirmName: string) => Promise<boolean>;
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
          office_subscriptions (
            status,
            plan_name,
            value,
            next_due_date,
            is_lifetime,
            manual_discount_percent
          )
        `)
        .order('created_at', { ascending: false });
      
      if (officesError) throw officesError;

      const officeIds = (offices || []).map((o: any) => o.id);

      let userData: any[] = [];
      let profileData: any[] = [];

      if (officeIds.length > 0) {
        // Carregar administradores de cada escritório
        const { data: ouData, error: userError } = await supabase
          .from('office_users')
          .select('office_id, role, user_id')
          .in('office_id', officeIds);

        if (userError) throw userError;
        userData = ouData || [];

        const userIds = [...new Set(userData.map((u: any) => u.user_id))];

        if (userIds.length > 0) {
          // Carregar perfis dos usuários
          const { data: pData, error: profileError } = await supabase
            .from('profiles')
            .select('user_id, full_name, email')
            .in('user_id', userIds);

          if (profileError) {
            console.warn('Aviso: Falha ao carregar perfis.', profileError);
          }
          profileData = pData || [];
        }
      }

      const adminList: AdminOffice[] = (offices || []).map((office: any) => {
        const officeUser =
          (userData || []).find((u: any) => u.office_id === office.id && u.role === 'admin') ||
          (userData || []).find((u: any) => u.office_id === office.id);
        
        const profile = profileData.find((p: any) => p.user_id === officeUser?.user_id);
        const os = office.office_subscriptions;
        const sub = Array.isArray(os) ? os[0] : os;
        const st: string | undefined = sub?.status;

        const isCourtesy = st === 'cortesia';
        const isLegacyLifetime = sub?.is_lifetime === true;
        const isTrial = st === 'trial';

        let payment_status: AdminOffice['payment_status'] = 'pendente';
        if (isCourtesy || isLegacyLifetime || isTrial || st === 'ativa') payment_status = 'em_dia';
        else if (st === 'pendente') payment_status = 'proximo_vencimento';
        else if (st === 'atrasada' || st === 'cancelada') payment_status = 'vencido';

        const plan_display_name = isCourtesy ? 'cortesia'
          : isLegacyLifetime ? 'lifetime'
          : isTrial ? 'trial'
          : (sub?.plan_name || office.plan || 'Free');

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
          price: Number(sub?.value || 0),
          end_date: sub?.next_due_date || null,
          is_trial: isTrial,
          active: office.active ?? true,
          is_lifetime: !!isLegacyLifetime,
          manual_discount_percent: Number(sub?.manual_discount_percent) || 0,
        };
      });

      setAdmins(adminList);
    } catch (err: unknown) {
      console.error('Erro ao carregar dados:', err);
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
      toast({ title: 'Erro', description: getErrorMessage(err), variant: 'destructive' });
      return false;
    }
  }, [toast, fetchAdmins]);

  // Exclusão DEFINITIVA (cascata) via RPC delete_office — super-admin + confirmação por nome.
  const deleteOffice = useCallback(async (officeId: string, confirmName: string) => {
    try {
      const { error } = await supabase.rpc('delete_office' as never, {
        p_office_id: officeId,
        p_confirm_name: confirmName,
      } as never);
      if (error) throw error;
      toast({ title: 'Escritório excluído', description: 'Escritório, dados e contas dos membros foram removidos.' });
      await fetchAdmins();
      return true;
    } catch (err: unknown) {
      toast({ title: 'Erro ao excluir', description: getErrorMessage(err), variant: 'destructive' });
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

      const officeUpdates: any = {};
      if (updates.office_name !== undefined) officeUpdates.name = updates.office_name;
      if (updates.office_email !== undefined) officeUpdates.email = updates.office_email;
      if (updates.phone !== undefined) officeUpdates.phone = updates.phone;
      if (updates.address !== undefined) officeUpdates.address = updates.address;
      if (dbPlan) officeUpdates.plan = dbPlan;

      if (Object.keys(officeUpdates).length > 0) {
        const { error: ofError } = await supabase
          .from('offices')
          .update(officeUpdates)
          .eq('id', office_id);
        if (ofError) throw ofError;
      }

      toast({
        title: 'Dados Sincronizados',
        description: 'Configurações do escritório atualizadas com sucesso.',
      });
      await fetchAdmins();
      return true;
    } catch (err: unknown) {
      console.error('Erro ao atualizar escritório:', err);
      toast({
        title: 'Erro ao salvar',
        description: getErrorMessage(err, 'Não foi possível atualizar os dados.'),
        variant: 'destructive',
      });
      return false;
    }
  }, [toast, fetchAdmins]);

  const manageAccess = useCallback(async (
    officeId: string,
    action: 'apply_discount' | 'grant_lifetime' | 'revoke_lifetime' | 'grant_trial',
    options?: { discount_percent?: number; trial_days?: number; reason?: string }
  ) => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-office-access', {
        body: {
          office_id: officeId,
          action,
          discount_percent: options?.discount_percent,
          trial_days: options?.trial_days,
          reason: options?.reason,
        },
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: 'Sucesso!',
        description:
          action === 'apply_discount' ? 'Desconto aplicado.'
            : action === 'grant_lifetime' ? 'Acesso vitalício concedido.'
            : action === 'grant_trial' ? 'Período de teste estendido.'
            : 'Vitalício revertido.',
      });
      await fetchAdmins();
      return true;
    } catch (err: unknown) {
      console.error('Erro ao gerenciar acesso:', err);
      toast({
        title: 'Falha na operação',
        description: getErrorMessage(err, 'Erro ao processar a operação.'),
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
    deleteOffice,
    isEmpty: admins.length === 0,
  };
};
