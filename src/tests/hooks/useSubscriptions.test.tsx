// useSubscriptions: mapeia office_subscriptions (Asaas) pro formato das métricas,
// filtra pelo escritório quando não é super admin e expõe erro de carga.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { enfileirar, chamadasCom, resetSupabaseMock } from '../helpers/supabaseMock';

vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabase } = await import('../helpers/supabaseMock');
  return { supabase: mockSupabase };
});
const auth = { office: { id: 'o1' } as { id: string } | null, isSuperAdmin: false };
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));

import { useSubscriptions } from '@/hooks/useSubscriptions';

describe('useSubscriptions', () => {
  beforeEach(() => { resetSupabaseMock(); auth.office = { id: 'o1' }; auth.isSuperAdmin = false; });

  it('mapeia status/valor e restringe ao escritório do usuário comum', async () => {
    enfileirar('office_subscriptions', { data: [
      { office_id: 'o1', status: 'ativa', value: '149.90', plan_name: 'pro', next_due_date: '2026-11-01', office: { name: 'Dantas', email: 'x@y' } },
      { office_id: 'o1', status: 'cortesia', value: null, plan_name: null, next_due_date: null, office: null },
    ] });
    const { result } = renderHook(() => useSubscriptions());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.subscriptions).toEqual([
      { office_id: 'o1', status: 'active', price: 149.9, plan: 'pro', next_due_date: '2026-11-01', office: { name: 'Dantas', email: 'x@y' } },
      { office_id: 'o1', status: 'courtesy', price: 0, plan: null, next_due_date: null, office: null },
    ]);
    expect(result.current.activeSubscriptions).toHaveLength(1);
    expect(result.current.currentSubscription?.plan).toBe('pro');
    expect(result.current.isEmpty).toBe(false);
    const sel = chamadasCom('office_subscriptions', 'select')[0];
    expect(sel.ops).toEqual(expect.arrayContaining([['eq', ['office_id', 'o1']]]));
  });

  it('super admin lista todos os escritórios (sem filtro de office_id)', async () => {
    auth.isSuperAdmin = true;
    enfileirar('office_subscriptions', { data: [{ office_id: 'o2', status: 'atrasada', value: 10 }] });
    const { result } = renderHook(() => useSubscriptions());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.subscriptions[0].status).toBe('past_due');
    expect(result.current.currentSubscription).toBeUndefined();
    const sel = chamadasCom('office_subscriptions', 'select')[0];
    expect(sel.ops.some(([m]) => m === 'eq')).toBe(false);
  });

  it('erro do banco vira `error` sem derrubar a lista', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    enfileirar('office_subscriptions', { error: { message: 'boom' } });
    const { result } = renderHook(() => useSubscriptions());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Erro ao carregar assinaturas');
    expect(result.current.subscriptions).toEqual([]);
    expect(result.current.currentSubscription).toBeUndefined();
  });
});
