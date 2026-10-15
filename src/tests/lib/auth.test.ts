// Regras puras de autenticação (extraídas de contexts/AuthContext.tsx): usuário
// provisório/final, papéis derivados, redirecionamento e primeiro login.
import { describe, it, expect } from 'vitest';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { Profile, OfficeUser } from '@/types/database';
import { usuarioInicial, usuarioFinal, derivarPapeis, getRedirectPath, ehPrimeiroLogin, isSuperAdminEmail, comTimeout, comoError } from '@/lib/auth';

const sessao = (over: Partial<SupabaseUser> = {}) => ({ id: 'u1', email: 'ana@x.com', user_metadata: { full_name: 'Ana' }, ...over }) as SupabaseUser;
const perfil = (over: Partial<Profile> = {}) => ({ user_id: 'u1', full_name: 'Ana Silva', email: 'ana@x.com', role: 'user', office_id: 'o1', created_at: new Date().toISOString(), ...over }) as Profile;

describe('usuarioInicial / usuarioFinal', () => {
  it('provisório: nome dos metadados (ou do e-mail), role pelo e-mail de super admin', () => {
    expect(usuarioInicial(sessao())).toEqual({ id: 'u1', name: 'Ana', email: 'ana@x.com', role: 'user' });
    expect(usuarioInicial(sessao({ user_metadata: {}, email: 'bia@y.com' })).name).toBe('bia');
    expect(usuarioInicial(sessao({ email: 'Contato@VextriaHub.com.br' })).role).toBe('super_admin');
  });

  it('final: perfil e vínculo com escritório por cima do provisório', () => {
    const inicial = usuarioInicial(sessao());
    const ou = { office_id: 'o2', role: 'admin' } as OfficeUser;
    expect(usuarioFinal(sessao(), inicial, perfil({ role: 'admin' }), ou)).toEqual({
      id: 'u1', name: 'Ana Silva', email: 'ana@x.com', role: 'admin', office_id: 'o1', office_role: 'admin',
    });
    // sem perfil nem vínculo: cai no provisório, office_id null
    expect(usuarioFinal(sessao(), inicial, null, null)).toEqual({ ...inicial, office_id: null, office_role: null });
  });
});

describe('derivarPapeis', () => {
  it('admin de escritório não é admin global nem super admin', () => {
    const user = { ...usuarioInicial(sessao()), office_role: 'admin' as const };
    expect(derivarPapeis(user, perfil(), 'ana@x.com')).toEqual({ isSuperAdmin: false, isAdmin: false, isOfficeAdmin: true });
  });

  it('super admin por e-mail da sessão implica todas as flags', () => {
    expect(derivarPapeis(null, null, 'contato@vextriahub.com.br')).toEqual({ isSuperAdmin: true, isAdmin: true, isOfficeAdmin: false });
    expect(derivarPapeis(null, perfil({ role: 'super_admin' }), null)).toEqual({ isSuperAdmin: true, isAdmin: true, isOfficeAdmin: true });
  });
});

describe('getRedirectPath / ehPrimeiroLogin / helpers', () => {
  it('só super admin do sistema vai pro /admin', () => {
    expect(getRedirectPath('admin', 'ana@x.com')).toBe('/dashboard');
    expect(getRedirectPath('super_admin', 'ana@x.com')).toBe('/admin');
    expect(getRedirectPath(undefined, 'contato@vextriahub.com.br')).toBe('/admin');
    expect(isSuperAdminEmail(undefined)).toBe(false);
  });

  it('primeiro login = perfil com menos de 1 min, nunca para super admin', () => {
    const agora = Date.now();
    expect(ehPrimeiroLogin(perfil({ created_at: new Date(agora - 30_000).toISOString() }), agora)).toBe(true);
    expect(ehPrimeiroLogin(perfil({ created_at: new Date(agora - 90_000).toISOString() }), agora)).toBe(false);
    expect(ehPrimeiroLogin(perfil({ role: 'super_admin' }), agora)).toBe(false);
  });

  it('comTimeout rejeita no teto; comoError normaliza', async () => {
    await expect(comTimeout(new Promise(() => {}), 5, 'estourou')).rejects.toThrow('estourou');
    await expect(comTimeout(Promise.resolve(7), 50, 'x')).resolves.toBe(7);
    expect(comoError('falha').message).toBe('falha');
  });
});
