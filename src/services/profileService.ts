// Acesso ao perfil e ao provisionamento do escritório no login (extraído de
// contexts/AuthContext.tsx — código idêntico, sem o estado do provider).
import { supabase } from '@/integrations/supabase/client';
import { captureError } from '@/lib/monitoring';
import { comTimeout, isSuperAdminEmail } from '@/lib/auth';

export const profileService = {
  /** Perfil do usuário, com timeout. Devolve null em erro (já logado no console). */
  async fetchProfile(userId: string) {
    try {
      const { data, error } = await comTimeout(
        supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
        45000, 'Profile fetch timeout',
      );

      if (error) {
        console.error('Error fetching profile:', error.message);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in fetchProfile:', error);
      return null;
    }
  },

  /** Cria o perfil no 1º acesso; se já existir (corrida), devolve o existente. */
  async createProfile(userId: string, email: string, fullName: string) {
    try {
      // Verifica se o email deve ter role de super_admin baseado na lista global
      const role = isSuperAdminEmail(email) ? 'super_admin' : 'user';

      const { data, error } = await supabase
        .from('profiles')
        .insert({
          user_id: userId,
          email: email,
          full_name: fullName,
          role: role,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505' || (error as { status?: number }).status === 409) {
          const { data: existing } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();
          if (existing) return existing;
        }
        console.error('Error creating profile:', error);
        return null;
      }

      // O escritório é criado/garantido pela RPC ensure_office_for_user() no
      // login (atômico no banco), não mais aqui no cliente — evita o órfão por
      // falha silenciosa que a auditoria de 2026-08 encontrou. Ver processUserData.
      return data;
    } catch (error) {
      console.error('Error in createProfile:', error);
      return null;
    }
  },

  /**
   * Garante o escritório no banco antes de ler (atômico, idempotente, self-healing)
   * e aplica o plano escolhido num cadastro por link que ficou pendente de
   * confirmação de e-mail. Nunca lança: falhas vão pro monitoramento.
   */
  async garantirEscritorioEPlano() {
    // .rpc() não lança em erro de aplicação (só devolve { error }) — o try/catch
    // sozinho só pegava falha de rede.
    try {
      const { error: ensureErr } = await supabase.rpc('ensure_office_for_user');
      if (ensureErr) captureError(ensureErr, { context: 'AuthContext.ensure_office_for_user' });
    } catch (rpcErr) { captureError(rpcErr, { context: 'AuthContext.ensure_office_for_user' }); }
    // Cadastro por link de plano com confirmação de e-mail: o apply_signup_plan não roda no
    // Register (o auto-login falha). Aplica o plano guardado agora, no 1º login pós-confirmação.
    // Idempotente (guard plan_claimed no RPC); roda uma vez e limpa a flag.
    const pendingPlan = localStorage.getItem('pending_signup_plan');
    if (pendingPlan) {
      try {
        const { error: planErr } = await supabase.rpc('apply_signup_plan', { p_plan_type: pendingPlan });
        // Só limpa a flag se APLICOU: o RPC devolve { error } sem lançar, então sem
        // esta checagem o removeItem rodava mesmo na falha e o plano pago escolhido
        // se perdia para sempre. Idempotente (no-op quando já reivindicado), então
        // repetir no próximo login é seguro.
        if (planErr) throw planErr;
        localStorage.removeItem('pending_signup_plan');
      } catch (planErr) {
        captureError(planErr, { context: 'AuthContext.apply_signup_plan (pós-confirmação)' });
        // mantém a flag para tentar de novo no próximo login
      }
    }
  },

  /** Troca o role global do usuário. */
  async updateRole(userId: string, newRole: 'user' | 'admin' | 'super_admin') {
    return supabase
      .from('profiles')
      .update({
        role: newRole,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select()
      .single();
  },

  /** Sai do Supabase (com teto) e limpa os tokens locais. Não navega. */
  async signOutLimpando() {
    try {
      await Promise.race([
        supabase.auth.signOut(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Logout timeout')), 2000))
      ]);
    } catch (err) {
      console.error('Exception during supabase.auth.signOut:', err);
    } finally {
      for (const key in localStorage) {
        if (key.includes('supabase.auth.token') || key.includes('sb-')) {
          localStorage.removeItem(key);
        }
      }
    }
  },
};
