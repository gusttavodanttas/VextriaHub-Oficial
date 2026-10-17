import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { enfileirar, resetSupabaseMock, mockSupabase } from '../helpers/supabaseMock';

vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabase } = await import('../helpers/supabaseMock');
  return { supabase: mockSupabase };
});
const user = { id: 'u1', office_id: 'o1' };
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user }) }));
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }));

import { useNotifications } from '@/hooks/useNotifications';

const notif = { id: 'n1', type: 'info', title: 'Oi', message: 'm', created_at: new Date().toISOString(), read: false, data: null };

describe('useNotifications — RLS e erro de carga', () => {
  beforeEach(() => { resetSupabaseMock(); mockToast.mockClear(); });

  it('marcar como lida barrado pela RLS mantém a notificação não lida e avisa', async () => {
    enfileirar('notifications', { data: [notif] });
    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.notifications).toHaveLength(1));

    enfileirar('notifications', { data: [] }); // update casou 0 linhas
    await act(async () => { await result.current.markAsRead('n1'); });

    expect(result.current.notifications[0].read).toBe(false);
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
  });

  it('erro na busca vira `error`, não uma lista vazia silenciosa', async () => {
    enfileirar('notifications', { error: { message: 'falha de rede' } });
    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('falha de rede');
    expect(result.current.notifications).toEqual([]);
  });
});

describe('useNotifications — canal realtime', () => {
  beforeEach(() => { resetSupabaseMock(); mockSupabase.channel.mockClear(); mockSupabase.removeChannel.mockClear(); });

  it('cada instância do hook assina um tópico próprio (sino + página não dividem o canal) e o remove ao desmontar', async () => {
    enfileirar('notifications', { data: [] });
    enfileirar('notifications', { data: [] });
    const a = renderHook(() => useNotifications());
    const b = renderHook(() => useNotifications());
    await waitFor(() => expect(mockSupabase.channel).toHaveBeenCalledTimes(2));
    const topicos = mockSupabase.channel.mock.calls.map((c) => c[0]);
    expect(topicos[0]).toMatch(/^notifications:/);
    expect(topicos[1]).toMatch(/^notifications:/);
    expect(topicos[0]).not.toBe(topicos[1]);
    a.unmount(); b.unmount();
    expect(mockSupabase.removeChannel).toHaveBeenCalledTimes(2);
  });
});
