// Provider de autenticação: estado da sessão/perfil/escritório e as ações de
// login. As regras puras (papéis, redirecionamento, usuário provisório/final)
// estão em lib/auth.ts; o acesso a perfil/escritório em services/profileService.ts.
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { Profile, OfficeUser, Office } from '@/types/database';
import { usePaymentValidation, type PaymentValidationResult } from '@/hooks/usePaymentValidation';
import { officeService } from '@/services/officeService';
import { profileService } from '@/services/profileService';
import { setMonitoringUser, captureError } from '@/lib/monitoring';
import {
  AUTH_TIMING, OLD_LOCAL_STORAGE_KEYS, comTimeout, comoError,
  usuarioInicial, usuarioFinal, ehPrimeiroLogin, derivarPapeis, getRedirectPath as getRedirectPathPuro,
  type User,
} from '@/lib/auth';

// Re-exportados daqui porque hooks (usePermissions) e testes importam deste módulo.
export { SUPER_ADMIN_EMAILS, OFFICE_LOAD_CAP_MS, AUTH_TIMING } from '@/lib/auth';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  office: Office | null;
  officeUser: OfficeUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isFirstLogin: boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isOfficeAdmin: boolean;
  paymentValidation: PaymentValidationResult | null;
  showPaymentModal: boolean;
  login: (email: string, password: string) => Promise<{ error: Error | null }>;
  register: (email: string, password: string, fullName: string, metadata?: Record<string, string | undefined>) => Promise<{ error: Error | null }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  resetFirstLogin: () => void;
  resendConfirmation: (email: string) => Promise<{ error: Error | null }>;
  loginAsSuperAdmin: (email: string, password: string) => Promise<{ error: Error | null }>;
  updateUserRole: (userId: string, newRole: 'user' | 'admin' | 'super_admin') => Promise<{ data?: Profile; error: Error | null }>;
  debugUserStatus: () => void;
  getRedirectPath: (userRole: string | undefined, userEmail: string | undefined) => string;
  validatePayment: (userId?: string) => Promise<PaymentValidationResult>;
  setShowPaymentModal: (show: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [office, setOffice] = useState<Office | null>(null);
  const [officeUser, setOfficeUser] = useState<OfficeUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFirstLogin, setIsFirstLogin] = useState(false);
  const [paymentValidation, setPaymentValidation] = useState<PaymentValidationResult | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [subscriptionInfo, setSubscriptionInfo] = useState<{ subscribed: boolean; subscription_tier?: string; subscription_end?: string } | null>(null);
  const mountedRef = useRef(true);
  const initializingRef = useRef(false);
  const loginInProgressRef = useRef(false);
  // Espelha `user` sem disparar re-render — usado em handleAuthStateChange (useCallback
  // com closure própria) pra saber, sem depender de `user` no array de deps, se o
  // TOKEN_REFRESHED é do mesmo usuário já carregado.
  const userRef = useRef<User | null>(null);
  useEffect(() => { userRef.current = user; }, [user]);

  // Identifica o usuário no monitoramento de erros (Sentry)
  useEffect(() => {
    setMonitoringUser(user ? { id: user.id, email: user.email } : null);
  }, [user?.id, user?.email]);

  // Fetch user profile from database with timeout
  const fetchProfile = useCallback(async (userId: string) => {
    if (!mountedRef.current) return null;
    return profileService.fetchProfile(userId);
  }, []);

  const { validatePayment: validatePaymentInternal } = usePaymentValidation();

  // Função para validar pagamento do usuário (delegada ao hook)
  const validatePayment = useCallback(async (userId?: string): Promise<PaymentValidationResult> => {
    const targetUserId = userId || user?.id;
    
    if (!targetUserId) {
      return {
        needsPayment: false,
        daysRegistered: 0,
        hasActiveSubscription: false,
        paymentStatus: 'unknown',
        message: 'Usuário não encontrado'
      };
    }

    const result = await validatePaymentInternal(targetUserId, office?.id);
    setPaymentValidation(result);
    return result;
  }, [user, office, validatePaymentInternal]);

  // Dispara a validação de acesso assim que usuário/escritório estão prontos.
  // (Antes só rodava no Index com ?success=true → o portão quase nunca disparava.)
  useEffect(() => {
    if (user?.id) {
      validatePayment(user.id);
    }
  }, [user?.id, office?.id, validatePayment]);

  // Create user profile in database
  const createProfile = useCallback(async (userId: string, email: string, fullName: string) => {
    if (!mountedRef.current) return null;
    return profileService.createProfile(userId, email, fullName);
  }, []);

  // Fetch office data (Delegado ao serviço)
  const fetchOfficeData = useCallback(async (userId: string) => {
    return await officeService.getOfficeData(userId);
  }, []);

  // Process user data after authentication
  const processUserData = useCallback(async (sessionUser: SupabaseUser) => {
    if (!mountedRef.current) return;
    
    try {
      const initialUser = usuarioInicial(sessionUser);

      // Usuário provisório (sem office_id) só quando ainda não há ninguém carregado.
      // No refreshProfile/relogin do MESMO usuário, trocar por este objeto zerava por
      // um instante tudo que depende de user.office_id ("zera e volta").
      if (userRef.current?.id !== sessionUser.id) setUser(initialUser);

      // isLoading NÃO é liberado aqui. Antes era: a tela abria com user sem office_id
      // e qualquer cadastro feito nesse intervalo ia sem escritório (RLS → 403, achado
      // no E2E de 09/10/2026). Agora espera o perfil + escritório (com teto, abaixo do
      // redirecionamento do PrivateRoute) — ver o await no fim desta função.
      const backgroundTask = async () => {
        try {
          let profileData = await fetchProfile(sessionUser.id);
          
          if (!mountedRef.current) return;
          
          if (!profileData && sessionUser.email) {
            profileData = await createProfile(
              sessionUser.id, 
              sessionUser.email, 
              initialUser.name
            );
          }
          
          if (!mountedRef.current) return;
          
          let officeUser = null;
          let office = null;
          
          if (profileData) {
            // Garante o escritório no banco antes de ler (atômico, idempotente,
            // self-healing). Substitui a criação frágil de escritório no cliente.
            await profileService.garantirEscritorioEPlano();
            const officeData = await fetchOfficeData(sessionUser.id);
            officeUser = officeData.officeUser;
            office = officeData.office;
          }
          
          if (!mountedRef.current) return;
          
          const finalUser = usuarioFinal(sessionUser, initialUser, profileData, officeUser);
          
          setProfile(profileData);
          setOfficeUser(officeUser);
          setOffice(office);
          setUser(finalUser);
          
          if (profileData) {
            setIsFirstLogin(ehPrimeiroLogin(profileData));
          }
        } catch (bgError) {
          captureError(bgError, { context: 'AuthContext.processUserData (perfil/escritório)' });
        }
      };

      await Promise.race([
        backgroundTask(),
        new Promise<void>((resolve) => setTimeout(resolve, AUTH_TIMING.officeLoadCapMs)),
      ]);
      if (mountedRef.current) setIsLoading(false);

    } catch (error) {
      console.error('Critical error in processUserData:', error);
      setIsLoading(false);
    }
  }, [fetchProfile, createProfile, fetchOfficeData]);

  // Handle auth state change
  const handleAuthStateChange = useCallback(async (event: string, newSession: Session | null) => {
    if (!mountedRef.current) return;

    setSession(newSession);

    if (newSession?.user) {
      // Evento do MESMO usuário já carregado não tem nada novo pra buscar —
      // reprocessar do zero é o que causava o "zera e volta". Generalizado por
      // ID de usuário, não por nome de evento: o supabase-js dispara TOKEN_REFRESHED
      // quando renova o token sozinho ao a aba voltar a ficar visível, MAS também
      // pode disparar SIGNED_IN nesse mesmo cenário (fluxo de recuperação de sessão
      // com "proxy user" em _recoverAndRefresh, no @supabase/auth-js) — checar só
      // TOKEN_REFRESHED deixava esse segundo caminho passar direto e reproduzir o
      // mesmo bug. Em qualquer um desses eventos, o primeiro passo de
      // processUserData é setUser(initialUser) com um objeto SEM office_id,
      // zerando por um instante todo dashboard que depende de user.office_id, até
      // o fetch em background devolver o usuário completo de volta.
      const sameUserAlreadyLoaded = userRef.current?.id === newSession.user.id;
      if (!sameUserAlreadyLoaded) {
        await processUserData(newSession.user);
      }
    } else {
      setUser(null);
      setProfile(null);
      setOffice(null);
      setOfficeUser(null);
      setIsFirstLogin(false);
    }
    
    if (mountedRef.current) {
      setIsLoading(false);
    }
  }, [processUserData, session]);

  // Initialize auth state
  useEffect(() => {
    if (initializingRef.current) return;
    
    initializingRef.current = true;
    mountedRef.current = true;
    
    const initializeAuth = async () => {
      try {
        // Initializing auth
        
        const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) throw sessionError;
        
        if (!mountedRef.current) return;
        
        setSession(currentSession);
        
        if (currentSession?.user) {
          await processUserData(currentSession.user);
        }
        
        if (mountedRef.current) {
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        if (mountedRef.current) {
          setIsLoading(false);
        }
      }
    };
    
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(handleAuthStateChange);

    // Initialize auth
    initializeAuth();

    // Cleanup old localStorage data
    OLD_LOCAL_STORAGE_KEYS.forEach(key => localStorage.removeItem(key));

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, []); // Empty dependency array - only run once

  const login = async (email: string, password: string) => {
    try {
      loginInProgressRef.current = true;
      
      const { data, error } = await comTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        20000, 'Login attempt timeout',
      );

      if (error) {
        console.error('Login error:', error.message);
        return { error };
      }

      if (data.session) {
        await processUserData(data.user);
      }

      return { error: null };
    } catch (err) {
      console.error('Unexpected login error:', err);
      return { error: comoError(err) };
    } finally {
      setTimeout(() => {
        loginInProgressRef.current = false;
      }, 1000);
    }
  };

  const register = async (email: string, password: string, fullName: string, metadata?: Record<string, string | undefined>) => {
    const currentUrl = window.location.origin;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          ...(metadata || {}),
        },
        emailRedirectTo: `${currentUrl}/dashboard`
      }
    });

    if (error) {
      console.error('Registration error:', error);
    }

    return { error };
  };

  const resendConfirmation = async (email: string) => {
    
    const currentUrl = window.location.origin;
    
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${currentUrl}/dashboard`
      }
    });

    if (error) {
      console.error('Resend confirmation error:', error);
    }

    return { error };
  };

  const loginAsSuperAdmin = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        console.error('Super admin login error:', error);
        return { error };
      }

      return { error: null };
    } catch (error) {
      console.error('Super admin login exception:', error);
      return { error: comoError(error) };
    }
  };

  // Função para forçar atualização do role do usuário
  const updateUserRole = useCallback(async (userId: string, newRole: 'user' | 'admin' | 'super_admin') => {
    try {
      const { data, error } = await profileService.updateRole(userId, newRole);

      if (error) {
        console.error('Error updating user role:', error);
        return { error };
      }
      
      // Recarregar dados do usuário
      if (user?.id === userId) {
        const updatedProfile = await fetchProfile(userId);
        if (updatedProfile) {
          setProfile(updatedProfile);
          setUser(prev => prev ? { ...prev, role: newRole } : null);
        }
      }
      
      return { data, error: null };
    } catch (error) {
      console.error('Error in updateUserRole:', error);
      return { error: comoError(error) };
    }
  }, [user?.id, fetchProfile]);

  // Função de debug para verificar status do usuário
  const debugUserStatus = useCallback(() => {
    // Debug function kept for development use if needed
  }, []);

  // Função para determinar redirecionamento baseado no role do usuário (ver lib/auth)
  const getRedirectPath = useCallback(getRedirectPathPuro, []);

  const logout = async () => {
    try {
      await profileService.signOutLimpando();
    } finally {
      setUser(null);
      setProfile(null);
      setSession(null);
      setOffice(null);
      setOfficeUser(null);
      setIsFirstLogin(false);

      // Recarga completa, não navegação da SPA: a aba segue rodando o JS que
      // carregou antes do último deploy até recarregar, e um "Sair" + "Entrar"
      // dentro da SPA entrava de novo com o build antigo. Recarregar aqui
      // garante que o próximo login já use o site publicado por último.
      window.location.replace('/login');
    }
  };

  // Nova função para atualizar o perfil em tempo real sem F5
  const refreshProfile = useCallback(async () => {
    if (session?.user) {
      await processUserData(session.user);
    }
  }, [session, processUserData]);

  const resetFirstLogin = useCallback(() => {
    setIsFirstLogin(false);
  }, []);

  const papeis = derivarPapeis(user, profile, session?.user?.email);

  const value = {
    user,
    profile,
    session,
    office,
    officeUser,
    isAuthenticated: !!session,
    isLoading,
    isFirstLogin,
    ...papeis,
    paymentValidation,
    showPaymentModal,
    setShowPaymentModal,
    login,
    register,
    logout,
    refreshProfile,
    resetFirstLogin,
    resendConfirmation,
    loginAsSuperAdmin,
    updateUserRole,
    debugUserStatus,
    getRedirectPath,
    validatePayment,
    subscriptionInfo
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
