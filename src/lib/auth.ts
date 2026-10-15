// Regras puras de autenticação/papéis (extraídas de contexts/AuthContext.tsx —
// código idêntico; aqui dá pra testar sem montar o provider).
import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { Profile, OfficeUser } from '@/types/database';

// Teto para esperar perfil + escritório antes de liberar a tela. Precisa ficar abaixo
// dos 8 s em que o PrivateRoute desiste e manda para /login (ver processUserData).
export const OFFICE_LOAD_CAP_MS = 6000;
/** Só para testes encurtarem o teto; em produção vale OFFICE_LOAD_CAP_MS. */
export const AUTH_TIMING = { officeLoadCapMs: OFFICE_LOAD_CAP_MS };

export const SUPER_ADMIN_EMAILS = (
  import.meta.env.VITE_SUPER_ADMIN_EMAILS || 'contato@vextriahub.com.br'
).split(',').map((e: string) => e.toLowerCase().trim());

export const isSuperAdminEmail = (email?: string | null) =>
  !!email && SUPER_ADMIN_EMAILS.includes(email.toLowerCase().trim());

// Promise.race com um timeout rejeitado — mantém o tipo do resultado (antes era `as any`).
export const comTimeout = <T,>(p: PromiseLike<T>, ms: number, msg: string): Promise<T> =>
  Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error(msg)), ms))]);
export const comoError = (e: unknown): Error => (e instanceof Error ? e : new Error(String(e)));

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin' | 'super_admin';
  office_id?: string | null;
  office_role?: 'user' | 'admin' | 'owner' | 'super_admin' | null;
}

/** Usuário provisório montado só com a sessão, antes do perfil chegar. */
export function usuarioInicial(sessionUser: SupabaseUser): User {
  return {
    id: sessionUser.id,
    name: sessionUser.user_metadata?.full_name || sessionUser.user_metadata?.name || sessionUser.email?.split('@')[0] || 'Usuário',
    email: sessionUser.email || '',
    role: isSuperAdminEmail(sessionUser.email) ? 'super_admin' : 'user',
  };
}

/** Usuário completo: perfil + vínculo com escritório por cima do provisório. */
export function usuarioFinal(
  sessionUser: SupabaseUser,
  initialUser: User,
  profileData: Profile | null,
  officeUser: OfficeUser | null,
): User {
  return {
    id: sessionUser.id,
    name: profileData?.full_name || initialUser.name,
    email: sessionUser.email || profileData?.email || initialUser.email,
    role: profileData?.role || initialUser.role,
    office_id: profileData?.office_id || officeUser?.office_id || null,
    office_role: officeUser?.role || null,
  };
}

/** Primeiro login = perfil criado há menos de 1 min (super admin nunca vê onboarding). */
export const ehPrimeiroLogin = (profile: Profile, agora = Date.now()) =>
  agora - new Date(profile.created_at).getTime() < 60000 && profile.role !== 'super_admin';

/** Flags de papel expostas pelo contexto, derivadas de user/profile/sessão. */
export function derivarPapeis(user: User | null, profile: Profile | null, sessionEmail?: string | null) {
  const isSuperAdmin = Boolean(
    user?.role === 'super_admin' ||
    profile?.role === 'super_admin' ||
    isSuperAdminEmail(user?.email) ||
    isSuperAdminEmail(sessionEmail)
  );
  return {
    isSuperAdmin,
    isAdmin: user?.role === 'admin' || user?.role === 'super_admin' || profile?.role === 'admin' || profile?.role === 'super_admin' || isSuperAdmin,
    isOfficeAdmin: user?.office_role === 'admin' || user?.office_role === 'owner' || user?.office_role === 'super_admin' || user?.role === 'super_admin' || profile?.role === 'super_admin',
  };
}

// Destino após o login. Só o super admin do sistema (lista global de e-mails)
// cai no painel de administração; admin de escritório e usuário comum vão
// para o Dashboard, que é a tela de trabalho — o /admin continua acessível
// pelo menu. (O role 'super_admin' no profile é derivado da mesma lista.)
export function getRedirectPath(userRole: string | undefined, userEmail: string | undefined) {
  if (isSuperAdminEmail(userEmail) || userRole === 'super_admin') {
    return '/admin';
  }
  return '/dashboard';
}

// Chaves de sessões antigas (pré-Supabase / marca anterior) limpas na inicialização.
export const OLD_LOCAL_STORAGE_KEYS = [
  'authToken', 'userData', 'loginTimestamp', 'isFirstLogin',
  'nublex_token', 'nublex_user', 'nublex_data',
];
