// usePlanFeatures / usePlanLimits: plano do escritório → features; super admin,
// vitalício e cortesia viram premium; nomes legados normalizados; limites com -1.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const auth = { office: { plan: 'trial', access_type: null } as { plan?: string | null; access_type?: string | null } | null, isSuperAdmin: false };
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
const stats = { stats: { processosAtivos: 0, clientes: 0, colaboradores: 0, tarefasPendentes: 0, tarefasConcluidas: 0, prazosVencendo: 0 }, loading: false };
vi.mock('@/hooks/useStats', () => ({ useStats: () => stats }));

import { usePlanFeatures, usePlanLimits } from '@/hooks/usePlanFeatures';

describe('usePlanFeatures', () => {
  beforeEach(() => { auth.office = { plan: 'trial', access_type: null }; auth.isSuperAdmin = false; });

  it('trial por padrão (sem escritório ou plano desconhecido)', () => {
    auth.office = null;
    expect(renderHook(() => usePlanFeatures()).result.current.maxProcesses).toBe(10);
    auth.office = { plan: 'inventado' };
    expect(renderHook(() => usePlanFeatures()).result.current.maxProcesses).toBe(10);
  });

  it('super admin, vitalício e cortesia recebem premium (ilimitado, metas e IA)', () => {
    auth.isSuperAdmin = true;
    expect(renderHook(() => usePlanFeatures()).result.current).toMatchObject({ maxProcesses: -1, hasGoalsModule: true, hasIAModule: true });
    auth.isSuperAdmin = false;
    for (const office of [{ plan: 'basico', access_type: 'lifetime' }, { plan: 'basico', access_type: 'courtesy' }, { plan: 'cortesia' }]) {
      auth.office = office;
      expect(renderHook(() => usePlanFeatures()).result.current.maxProcesses).toBe(-1);
    }
  });

  it('normaliza nomes legados de plano', () => {
    const casos: Array<[string, number]> = [['free', 10], ['basic', 30], ['professional', 300], ['enterprise', -1], ['intermediario', 100]];
    for (const [plan, max] of casos) {
      auth.office = { plan };
      expect(renderHook(() => usePlanFeatures()).result.current.maxProcesses, plan).toBe(max);
    }
  });
});

describe('usePlanLimits', () => {
  beforeEach(() => { auth.office = { plan: 'trial', access_type: null }; auth.isSuperAdmin = false; });

  it('calcula atingido/percentual por limite; -1 nunca atinge', () => {
    stats.stats = { processosAtivos: 10, clientes: 5, colaboradores: 1, tarefasPendentes: 30, tarefasConcluidas: 30, prazosVencendo: 0 };
    const { result } = renderHook(() => usePlanLimits());
    expect(result.current.currentPlan).toBe('trial');
    expect(result.current.limits.processes).toEqual({ current: 10, max: 10, isReached: true, percentage: 100 });
    expect(result.current.limits.clients).toEqual({ current: 5, max: 20, isReached: false, percentage: 25 });
    expect(result.current.limits.tasks).toMatchObject({ current: 60, max: 50, isReached: true, percentage: 100 });

    auth.isSuperAdmin = true;
    const { result: r2 } = renderHook(() => usePlanLimits());
    expect(r2.current.limits.processes).toEqual({ current: 10, max: -1, isReached: false, percentage: 0 });
  });
});
