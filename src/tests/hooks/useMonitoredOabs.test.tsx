// useMonitoredOabs: lista por escritório e erro exposto (não vira "nenhuma OAB").
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { enfileirar, chamadasCom, resetSupabaseMock } from '../helpers/supabaseMock';

vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabase } = await import('../helpers/supabaseMock');
  return { supabase: mockSupabase };
});
const auth = { user: { id: 'u1', office_id: 'o1' } as { id: string; office_id: string | null } };
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));

import { useMonitoredOabs } from '@/hooks/useMonitoredOabs';

describe('useMonitoredOabs', () => {
  beforeEach(() => { resetSupabaseMock(); auth.user = { id: 'u1', office_id: 'o1' }; });

  it('lista as OABs do escritório na ordem de cadastro', async () => {
    enfileirar('monitored_oabs', { data: [{ id: 'm1', oab: '43718', uf: 'DF', label: null }] });
    const { result } = renderHook(() => useMonitoredOabs());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.oabs).toEqual([{ id: 'm1', oab: '43718', uf: 'DF', label: null }]);
    const sel = chamadasCom('monitored_oabs', 'select')[0];
    expect(sel.ops).toEqual(expect.arrayContaining([['eq', ['office_id', 'o1']], ['order', ['created_at']]]));
  });

  it('erro vira `error` com lista vazia; sem escritório não consulta', async () => {
    enfileirar('monitored_oabs', { error: { message: 'boom' } });
    const { result } = renderHook(() => useMonitoredOabs());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('boom');
    expect(result.current.oabs).toEqual([]);

    resetSupabaseMock();
    auth.user = { id: 'u1', office_id: null };
    const { result: r2 } = renderHook(() => useMonitoredOabs());
    await waitFor(() => expect(r2.current.loading).toBe(false));
    expect(chamadasCom('monitored_oabs', 'select')).toHaveLength(0);
  });
});
