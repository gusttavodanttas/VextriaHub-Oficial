// usePWA: instalável via beforeinstallprompt, instalado via display-mode/appinstalled,
// online/offline e notificações nativas.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePWA } from '@/hooks/usePWA';

const w = window as unknown as Record<string, unknown>;
let standalone = false;

describe('usePWA', () => {
  beforeEach(() => {
    standalone = false;
    w.matchMedia = vi.fn(() => ({ matches: standalone }));
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });
  afterEach(() => { delete w.Notification; });

  it('beforeinstallprompt torna instalável; installApp chama prompt e respeita a escolha', async () => {
    const { result } = renderHook(() => usePWA());
    expect(result.current).toMatchObject({ isInstallable: false, isInstalled: false, isOnline: true });
    const evt = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt: vi.fn(async () => undefined), userChoice: Promise.resolve({ outcome: 'dismissed' as const }),
    });
    act(() => { window.dispatchEvent(evt); });
    expect(evt.defaultPrevented).toBe(true);
    expect(result.current.isInstallable).toBe(true);
    await act(async () => { await result.current.installApp(); });
    expect(evt.prompt).toHaveBeenCalled();
    expect(result.current).toMatchObject({ isInstallable: false, isInstalled: false });

    const evt2 = Object.assign(new Event('beforeinstallprompt'), { prompt: vi.fn(async () => undefined), userChoice: Promise.resolve({ outcome: 'accepted' as const }) });
    act(() => { window.dispatchEvent(evt2); });
    await act(async () => { await result.current.installApp(); });
    expect(result.current.isInstalled).toBe(true);
    await act(async () => { await result.current.installApp(); }); // sem prompt pendente: no-op
  });

  it('display-mode standalone e appinstalled marcam instalado; online/offline refletem a rede', () => {
    standalone = true;
    const { result } = renderHook(() => usePWA());
    expect(result.current.isInstalled).toBe(true);

    standalone = false;
    const { result: r2 } = renderHook(() => usePWA());
    expect(r2.current.isInstalled).toBe(false);
    act(() => { window.dispatchEvent(new Event('appinstalled')); });
    expect(r2.current).toMatchObject({ isInstalled: true, isInstallable: false });
    act(() => { window.dispatchEvent(new Event('offline')); });
    expect(r2.current.isOnline).toBe(false);
    act(() => { window.dispatchEvent(new Event('online')); });
    expect(r2.current.isOnline).toBe(true);
  });

  it('notificações: pede permissão quando a API existe e só dispara com permissão concedida', async () => {
    const Notif = vi.fn();
    Object.assign(Notif, { permission: 'default', requestPermission: vi.fn(async () => 'granted') });
    w.Notification = Notif;
    const { result } = renderHook(() => usePWA());
    let ok = false;
    await act(async () => { ok = await result.current.requestNotificationPermission(); });
    expect(ok).toBe(true);
    result.current.sendNotification('Oi');
    expect(Notif).not.toHaveBeenCalled();
    (Notif as unknown as { permission: string }).permission = 'granted';
    result.current.sendNotification('Oi', { body: 'b' });
    expect(Notif).toHaveBeenCalledWith('Oi', { icon: '/favicon.ico', badge: '/favicon.ico', body: 'b' });

    delete w.Notification;
    await act(async () => { ok = await result.current.requestNotificationPermission(); });
    expect(ok).toBe(false);
  });
});
