// useResponseTime: média (h) entre cadastro do cliente e o primeiro atendimento.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { enfileirar, chamadasCom, resetSupabaseMock } from '../helpers/supabaseMock';

vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabase } = await import('../helpers/supabaseMock');
  return { supabase: mockSupabase };
});
const auth = { user: { id: 'u1', office_id: 'o1' } as { id: string; office_id: string | null } };
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));

import { useResponseTime } from '@/hooks/useResponseTime';

describe('useResponseTime', () => {
  beforeEach(() => { resetSupabaseMock(); auth.user = { id: 'u1', office_id: 'o1' }; });

  it('usa o PRIMEIRO atendimento de cada cliente, ignora quem não teve e intervalos negativos', async () => {
    enfileirar('clientes', { data: [
      { id: 'c1', created_at: '2026-10-01T00:00:00Z' }, { id: 'c2', created_at: '2026-10-01T00:00:00Z' },
      { id: 'c3', created_at: '2026-10-05T00:00:00Z' }, { id: 'c4', created_at: '2026-10-01T00:00:00Z' },
    ] });
    enfileirar('atendimentos', { data: [
      { cliente_id: 'c1', data_atendimento: '2026-10-01T10:00:00Z' }, { cliente_id: 'c1', data_atendimento: '2026-10-01T02:00:00Z' }, // 2h
      { cliente_id: 'c2', data_atendimento: null, created_at: '2026-10-03T00:00:00Z' }, // 48h
      { cliente_id: 'c3', data_atendimento: '2026-10-04T00:00:00Z' }, // negativo: ignora
      { cliente_id: null, data_atendimento: '2026-10-02T00:00:00Z' },
    ] });
    const { result } = renderHook(() => useResponseTime());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.horas).toBe(25);
    expect(result.current.label).toBe('25h');
    expect(chamadasCom('clientes', 'select')[0].ops).toEqual(expect.arrayContaining([['eq', ['office_id', 'o1']], ['eq', ['deletado', false]]]));
  });

  it('rótulo em dias acima de 48h; sem dados devolve null/"—"', async () => {
    enfileirar('clientes', { data: [{ id: 'c1', created_at: '2026-10-01T00:00:00Z' }] });
    enfileirar('atendimentos', { data: [{ cliente_id: 'c1', data_atendimento: '2026-10-04T00:00:00Z' }] });
    const { result } = renderHook(() => useResponseTime());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.horas).toBe(72);
    expect(result.current.label).toBe('3 dias');

    resetSupabaseMock();
    enfileirar('clientes', { data: [] });
    enfileirar('atendimentos', { data: [] });
    const { result: r2 } = renderHook(() => useResponseTime());
    await waitFor(() => expect(r2.current.loading).toBe(false));
    expect(r2.current.horas).toBeNull();
    expect(r2.current.label).toBe('—');
  });
});
