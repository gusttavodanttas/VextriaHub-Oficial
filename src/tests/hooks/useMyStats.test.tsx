// useMyStats: pontuação do usuário a partir das 6 contagens e erro exposto.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { enfileirar, chamadasCom, resetSupabaseMock } from '../helpers/supabaseMock';

vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabase } = await import('../helpers/supabaseMock');
  return { supabase: mockSupabase };
});
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', office_id: 'o1' } }) }));
vi.mock('@/lib/monitoring', () => ({ captureError: vi.fn() }));

import { useMyStats } from '@/hooks/useMyStats';

describe('useMyStats', () => {
  beforeEach(() => resetSupabaseMock());

  it('calcula os pontos: tarefa 10, prazo 25, audiência 15, processo encerrado 40', async () => {
    enfileirar('processos', { count: 3 }, { count: 2 });
    enfileirar('clientes', { count: 8 });
    enfileirar('tarefas', { count: 4 });
    enfileirar('prazos', { count: 1 });
    enfileirar('audiencias', { count: 2 });
    const { result } = renderHook(() => useMyStats());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current).toMatchObject({ processosAtivos: 3, processosFinalizados: 2, clientesAtendidos: 8, tarefasConcluidas: 4, isError: false });
    expect(result.current.pontos).toBe(4 * 10 + 1 * 25 + 2 * 15 + 2 * 40);
    const proc = chamadasCom('processos', 'select')[0];
    expect(proc.ops).toContainEqual(['or', ['responsavel_id.eq.u1,user_id.eq.u1']]);
  });

  it('erro em qualquer consulta vira isError, sem fingir zero', async () => {
    enfileirar('processos', { count: 3 }, { count: 2 });
    enfileirar('clientes', { error: { message: 'rls' } });
    const { result } = renderHook(() => useMyStats());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isError).toBe(true);
  });
});
