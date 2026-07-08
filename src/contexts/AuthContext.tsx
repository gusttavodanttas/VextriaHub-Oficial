
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { Profile, OfficeUser, Office } from '@/types/database';
import { useStripe } from '@/hooks/useStripe';
import { usePaymentValidation, type PaymentValidationResult } from '@/hooks/usePaymentValidation';
import { officeService } from '@/services/officeService';
import { setMonitoringUser } from '@/lib/monitoring';

export const SUPER_ADMIN_EMAILS = (
  import.meta.env.VITE_SUPER_ADMIN_EMAILS || 'contato@vextriahub.com.br'
).split(',').map((e: string) => e.toLowerCase().trim());

interface User {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin' | 'super_admin';
  office_id?: string | null;
  office_role?: 'user' | 'admin' | 'owner' | 'super_admin' | null;
}

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
  login: (email: string, password: string) => Promise<{ error: any }>;
  register: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
  logout: () => Promise<void>;
  resetFirstLogin: () => void;
  resendConfirmation: (email: string) => Promise<{ error: any }>;
  loginAsSuperAdmin: (email: string, password: string) => Promise<{ error: any }>;
  updateUserRole: (userId: string, newRole: 'user' | 'admin' | 'super_admin') => Promise<{ data?: any; error?: any }>;
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
  const navigate = useNavigate();
  const mountedRef = useRef(true);
  const initializingRef = useRef(false);
  const loginInProgressRef = useRef(false);
  const { checkSubscription } = useStripe();

  // Identifica o usuário no monitoramento de erros (Sentry)
  useEffect(() => {
    setMonitoringUser(user ? { id: user.id, email: user.email } : null);
  }, [user?.id, user?.email]);

  // Fetch user profile from database with timeout
  const fetchProfile = useCallback(async (userId: string) => {
    if (!mountedRef.current) return null;
    
    try {
      const { data, error } = await Promise.race([
        supabase
          .from('profiles')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Profile fetch timeout')), 45000)
        )
      ]) as any;

      if (error) {
        console.error('Error fetching profile:', error.message);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in fetchProfile:', error);
      return null;
    }
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

  // Create user profile in database
  const createProfile = useCallback(async (userId: string, email: string, fullName: string) => {
    if (!mountedRef.current) return null;
    
    try {
      // Verifica se o email deve ter role de super_admin baseado na lista global
      const role = SUPER_ADMIN_EMAILS.includes(email.toLowerCase().trim()) ? 'super_admin' : 'user';
      
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
        if (error.code === '23505' || error.status === 409) {
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

      // Criar o Office (Tenant do sistema) para esse novo usuário
      let newOfficeId = null;
      
      const { data: newOffice, error: officeError } = await supabase
        .from('offices')
        .insert({
          name: `Escritório de ${fullName.split(' ')[0]}`,
          active: true,
          created_by: userId
        })
        .select('id')
        .single();
        
      if (newOffice && !officeError) {
        newOfficeId = newOffice.id;
        
        const { error: linkError } = await supabase
          .from('office_users')
          .insert({
            user_id: userId,
            office_id: newOfficeId,
            role: 'admin',
            active: true,
            joined_at: new Date().toISOString()
          });
          
        if (linkError) {
          console.error('Error linking user to new office:', linkError);
        }
      } else {
        console.error('Error creating default office:', officeError);
      }

      return data;
    } catch (error) {
      console.error('Error in createProfile:', error);
      return null;
    }
  }, []);

  // Fetch office data (Delegado ao serviço)
  const fetchOfficeData = useCallback(async (userId: string) => {
    return await officeService.getOfficeData(userId);
  }, []);

  // Process user data after authentication
  const processUserData = useCallback(async (sessionUser: SupabaseUser) => {
    if (!mountedRef.current) return;
    
    try {
      // Set fallback user immediately to unlock UI
      const initialUser: User = {
        id: sessionUser.id,
        name: sessionUser.user_metadata?.full_name || sessionUser.user_metadata?.name || sessionUser.email?.split('@')[0] || 'Usuário',
        email: sessionUser.email || '',
        role: (sessionUser.email && SUPER_ADMIN_EMAILS.includes(sessionUser.email.toLowerCase().trim())) ? 'super_admin' : 'user'
      };
      
      setUser(initialUser);
      setIsLoading(false);
      
      // Fetch real data in background
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
            const officeData = await fetchOfficeData(sessionUser.id);
            officeUser = officeData.officeUser;
            office = officeData.office;
          }
          
          if (!mountedRef.current) return;
          
          const finalUser: User = {
            id: sessionUser.id,
            name: profileData?.full_name || initialUser.name,
            email: sessionUser.email || profileData?.email || initialUser.email,
            role: profileData?.role || initialUser.role,
            office_id: profileData?.office_id || officeUser?.office_id || null,
            office_role: officeUser?.role || null
          };
          
          setProfile(profileData);
          setOfficeUser(officeUser);
          setOffice(office);
          setUser(finalUser);
          
          if (profileData) {
            const profileAge = Date.now() - new Date(profileData.created_at).getTime();
            setIsFirstLogin(profileAge < 60000 && profileData.role !== 'super_admin');
          }
        } catch (bgError) {
          console.error('Background sync error:', bgError);
        }
      };
      
      backgroundTask();
      
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
      await processUserData(newSession.user);
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
    const oldKeys = [
      'authToken', 'userData', 'loginTimestamp', 'isFirstLogin',
      'nublex_token', 'nublex_user', 'nublex_data'
    ];
    oldKeys.forEach(key => localStorage.removeItem(key));

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, []); // Empty dependency array - only run once

  const login = async (email: string, password: string) => {
    try {
      loginInProgressRef.current = true;
      
      const { data, error } = await Promise.race([
        supabase.auth.signInWithPassword({
          email,
          password,
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Login attempt timeout')), 20000))
      ]) as any;

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
      return { error: err };
    } finally {
      setTimeout(() => {
        loginInProgressRef.current = false;
      }, 1000);
    }
  };

  const register = async (email: string, password: string, fullName: string) => {
    const currentUrl = window.location.origin;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
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
    } else {
    }

    return { error };
  };

  const loginAsSuperAdmin = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
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
      return { error };
    }
  };

  // Função para forçar atualização do role do usuário
  const updateUserRole = useCallback(async (userId: string, newRole: 'user' | 'admin' | 'super_admin') => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({ 
          role: newRole,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .select()
        .single();

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
      return { error };
    }
  }, [user?.id, fetchProfile]);

  // Função de debug para verificar status do usuário
  const debugUserStatus = useCallback(() => {
    // Debug function kept for development use if needed
  }, [user, profile, session]);

  // Função para determinar redirecionamento baseado no role do usuário
  const getRedirectPath = useCallback((userRole: string | undefined, userEmail: string | undefined) => {
    const isSystemAdmin = userEmail && SUPER_ADMIN_EMAILS.includes(userEmail.toLowerCase().trim());
    
    if (isSystemAdmin) {
      return '/admin';
    }
    
    switch (userRole) {
      case 'admin':
        return '/admin';
      case 'user':
      default:
        return '/dashboard';
    }
  }, []);

  const logout = async () => {
    try {
      await Promise.race([
        supabase.auth.signOut(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Logout timeout')), 2000))
      ]);
    } catch (err) {
      console.error('Exception during supabase.auth.signOut:', err);
    } finally {
      setUser(null);
      setProfile(null);
      setSession(null);
      setOffice(null);
      setOfficeUser(null);
      setIsFirstLogin(false);
      
      for (const key in localStorage) {
        if (key.includes('supabase.auth.token') || key.includes('sb-')) {
          localStorage.removeItem(key);
        }
      }

      navigate('/login', { replace: true });
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

  const isUserSuperAdmin = Boolean(
    user?.role === 'super_admin' || 
    profile?.role === 'super_admin' ||
    (user?.email && SUPER_ADMIN_EMAILS.includes(user.email.toLowerCase().trim())) ||
    (session?.user?.email && SUPER_ADMIN_EMAILS.includes(session.user.email.toLowerCase().trim()))
  );

  const value = {
    user,
    profile,
    session,
    office,
    officeUser,
    isAuthenticated: !!session,
    isLoading,
    isFirstLogin,
    isSuperAdmin: isUserSuperAdmin,
    isAdmin: user?.role === 'admin' || user?.role === 'super_admin' || profile?.role === 'admin' || profile?.role === 'super_admin' || isUserSuperAdmin,
    isOfficeAdmin: user?.office_role === 'admin' || user?.office_role === 'owner' || user?.office_role === 'super_admin' || user?.role === 'super_admin' || profile?.role === 'super_admin',
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
