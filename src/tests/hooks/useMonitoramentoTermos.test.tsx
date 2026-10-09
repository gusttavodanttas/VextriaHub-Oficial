// useMonitoramentoTermos: termos do escritório em ordem de cadastro; erro exposto.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { enfileirar, chamadasCom, resetSupabaseMock } from '../helpers/supabaseMock';

vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabase } = await import('../helpers/supabaseMock');
  return { supabase: mockSupabase };
});
const auth = { user: { id: 'u1', office_id: 'o1' } as { id: string; office_id: string | null } };
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));

import { useMonitoramentoTermos } from '@/hooks/useMonitoramentoTermos';

describe('useMonitoramentoTermos', () => {
  beforeEach(() => { resetSupabaseMock(); auth.user = { id: 'u1', office_id: 'o1' }; });

  it('lista os termos do escritório', async () => {
    const t = { id: 't1', termo: 'Fulano', tipo: 'nome', seccional: null, ativo: true, ultima_busca: null };
    enfileirar('monitoramento_termos', { data: [t] });
    const { result } = renderHook(() => useMonitoramentoTermos());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.termos).toEqual([t]);
    expect(result.current.error).toBeNull();
    expect(chamadasCom('monitoramento_termos', 'select')[0].ops).toEqual(expect.arrayContaining([['eq', ['office_id', 'o1']], ['order', ['created_at']]]));
  });

  it('erro vira `error` (não "nenhum termo"); sem escritório não consulta', async () => {
    enfileirar('monitoramento_termos', { error: { message: 'boom' } });
    const { result } = renderHook(() => useMonitoramentoTermos());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('boom');

    resetSupabaseMock();
    auth.user = { id: 'u1', office_id: null };
    const { result: r2 } = renderHook(() => useMonitoramentoTermos());
    await waitFor(() => expect(r2.current.loading).toBe(false));
    expect(chamadasCom('monitoramento_termos', 'select')).toHaveLength(0);
  });
});
