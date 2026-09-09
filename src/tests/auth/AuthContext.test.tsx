// Testes de AuthContext — a área que já causou um bug real de produção (parte 12:
// admin de escritório caía sempre em /admin, nunca via o próprio dashboard) por
// causa exatamente da corrida entre o role PROVISÓRIO liberado na hora (processUserData)
// e o role REAL que só chega depois, em background (fetchProfile). Estes testes travam
// essa corrida e a lógica de redirecionamento/roles que dependem dela.
import React, { useEffect } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';

// ── Mock do client Supabase ────────────────────────────────────────────────
// Um "builder" genérico por tabela: cobre profiles (AuthContext + usePaymentValidation),
// office_users (officeService) e office_subscriptions (usePaymentValidation) com a mesma
// cadeia .select().eq()...maybeSingle()/.single(), igual ao padrão já usado em
// useProcessoSubData.test.tsx. Tudo que o mock factory usa precisa vir de vi.hoisted
// (o vi.mock é hoisted acima de qualquer import/const normal do arquivo — variáveis
// declaradas fora disso não existem ainda quando a factory roda).
const hoisted = vi.hoisted(() => ({
  mockTableData: {} as Record<string, any>,
  authChangeCallback: null as ((event: string, session: any) => void) | null,
  mockSignInWithPassword: vi.fn(),
  mockSignOut: vi.fn(async () => ({ error: null })),
  mockRpc: vi.fn(async () => ({ data: null, error: null })),
  mockGetSession: vi.fn(async () => ({ data: { session: null }, error: null })),
}));
const { mockTableData, mockSignInWithPassword, mockSignOut, mockRpc, mockGetSession } = hoisted;

vi.mock('@/integrations/supabase/client', () => {
  const makeBuilder = (table: string) => {
    const b: any = {};
    for (const m of ['select', 'eq', 'order', 'in', 'or']) b[m] = vi.fn(() => b);
    b.maybeSingle = vi.fn(() => Promise.resolve({ data: hoisted.mockTableData[table] ?? null, error: null }));
    b.single = vi.fn(() => Promise.resolve({ data: hoisted.mockTableData[table] ?? null, error: null }));
    b.insert = vi.fn(() => ({
      select: () => ({ single: () => Promise.resolve({ data: hoisted.mockTableData[table] ?? null, error: null }) }),
    }));
    return b;
  };
  return {
    supabase: {
      auth: {
        getSession: hoisted.mockGetSession,
        onAuthStateChange: vi.fn((cb: any) => {
          hoisted.authChangeCallback = cb;
          return { data: { subscription: { unsubscribe: vi.fn() } } };
        }),
        signInWithPassword: hoisted.mockSignInWithPassword,
        signOut: hoisted.mockSignOut,
      },
      from: vi.fn((table: string) => makeBuilder(table)),
      rpc: hoisted.mockRpc,
    },
  };
});

import { AuthProvider, useAuth } from '@/contexts/AuthContext';

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeSupabaseUser(overrides: Record<string, any> = {}) {
  return {
    id: 'user-1',
    email: 'joao@escritorio.com',
    user_metadata: { full_name: 'João' },
    ...overrides,
  };
}

function makeSession(user: any) {
  return { user, access_token: 'tok-1' };
}

let latestAuth: ReturnType<typeof useAuth> | null = null;

function Probe() {
  const auth = useAuth();
  useEffect(() => {
    latestAuth = auth;
  });
  return (
    <div>
      <span data-testid="loading">{String(auth.isLoading)}</span>
      <span data-testid="role">{auth.user?.role ?? 'none'}</span>
      <span data-testid="isSuperAdmin">{String(auth.isSuperAdmin)}</span>
      <span data-testid="isOfficeAdmin">{String(auth.isOfficeAdmin)}</span>
      <span data-testid="officeId">{auth.user?.office_id ?? 'none'}</span>
    </div>
  );
}

function PathProbe() {
  const location = useLocation();
  return <span data-testid="path">{location.pathname}</span>;
}

function renderAuth(initialPath = '/dashboard') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <Probe />
        <PathProbe />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    for (const k of Object.keys(mockTableData)) delete mockTableData[k];
    hoisted.authChangeCallback = null;
    latestAuth = null;
    mockSignInWithPassword.mockReset();
    mockSignOut.mockClear();
    mockRpc.mockClear();
    mockGetSession.mockClear();
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
  });

  describe('getRedirectPath', () => {
    it('role admin vai pra /admin, role user (ou ausente) vai pra /dashboard', async () => {
      renderAuth();
      await waitFor(() => expect(latestAuth).toBeTruthy());

      expect(latestAuth!.getRedirectPath('admin', 'joao@escritorio.com')).toBe('/admin');
      expect(latestAuth!.getRedirectPath('user', 'joao@escritorio.com')).toBe('/dashboard');
      expect(latestAuth!.getRedirectPath(undefined, 'joao@escritorio.com')).toBe('/dashboard');
    });

    it('e-mail da lista global de super admin manda pra /admin mesmo com role "user"', async () => {
      renderAuth();
      await waitFor(() => expect(latestAuth).toBeTruthy());

      // contato@vextriahub.com.br é o default de SUPER_ADMIN_EMAILS quando
      // VITE_SUPER_ADMIN_EMAILS não está setado.
      expect(latestAuth!.getRedirectPath('user', 'contato@vextriahub.com.br')).toBe('/admin');
    });
  });

  describe('processUserData — a corrida entre o role provisório e o role real', () => {
    it('libera a UI com role provisório "user" e corrige pra "admin" assim que o profile real chega', async () => {
      mockTableData['profiles'] = {
        user_id: 'user-1',
        role: 'admin',
        full_name: 'João',
        email: 'joao@escritorio.com',
        office_id: 'office-1',
        created_at: new Date(Date.now() - 3600_000).toISOString(),
      };
      mockTableData['office_users'] = {
        user_id: 'user-1',
        office_id: 'office-1',
        role: 'admin',
        active: true,
        office: { id: 'office-1', name: 'Escritório Teste' },
      };

      renderAuth();
      await waitFor(() => expect(latestAuth?.isLoading).toBe(false));
      // Sem sessão nenhuma ainda: usuário não autenticado.
      expect(screen.getByTestId('role').textContent).toBe('none');

      const sbUser = makeSupabaseUser();
      await act(async () => {
        hoisted.authChangeCallback?.('SIGNED_IN', makeSession(sbUser));
      });

      // Role provisório: 'user' (e-mail não está em SUPER_ADMIN_EMAILS), liberado
      // ANTES do profile real ser buscado — é essa janela que causou o bug da parte 12.
      // Não travamos ela numa asserção síncrona (é uma corrida real, pode já ter
      // resolvido); o que importa é que SEMPRE convirja pro role real depois.
      await waitFor(() => expect(screen.getByTestId('role').textContent).toBe('admin'));
      expect(latestAuth!.isOfficeAdmin).toBe(true);
      expect(latestAuth!.isAdmin).toBe(true);
      expect(latestAuth!.isSuperAdmin).toBe(false);
    });

    it('sem profile e sem office: usuário autenticado permanece role "user", isOfficeAdmin false', async () => {
      mockTableData['profiles'] = null;
      mockTableData['office_users'] = null;

      renderAuth();
      await waitFor(() => expect(latestAuth?.isLoading).toBe(false));

      const sbUser = makeSupabaseUser({ email: 'sememail@escritorio.com' });
      await act(async () => {
        hoisted.authChangeCallback?.('SIGNED_IN', makeSession(sbUser));
      });

      await waitFor(() => expect(screen.getByTestId('role').textContent).toBe('user'));
      expect(latestAuth!.isOfficeAdmin).toBe(false);
      expect(latestAuth!.isSuperAdmin).toBe(false);
    });
  });

  describe('TOKEN_REFRESHED — não deve zerar o dashboard ao voltar de aba', () => {
    it('mantém user.office_id intacto quando o supabase-js renova o token do MESMO usuário já carregado', async () => {
      mockTableData['profiles'] = {
        user_id: 'user-1',
        role: 'admin',
        full_name: 'João',
        email: 'joao@escritorio.com',
        office_id: 'office-1',
        created_at: new Date().toISOString(),
      };
      mockTableData['office_users'] = {
        user_id: 'user-1',
        office_id: 'office-1',
        role: 'admin',
        active: true,
        office: { id: 'office-1', name: 'Escritório Teste' },
      };

      renderAuth();
      await waitFor(() => expect(latestAuth?.isLoading).toBe(false));

      const sbUser = makeSupabaseUser();
      await act(async () => {
        hoisted.authChangeCallback?.('SIGNED_IN', makeSession(sbUser));
      });
      await waitFor(() => expect(screen.getByTestId('officeId').textContent).toBe('office-1'));

      // TOKEN_REFRESHED do MESMO usuário — é o que o supabase-js dispara sozinho
      // quando a aba volta a ficar visível. Antes do fix, isso reexecutava
      // processUserData, cujo PRIMEIRO passo (síncrono, antes de qualquer await)
      // é setUser(initialUser) com um objeto SEM office_id — zerando o dashboard
      // por um instante, até o fetch em background (assíncrono) devolver o
      // usuário completo. Por isso o dispatch aqui é síncrono (act não-async):
      // pega o estado logo após o passo síncrono, antes do fetch em background
      // ter chance de resolver e mascarar a regressão.
      act(() => {
        hoisted.authChangeCallback?.('TOKEN_REFRESHED', makeSession(sbUser));
      });
      expect(screen.getByTestId('officeId').textContent).toBe('office-1');
      expect(screen.getByTestId('role').textContent).toBe('admin');

      // Deixa qualquer microtask pendente assentar antes do teste terminar.
      await act(async () => { await Promise.resolve(); });
    });

    it('mantém user.office_id intacto quando o supabase-js dispara SIGNED_IN de novo pro MESMO usuário (fluxo de recuperação de sessão)', async () => {
      // O @supabase/auth-js não dispara só TOKEN_REFRESHED na volta de
      // visibilidade — o caminho de recuperação de sessão com "proxy user"
      // (_recoverAndRefresh) pode disparar SIGNED_IN pro MESMO usuário. Uma
      // guarda que checasse só o nome do evento (em vez do id do usuário)
      // deixaria esse caminho passar direto e reproduzir o mesmo bug.
      mockTableData['profiles'] = {
        user_id: 'user-1',
        role: 'admin',
        full_name: 'João',
        email: 'joao@escritorio.com',
        office_id: 'office-1',
        created_at: new Date().toISOString(),
      };
      mockTableData['office_users'] = {
        user_id: 'user-1',
        office_id: 'office-1',
        role: 'admin',
        active: true,
        office: { id: 'office-1', name: 'Escritório Teste' },
      };

      renderAuth();
      await waitFor(() => expect(latestAuth?.isLoading).toBe(false));

      const sbUser = makeSupabaseUser();
      await act(async () => {
        hoisted.authChangeCallback?.('SIGNED_IN', makeSession(sbUser));
      });
      await waitFor(() => expect(screen.getByTestId('officeId').textContent).toBe('office-1'));

      act(() => {
        hoisted.authChangeCallback?.('SIGNED_IN', makeSession(sbUser));
      });
      expect(screen.getByTestId('officeId').textContent).toBe('office-1');
      expect(screen.getByTestId('role').textContent).toBe('admin');

      await act(async () => { await Promise.resolve(); });
    });
  });

  describe('isSuperAdmin', () => {
    it('e-mail da lista global vale mesmo com role "user" no profile (super admin do sistema)', async () => {
      mockTableData['profiles'] = {
        user_id: 'user-1',
        role: 'user',
        full_name: 'Admin Geral',
        email: 'contato@vextriahub.com.br',
        office_id: null,
        created_at: new Date().toISOString(),
      };
      mockTableData['office_users'] = null;

      renderAuth();
      await waitFor(() => expect(latestAuth?.isLoading).toBe(false));

      const sbUser = makeSupabaseUser({ email: 'contato@vextriahub.com.br' });
      await act(async () => {
        hoisted.authChangeCallback?.('SIGNED_IN', makeSession(sbUser));
      });

      await waitFor(() => expect(screen.getByTestId('isSuperAdmin').textContent).toBe('true'));
    });

    it('role super_admin no profile vale mesmo com e-mail fora da lista global', async () => {
      mockTableData['profiles'] = {
        user_id: 'user-1',
        role: 'super_admin',
        full_name: 'Dono do Escritório',
        email: 'dono@escritorio.com',
        office_id: 'office-1',
        created_at: new Date().toISOString(),
      };
      mockTableData['office_users'] = null;

      renderAuth();
      await waitFor(() => expect(latestAuth?.isLoading).toBe(false));

      const sbUser = makeSupabaseUser({ email: 'dono@escritorio.com' });
      await act(async () => {
        hoisted.authChangeCallback?.('SIGNED_IN', makeSession(sbUser));
      });

      await waitFor(() => expect(screen.getByTestId('isSuperAdmin').textContent).toBe('true'));
    });
  });

  describe('login', () => {
    it('sucesso: processa a sessão retornada e autentica o usuário', async () => {
      mockTableData['profiles'] = {
        user_id: 'user-1',
        role: 'user',
        full_name: 'João',
        email: 'joao@escritorio.com',
        office_id: null,
        created_at: new Date().toISOString(),
      };
      mockTableData['office_users'] = null;

      const sbUser = makeSupabaseUser();
      mockSignInWithPassword.mockResolvedValue({
        data: { user: sbUser, session: makeSession(sbUser) },
        error: null,
      });

      renderAuth();
      await waitFor(() => expect(latestAuth?.isLoading).toBe(false));

      let result: { error: any } | undefined;
      await act(async () => {
        result = await latestAuth!.login('joao@escritorio.com', 'senha123');
      });

      expect(result!.error).toBeNull();
      await waitFor(() => expect(screen.getByTestId('role').textContent).toBe('user'));
    });

    it('erro: devolve o erro e não autentica ninguém', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' },
      });

      renderAuth();
      await waitFor(() => expect(latestAuth?.isLoading).toBe(false));

      let result: { error: any } | undefined;
      await act(async () => {
        result = await latestAuth!.login('joao@escritorio.com', 'senha-errada');
      });

      expect(result!.error).toBeTruthy();
      expect(screen.getByTestId('role').textContent).toBe('none');
    });
  });

  describe('logout', () => {
    it('limpa o usuário/sessão e navega pra /login', async () => {
      mockTableData['profiles'] = {
        user_id: 'user-1',
        role: 'admin',
        full_name: 'João',
        email: 'joao@escritorio.com',
        office_id: 'office-1',
        created_at: new Date().toISOString(),
      };
      mockTableData['office_users'] = {
        user_id: 'user-1',
        office_id: 'office-1',
        role: 'admin',
        active: true,
        office: { id: 'office-1', name: 'Escritório Teste' },
      };

      renderAuth('/dashboard');
      await waitFor(() => expect(latestAuth?.isLoading).toBe(false));

      const sbUser = makeSupabaseUser();
      await act(async () => {
        hoisted.authChangeCallback?.('SIGNED_IN', makeSession(sbUser));
      });
      await waitFor(() => expect(screen.getByTestId('role').textContent).toBe('admin'));

      await act(async () => {
        await latestAuth!.logout();
      });

      expect(screen.getByTestId('role').textContent).toBe('none');
      expect(latestAuth!.isAuthenticated).toBe(false);
      await waitFor(() => expect(screen.getByTestId('path').textContent).toBe('/login'));
    });
  });
});
