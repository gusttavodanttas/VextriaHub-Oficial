// useMyActivity: mescla processos/tarefas/atendimentos do usuário por data; erro de
// qualquer uma das três consultas vira `error`.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { enfileirar, chamadasCom, resetSupabaseMock } from '../helpers/supabaseMock';

vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabase } = await import('../helpers/supabaseMock');
  return { supabase: mockSupabase };
});
const auth = { user: { id: 'u1', office_id: 'o1' } as { id: string; office_id: string | null } };
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));

import { useMyActivity } from '@/hooks/useMyActivity';

describe('useMyActivity', () => {
  beforeEach(() => { resetSupabaseMock(); auth.user = { id: 'u1', office_id: 'o1' }; });

  it('ordena por data decrescente, usa o melhor rótulo disponível e respeita o limite', async () => {
    enfileirar('processos', { data: [{ id: 'p1', numero_processo: '123', created_at: '2026-10-01T10:00:00Z' }] });
    enfileirar('tarefas', { data: [{ id: 't1', titulo: 'Ligar', created_at: '2026-10-03T10:00:00Z' }, { id: 't2', created_at: null }] });
    enfileirar('atendimentos', { data: [{ id: 'a1', created_at: '2026-10-02T10:00:00Z' }] });
    const { result } = renderHook(() => useMyActivity(2));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toEqual([
      { id: 't-t1', tipo: 'Tarefa', label: 'Ligar', date: '2026-10-03T10:00:00Z', link: '/tarefas?openId=t1' },
      { id: 'a-a1', tipo: 'Atendimento', label: 'Atendimento', date: '2026-10-02T10:00:00Z', link: '/atendimentos?openId=a1' },
    ]);
    for (const t of ['processos', 'tarefas', 'atendimentos']) {
      expect(chamadasCom(t, 'select')[0].ops).toEqual(expect.arrayContaining([['eq', ['office_id', 'o1']], ['eq', ['user_id', 'u1']], ['limit', [5]]]));
    }
  });

  it('falha em uma das consultas vira `error`', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    enfileirar('processos', { data: [] });
    enfileirar('tarefas', { error: { message: 'boom' } });
    enfileirar('atendimentos', { data: [] });
    const { result } = renderHook(() => useMyActivity());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isError).toBe(true);
    expect(result.current.error).toBe('boom');
    expect(result.current.items).toEqual([]);
  });
});
