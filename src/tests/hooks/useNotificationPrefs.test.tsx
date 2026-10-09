// useNotificationPrefs: carrega do servidor, salva otimista com reversão em erro e
// bloqueia a escrita quando o load falhou (senão gravaria defaults por cima).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

const auth = { user: { id: 'u1' } as { id: string } | null };
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }));
const fetchPrefs = vi.fn();
const savePrefs = vi.fn();
vi.mock('@/lib/notificationPrefs', () => ({
  DEFAULT_PREFS: { prazos: true, tarefas: true },
  DEFAULT_LEAD_DIAS: 3,
  fetchNotificationPrefs: (...a: unknown[]) => fetchPrefs(...a),
  saveNotificationPrefs: (...a: unknown[]) => savePrefs(...a),
}));

import { useNotificationPrefs } from '@/hooks/useNotificationPrefs';

describe('useNotificationPrefs', () => {
  beforeEach(() => {
    mockToast.mockClear(); fetchPrefs.mockReset(); savePrefs.mockReset(); auth.user = { id: 'u1' };
    fetchPrefs.mockResolvedValue({ prefs: { prazos: false, tarefas: true }, leadDias: 5 });
    savePrefs.mockResolvedValue({ error: null });
  });

  it('carrega as preferências do usuário e salva o objeto inteiro ao alternar', async () => {
    const { result } = renderHook(() => useNotificationPrefs());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchPrefs).toHaveBeenCalledWith('u1');
    expect(result.current.prefs).toEqual({ prazos: false, tarefas: true });
    expect(result.current.leadDias).toBe(5);
    expect(result.current.error).toBeNull();

    await act(async () => { await result.current.toggle('tarefas', false); });
    expect(savePrefs).toHaveBeenCalledWith('u1', { prefs: { prazos: false, tarefas: false }, leadDias: 5 });
    expect(result.current.prefs.tarefas).toBe(false);

    await act(async () => { await result.current.saveLead(7); });
    expect(savePrefs).toHaveBeenLastCalledWith('u1', { prefs: { prazos: false, tarefas: false }, leadDias: 7 });
    expect(result.current.leadDias).toBe(7);
  });

  it('erro ao salvar reverte o otimista e avisa', async () => {
    const { result } = renderHook(() => useNotificationPrefs());
    await waitFor(() => expect(result.current.loading).toBe(false));
    savePrefs.mockResolvedValueOnce({ error: { message: 'offline' } });
    await act(async () => { await result.current.toggle('prazos', true); });
    expect(result.current.prefs.prazos).toBe(false);
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Não foi possível salvar a preferência', description: 'offline' }));

    savePrefs.mockResolvedValueOnce({ error: { message: 'offline' } });
    await act(async () => { await result.current.saveLead(1); });
    expect(result.current.leadDias).toBe(5);
  });

  it('load falho: expõe error e bloqueia toggle/saveLead sem chamar o save', async () => {
    fetchPrefs.mockResolvedValueOnce({ prefs: { prazos: true, tarefas: true }, leadDias: 3, loadFailed: true });
    const { result } = renderHook(() => useNotificationPrefs());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Não foi possível carregar suas preferências do servidor.');
    await act(async () => { await result.current.toggle('prazos', false); });
    await act(async () => { await result.current.saveLead(9); });
    expect(savePrefs).not.toHaveBeenCalled();
    expect(result.current.prefs.prazos).toBe(true);
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Não foi possível salvar' }));

    // refetch bem-sucedido destrava
    await act(async () => { result.current.refetch(); });
    await waitFor(() => expect(result.current.error).toBeNull());
    await act(async () => { await result.current.toggle('prazos', true); });
    expect(savePrefs).toHaveBeenCalledTimes(1);
  });

  it('sem usuário não carrega', async () => {
    auth.user = null;
    const { result } = renderHook(() => useNotificationPrefs());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchPrefs).not.toHaveBeenCalled();
  });
});
