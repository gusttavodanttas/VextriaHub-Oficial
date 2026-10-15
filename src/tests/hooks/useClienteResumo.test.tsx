// useClienteResumo: últimos 5 processos e atendimentos do cliente, só quando habilitado.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { enfileirar, chamadasCom, resetSupabaseMock } from '../helpers/supabaseMock';

vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabase } = await import('../helpers/supabaseMock');
  return { supabase: mockSupabase };
});
const auth = { user: { id: 'u1', office_id: 'o1' } as { id: string; office_id: string | null } };
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));

import { useClienteResumo } from '@/hooks/useClienteResumo';

describe('useClienteResumo', () => {
  beforeEach(() => { resetSupabaseMock(); auth.user = { id: 'u1', office_id: 'o1' }; });

  it('carrega processos (do escritório) e atendimentos (não excluídos) do cliente, 5 de cada', async () => {
    enfileirar('processos', { data: [{ id: 'p1', titulo: 'X', numero_processo: null, status: 'ativo', created_at: '2026-01-01' }] });
    enfileirar('atendimentos', { data: [{ id: 'a1', tipo_atendimento: 'reuniao', data_atendimento: '2026-01-02', status: null }] });
    const { result } = renderHook(() => useClienteResumo('c1', true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.processos).toHaveLength(1);
    expect(result.current.atendimentos).toHaveLength(1);
    expect(chamadasCom('processos', 'select')[0].ops).toEqual(expect.arrayContaining([
      ['eq', ['cliente_id', 'c1']], ['eq', ['office_id', 'o1']], ['order', ['created_at', { ascending: false }]], ['limit', [5]],
    ]));
    expect(chamadasCom('atendimentos', 'select')[0].ops).toEqual(expect.arrayContaining([
      ['eq', ['cliente_id', 'c1']], ['eq', ['deletado', false]], ['limit', [5]],
    ]));
  });

  it('desabilitado ou sem cliente não consulta', () => {
    renderHook(() => useClienteResumo('c1', false));
    renderHook(() => useClienteResumo(null, true));
    expect(chamadasCom('processos', 'select')).toHaveLength(0);
    expect(chamadasCom('atendimentos', 'select')).toHaveLength(0);
  });
});
