// Hook da Agenda: eventos do mês + atrasados de qualquer mês, erro visível.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { enfileirar, chamadasCom, resetSupabaseMock } from '../helpers/supabaseMock';

vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabase } = await import('../helpers/supabaseMock');
  return { supabase: mockSupabase };
});
const auth = { user: { id: 'u1', office_id: 'o1' } as { id: string; office_id: string | null } };
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));

import { useAgendaEvents } from '@/hooks/useAgendaEvents';

const TABELAS = ['audiencias', 'prazos', 'atendimentos', 'tarefas', 'consultivos'];
// Mesma instância em todos os renders: o hook recria fetchEvents quando a data muda,
// e um `new Date()` dentro do renderHook dispararia um loop de refetch.
const MES = new Date('2026-10-15T12:00:00');

describe('useAgendaEvents', () => {
  beforeEach(() => { resetSupabaseMock(); auth.user = { id: 'u1', office_id: 'o1' }; vi.spyOn(console, 'error').mockImplementation(() => {}); });

  it('sem escritório não consulta e sai do loading', async () => {
    auth.user = { id: 'u1', office_id: null };
    const { result } = renderHook(() => useAgendaEvents(MES));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.events).toEqual([]);
    expect(TABELAS.every(t => chamadasCom(t, 'select').length === 0)).toBe(true);
  });

  it('consulta as cinco fontes, duas vezes cada (mês visível + atrasados), e sem erro fica isError=false', async () => {
    const { result } = renderHook(() => useAgendaEvents(MES));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await waitFor(() => expect(TABELAS.every(t => chamadasCom(t, 'select').length === 2)).toBe(true));
    expect(result.current.isError).toBe(false);
    expect(result.current.atrasadosTotal).toBe(0);
    // atrasados: corte por data e cap de segurança em todas as fontes
    for (const t of TABELAS) {
      const atrasado = chamadasCom(t, 'select').find(c => c.ops.some(([m]) => m === 'limit'));
      expect(atrasado, t).toBeTruthy();
    }
  });

  it('falha em qualquer fonte vira erro visível (não agenda vazia)', async () => {
    for (const t of TABELAS) { enfileirar(t, { error: { message: `erro em ${t}` } }); enfileirar(t, { error: { message: `erro em ${t}` } }); }
    const { result } = renderHook(() => useAgendaEvents(MES));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatch(/erro em/);
  });
});
