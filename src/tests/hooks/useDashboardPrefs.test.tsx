// useDashboardPrefs: preferências por usuário no localStorage, com migração de
// blocos novos na ordem e persistência em toggle/move.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const auth = { user: { id: 'u1' } as { id: string } | null };
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));

import { useDashboardPrefs, DASH_DEFAULTS } from '@/hooks/useDashboardPrefs';

const KEY = 'dash_prefs_v2_u1';

describe('useDashboardPrefs', () => {
  beforeEach(() => { localStorage.clear(); auth.user = { id: 'u1' }; });

  it('sem nada salvo usa os defaults', () => {
    const { result } = renderHook(() => useDashboardPrefs());
    expect(result.current.prefs).toEqual(DASH_DEFAULTS);
  });

  it('mescla prefs antigas com os defaults e anexa blocos novos ao fim da ordem', async () => {
    localStorage.setItem(KEY, JSON.stringify({ widgets: { agenda: false }, order: ['prazos', 'agenda'], actions: { tarefa: true } }));
    const { result } = renderHook(() => useDashboardPrefs());
    await waitFor(() => expect(result.current.prefs.widgets.agenda).toBe(false));
    expect(result.current.prefs.widgets.produtividade).toBe(true);
    expect(result.current.prefs.actions).toEqual({ ...DASH_DEFAULTS.actions, tarefa: true });
    const resto = DASH_DEFAULTS.order.filter((k) => !['prazos', 'agenda'].includes(k));
    expect(result.current.prefs.order).toEqual(['prazos', 'agenda', ...resto]);
  });

  it('toggle e move persistem; move nas bordas não faz nada; JSON corrompido é ignorado', async () => {
    const { result } = renderHook(() => useDashboardPrefs());
    act(() => { result.current.toggle('widgets', 'metas', true); });
    expect(result.current.prefs.widgets.metas).toBe(true);
    expect(JSON.parse(localStorage.getItem(KEY)!).widgets.metas).toBe(true);

    const [a, b] = DASH_DEFAULTS.order;
    act(() => { result.current.move(b, -1); });
    expect(result.current.prefs.order.slice(0, 2)).toEqual([b, a]);
    act(() => { result.current.move(b, -1); });
    expect(result.current.prefs.order.slice(0, 2)).toEqual([b, a]);
    act(() => { result.current.move('inexistente', 1); });
    expect(JSON.parse(localStorage.getItem(KEY)!).order.slice(0, 2)).toEqual([b, a]);

    localStorage.setItem('dash_prefs_v2_u2', '{nope');
    auth.user = { id: 'u2' };
    const { result: r2 } = renderHook(() => useDashboardPrefs());
    expect(r2.current.prefs).toEqual(DASH_DEFAULTS);
  });
});
