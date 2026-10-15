// AuthContext: a tela só é liberada (isLoading=false) depois que perfil e escritório
// chegaram — nunca mais um `user` sem office_id com a tela já aberta (RLS → 403 no
// E2E de 09/10/2026). Com teto: se o perfil demorar demais, libera mesmo assim antes
// do PrivateRoute desistir. E recarregar o perfil do mesmo usuário não zera `user`.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, cleanup, act } from '@testing-library/react';

type Resposta = { data: unknown; error: unknown };
let perfil: Promise<Resposta>;
let liberarPerfil: (r: Resposta) => void;
const sessao = { user: { id: 'u1', email: 'ana@x.com', user_metadata: { full_name: 'Ana' } } };
let listener: ((evento: string, s: typeof sessao | null) => void) | null = null;

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: sessao }, error: null })),
      onAuthStateChange: vi.fn((cb: typeof listener) => { listener = cb; return { data: { subscription: { unsubscribe: vi.fn() } } }; }),
    },
    from: vi.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle: () => perfil }) }) })),
    rpc: vi.fn(async () => ({ data: null, error: null })),
  },
}));
vi.mock('@/services/officeService', () => ({
  officeService: { getOfficeData: vi.fn(async () => ({ officeUser: { office_id: 'o1', role: 'admin' }, office: { id: 'o1', name: 'Escritório' } })) },
}));
// Função estável: o contexto a usa como dependência de useCallback/useEffect — uma
// função nova por render realimentava o efeito de validação em loop.
const { validatePaymentMock } = vi.hoisted(() => ({
  validatePaymentMock: vi.fn(async () => ({ needsPayment: false, daysRegistered: 1, hasActiveSubscription: true, paymentStatus: 'ok', message: '' })),
}));
vi.mock('@/hooks/usePaymentValidation', () => ({ usePaymentValidation: () => ({ validatePayment: validatePaymentMock }) }));
vi.mock('@/lib/monitoring', () => ({ setMonitoringUser: vi.fn(), captureError: vi.fn() }));

import { AuthProvider, useAuth, OFFICE_LOAD_CAP_MS, AUTH_TIMING } from '@/contexts/AuthContext';

const renders: Array<{ isLoading: boolean; office: string | null | undefined; nome?: string }> = [];
function Consumidor() {
  const { isLoading, user, refreshProfile } = useAuth();
  renders.push({ isLoading, office: user?.office_id, nome: user?.name });
  return (
    <div>
      <span data-testid="estado">{isLoading ? 'carregando' : 'pronto'}</span>
      <span data-testid="office">{user?.office_id ?? 'sem'}</span>
      <button onClick={() => refreshProfile()}>refresh</button>
    </div>
  );
}

describe('AuthContext — escritório antes de renderizar', () => {
  beforeEach(() => {
    renders.length = 0;
    perfil = new Promise<Resposta>((resolve) => { liberarPerfil = resolve; });
  });
  afterEach(() => { cleanup(); AUTH_TIMING.officeLoadCapMs = OFFICE_LOAD_CAP_MS; });

  it('isLoading só libera depois do perfil/escritório: nenhum render com tela pronta e office_id vazio', async () => {
    render(<AuthProvider><Consumidor /></AuthProvider>);
    expect(screen.getByTestId('estado').textContent).toBe('carregando');
    // perfil ainda não chegou → continua carregando (mesmo com a sessão já conhecida)
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.getByTestId('estado').textContent).toBe('carregando');

    liberarPerfil({ data: { user_id: 'u1', full_name: 'Ana Silva', role: 'user', office_id: 'o1', created_at: '2026-01-01' }, error: null });
    await waitFor(() => expect(screen.getByTestId('estado').textContent).toBe('pronto'));
    expect(screen.getByTestId('office').textContent).toBe('o1');
    expect(renders.filter((r) => !r.isLoading && !r.office)).toEqual([]);
  });

  it('perfil que não responde: libera no teto, antes do PrivateRoute desistir (8 s)', async () => {
    AUTH_TIMING.officeLoadCapMs = 60;
    const inicio = Date.now();
    render(<AuthProvider><Consumidor /></AuthProvider>);
    expect(screen.getByTestId('estado').textContent).toBe('carregando');
    await waitFor(() => expect(screen.getByTestId('estado').textContent).toBe('pronto'), { timeout: 2000 });
    expect(Date.now() - inicio).toBeGreaterThanOrEqual(55);
    // perfil nunca chegou: usuário provisório, sem office_id, mas a tela não fica presa
    expect(screen.getByTestId('office').textContent).toBe('sem');
    expect(OFFICE_LOAD_CAP_MS).toBeLessThan(8000);
  });

  it('refreshProfile do mesmo usuário não passa por um user sem office_id', async () => {
    render(<AuthProvider><Consumidor /></AuthProvider>);
    liberarPerfil({ data: { user_id: 'u1', full_name: 'Ana Silva', role: 'user', office_id: 'o1', created_at: '2026-01-01' }, error: null });
    await waitFor(() => expect(screen.getByTestId('estado').textContent).toBe('pronto'));
    // sessão precisa estar no contexto para o refreshProfile ter o que reprocessar
    act(() => { listener?.('SIGNED_IN', sessao); });
    await waitFor(() => expect(screen.getByTestId('office').textContent).toBe('o1'));
    renders.length = 0;

    perfil = new Promise<Resposta>((resolve) => { liberarPerfil = resolve; });
    act(() => { screen.getByText('refresh').click(); });
    await new Promise((r) => setTimeout(r, 30));
    liberarPerfil({ data: { user_id: 'u1', full_name: 'Ana Silva Prado', role: 'user', office_id: 'o1', created_at: '2026-01-01' }, error: null });
    await waitFor(() => expect(renders.some((r) => r.nome === 'Ana Silva Prado')).toBe(true));
    expect(renders.filter((r) => !r.office)).toEqual([]);
  });
});
