
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { Profile, OfficeUser, Office } from '@/types/database';
import { useStripe } from '@/hooks/useStripe';
import { usePaymentValidation, type PaymentValidationResult } from '@/hooks/usePaymentValidation';
import { officeService } from '@/services/officeService';

export const SUPER_ADMIN_EMAILS = [
  'contato@vextriahub.com.br'
].map(e => e.toLowerCase().trim());

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

  // Fetch user profile from database with timeout
  const fetchProfile = useCallback(async (userId: string) => {
    if (!mountedRef.current) return null;
    
    try {
      const { data, error } = await Promise.race([
        supabase
          .from('profiles')
          .select('*')
          .eq('user_id', userId)
          .single(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Profile fetch timeout')), 45000) // Aumentado para 45s
        )
      ]) as any;

      if (error) {
        console.error('❌ Error fetching profile:', error);
        console.error('❌ Error details:', {
          message: error.message,
          code: error.code,
          userId: userId
        });
        return null;
      }

      console.log('✅ Profile fetched successfully for:', userId);
      return data;
    } catch (error) {
      console.error('❌ Error in fetchProfile:', error);
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
      // Profile creation logic (simplified logs for production)
      
      // Verifica se o email deve ter role de super_admin baseado na lista global
      const role = SUPER_ADMIN_EMAILS.includes(email.toLowerCase().trim()) ? 'super_admin' : 'user';
      console.log('🔧 Assigning role:', role, 'for email:', email);
      
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
        // Se já existir (409 Conflict), tentamos buscar novamente em vez de falhar
        if (error.code === '23505' || error.status === 409) {
          console.warn('⚠️ Profile already exists (409). Fetching existing one...');
          const { data: existing } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', userId)
            .single();
          if (existing) {
            console.log('✅ Recovered existing profile:', existing);
            return existing;
          }
        }
        console.error('❌ Error creating profile:', error);
        return null;
      }

      // Criar o Office (Tenant do sistema) para esse novo usuário
      console.log('🏢 Creating default office for user...');
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
        console.log('✅ Default office created:', newOfficeId);
        
        // Atrelar como Admin
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
          console.error('❌ Error linking user to new office:', linkError);
        } else {
          console.log('✅ User linked to office as admin');
        }
      } else {
         console.error('❌ Error creating default office:', officeError);
      }

      console.log('✅ Profile flow completed successfully:', data);
      return data;
    } catch (error) {
      console.error('❌ Error in createProfile:', error);
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
      // 1. SET FALLBACK USER IMMEDIATELY to unlock UI
      // Use session metadata for the fastest possible UI response
      const initialUser: User = {
        id: sessionUser.id,
        name: sessionUser.user_metadata?.full_name || sessionUser.user_metadata?.name || sessionUser.email?.split('@')[0] || 'Usuário',
        email: sessionUser.email || '',
        role: (sessionUser.email && SUPER_ADMIN_EMAILS.includes(sessionUser.email.toLowerCase().trim())) ? 'super_admin' : 'user'
      };
      
      setUser(initialUser);
      setIsLoading(false); // UI IS NOW UNLOCKED
      
      // 2. FETCH REAL DATA IN BACKGROUND
      console.log('⚡ UI unlocked with fallback user. Fetching full profile in background...');
      
      const backgroundTask = async () => {
        try {
          // Fetch profile
          let profileData = await fetchProfile(sessionUser.id);
          
          if (!mountedRef.current) return;
          
          // If profile doesn't exist, try to create it (softly)
          if (!profileData && sessionUser.email) {
            console.log('👤 Profile not found, attempting to create...');
            profileData = await createProfile(
              sessionUser.id, 
              sessionUser.email, 
              initialUser.name
            );
          }
          
          if (!mountedRef.current) return;
          
          // Fetch office data
          let officeUser = null;
          let office = null;
          
          if (profileData) {
            const officeData = await fetchOfficeData(sessionUser.id);
            officeUser = officeData.officeUser;
            office = officeData.office;
          }
          
          if (!mountedRef.current) return;
          
          // 3. Update with final data
          const finalUser: User = {
            id: sessionUser.id,
            name: profileData?.full_name || initialUser.name,
            email: sessionUser.email || profileData?.email || initialUser.email,
            role: profileData?.role || initialUser.role,
            office_id: profileData?.office_id || officeUser?.office_id || null,
            office_role: officeUser?.role || null
          };
          
          console.log('✅ Background sync completed');
          setProfile(profileData);
          setOfficeUser(officeUser);
          setOffice(office);
          setUser(finalUser);
          
          if (profileData) {
            const profileAge = Date.now() - new Date(profileData.created_at).getTime();
            setIsFirstLogin(profileAge < 60000 && profileData.role !== 'super_admin');
          }
        } catch (bgError) {
          console.error('❌ Background sync error:', bgError);
        }
      };
      
      // Execute in background
      backgroundTask();
      
    } catch (error) {
      console.error('❌ Critical error in processUserData:', error);
      setIsLoading(false);
    }
  }, [fetchProfile, createProfile, fetchOfficeData]);

  // Handle auth state change
  const handleAuthStateChange = useCallback(async (event: string, newSession: Session | null) => {
    if (!mountedRef.current) return;
    
    // Auth state changed logic
    console.log('🔐 Previous session:', !!session);
    console.log('🔐 New session:', !!newSession);
    
    setSession(newSession);
    
    if (newSession?.user) {
      await processUserData(newSession.user);
    } else {
      // No session
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
          console.log('Session found:', currentSession.user.email);
          await processUserData(currentSession.user);
        } else {
          console.log('No session found during init');
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
    console.log('🔐 Login process started for:', email);
    
    try {
      loginInProgressRef.current = true;
      // Login attempt
      
      const { data, error } = await Promise.race([
        supabase.auth.signInWithPassword({
          email,
          password,
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Login attempt timeout')), 20000))
      ]) as any;

      console.log('🔐 Raw login response:', {
        data: data ? {
          user: data.user ? {
            id: data.user.id,
            email: data.user.email,
            role: data.user.role,
            user_metadata: data.user.user_metadata,
            app_metadata: data.user.app_metadata
          } : null,
          session: data.session ? {
            access_token: data.session.access_token ? 'exists' : 'missing',
            user: data.session.user ? {
              id: data.session.user.id,
              email: data.session.user.email,
              role: data.session.user.role,
              user_metadata: data.session.user.user_metadata,
              app_metadata: data.session.user.app_metadata
            } : null
          } : null
        } : null,
        error: error ? {
          message: error.message,
          status: error.status
        } : null
      });

      if (error) {
        console.error('❌ Login error:', error);
        console.error('❌ Error details:', {
          message: error.message,
          status: error.status,
          name: error.name
        });
        
        // Se for erro 400, pode ser problema de credenciais ou formato
        if (error.status === 400) {
          console.error('❌ 400 Bad Request - possível problema de credenciais ou formato');
        }
        
        return { error };
      }

      console.log('✅ Login successful for:', email);
      console.log('✅ User data from login:', data.user);
      console.log('✅ Session data from login:', data.session);
      
      // Aguardar um pouco para garantir que o auth state change seja processado
      if (data.session) {
        console.log('🔐 Session established, processing user data...');
        
        // Processar dados do usuário imediatamente
        await processUserData(data.user);
        
        // Aguardar confirmação de que o estado foi atualizado
        let attempts = 0;
        const maxAttempts = 20;
        
        while (attempts < maxAttempts && !session && !user) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }
        
        // Login process completed
      }

      return { error: null };
    } catch (err) {
      console.error('❌ Unexpected login error:', err);
      return { error: err };
    } finally {
      // Reset the flag after a small delay to prevent immediate re-attempts
      setTimeout(() => {
        loginInProgressRef.current = false;
      }, 1000);
    }
  };

  const register = async (email: string, password: string, fullName: string) => {
    console.log('Attempting registration for:', email);
    
    // Get current URL for redirect
    const currentUrl = window.location.origin;
    
    const { data, error } = await supabase.auth.signUp({
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
    } else {
      console.log('Registration successful for:', email);
      console.log('Confirmation email should be sent to:', email);
    }

    return { error };
  };

  const resendConfirmation = async (email: string) => {
    console.log('Resending confirmation email for:', email);
    
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
      console.log('Confirmation email resent to:', email);
    }

    return { error };
  };

  const loginAsSuperAdmin = async (email: string, password: string) => {
    try {
      console.log('🔐 Attempting super admin login for:', email);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        console.error('❌ Super admin login error:', error);
        return { error };
      }

      console.log('✅ Super admin login successful');
      return { error: null };
    } catch (error) {
      console.error('❌ Super admin login exception:', error);
      return { error };
    }
  };

  // Função para forçar atualização do role do usuário
  const updateUserRole = useCallback(async (userId: string, newRole: 'user' | 'admin' | 'super_admin') => {
    try {
      console.log('🔧 Updating user role:', userId, 'to:', newRole);
      
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
        console.error('❌ Error updating user role:', error);
        return { error };
      }

      console.log('✅ User role updated successfully:', data);
      
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
      console.error('❌ Error in updateUserRole:', error);
      return { error };
    }
  }, [user?.id, fetchProfile]);

  // Função de debug para verificar status do usuário
  const debugUserStatus = useCallback(() => {
    const isUserSuperAdmin = user?.role === 'super_admin' || profile?.role === 'super_admin';
    console.log('🔍 Debug User Status:', {
      user,
      profile,
      session,
      isAuthenticated: !!session,
      isSuperAdmin: isUserSuperAdmin,
      userRole: user?.role,
      profileRole: profile?.role
    });
  }, [user, profile, session]);

  // Função para determinar redirecionamento baseado no role do usuário
  const getRedirectPath = useCallback((userRole: string | undefined, userEmail: string | undefined) => {
    console.log('🔄 Determining redirect path:', { userRole, userEmail });
    
    // Verificar se é admin do sistema (baseado em email)
    const isSystemAdmin = userEmail && SUPER_ADMIN_EMAILS.includes(userEmail.toLowerCase().trim());
    
    if (isSystemAdmin) {
      console.log('🔄 Redirecting to global admin panel');
      return '/admin';
    }
    
    // Redirecionamento baseado no role normal
    switch (userRole) {
      case 'admin':
        console.log('🔄 Redirecting to admin panel');
        return '/admin';
      case 'user':
      default:
        console.log('🔄 Redirecting to dashboard');
        return '/dashboard';
    }
  }, []);

  const logout = async () => {
    console.log('Logging out user');
    try {
      // Tentar o signOut oficial do Supabase com timeout de 2s para não travar o usuário
      await Promise.race([
        supabase.auth.signOut(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Logout timeout')), 2000))
      ]);
      console.log('✅ Supabase signOut call finished');
    } catch (err) {
      console.error('❌ Exception during supabase.auth.signOut:', err);
    } finally {
      // FORÇAR LIMPEZA - Não importa o que aconteça acima
      setUser(null);
      setProfile(null);
      setSession(null);
      setOffice(null);
      setOfficeUser(null);
      setIsFirstLogin(false);
      
      console.log('✅ Local state cleared, redirecting to login');
      
      // Limpar tokens residuais do localStorage (Double security)
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
      console.log('🔄 Manually refreshing profile data...');
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
