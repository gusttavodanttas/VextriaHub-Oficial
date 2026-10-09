// useMetas: lista com progresso recalculado por tipo, erro de carga exposto,
// progresso de meta de equipe restrito aos membros, e mutations com checagem de linhas.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { enfileirar, chamadasCom, resetSupabaseMock } from '../helpers/supabaseMock';
import { PERMISSAO_NEGADA } from '@/lib/errors';

vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabase } = await import('../helpers/supabaseMock');
  return { supabase: mockSupabase };
});
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', office_id: 'o1' } }) }));
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }));
vi.mock('@/lib/monitoring', () => ({ captureError: vi.fn() }));

import { useMetas } from '@/hooks/useMetas';

const meta = (over: Record<string, unknown> = {}) => ({
  id: 'm1', titulo: 'Receita do mês', tipo: 'receita', periodo: 'mensal', valor_meta: 1000, valor_atual: 0,
  status: 'ativa', data_inicio: '2026-10-01', data_fim: '2026-10-31', team_id: null, ...over,
});

describe('useMetas', () => {
  beforeEach(() => { resetSupabaseMock(); mockToast.mockClear(); });

  it('lista as metas do escritório e recalcula a receita recebida no período', async () => {
    enfileirar('metas', { data: [meta()] });
    enfileirar('office_teams', { data: [] });
    enfileirar('financeiro', { data: [{ valor: 300 }, { valor: '200.5' }] });
    const { result } = renderHook(() => useMetas());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.metas).toHaveLength(1);
    expect(result.current.metas[0].valorAtual).toBe(500.5);
    const sel = chamadasCom('metas', 'select')[0];
    expect(sel.ops).toEqual(expect.arrayContaining([['eq', ['office_id', 'o1']], ['eq', ['deletado', false]]]));
    const fin = chamadasCom('financeiro', 'select')[0];
    expect(fin.ops).toEqual(expect.arrayContaining([['eq', ['tipo', 'receita']], ['not', ['data_pagamento', 'is', null]]]));
  });

  it('meta de equipe restringe o cálculo aos membros e usa o nome da equipe', async () => {
    enfileirar('metas', { data: [meta({ tipo: 'processos', team_id: 't1' })] });
    enfileirar('office_teams', { data: [{ id: 't1', name: 'Cível' }] });
    enfileirar('office_team_members', { data: [{ user_id: 'u1' }, { user_id: 'u2' }] });
    enfileirar('processos', { count: 7 });
    const { result } = renderHook(() => useMetas());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.metas[0]).toMatchObject({ valorAtual: 7, teamName: 'Cível', teamId: 't1' });
    const proc = chamadasCom('processos', 'select')[0];
    expect(proc.ops).toContainEqual(['in', ['responsavel_id', ['u1', 'u2']]]);
  });

  it('falha ao carregar as metas vira `error`; falha só no progresso vira aviso com o valor salvo', async () => {
    enfileirar('metas', { error: { message: 'boom' } });
    enfileirar('office_teams', { data: [] });
    const { result } = renderHook(() => useMetas());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('boom');
    expect(result.current.metas).toEqual([]);

    resetSupabaseMock();
    enfileirar('metas', { data: [meta({ tipo: 'clientes', valor_atual: 4 })] });
    enfileirar('office_teams', { data: [] });
    enfileirar('clientes', { error: { message: 'rls' } });
    await act(async () => { await result.current.refetch(); });
    expect(result.current.metas[0].valorAtual).toBe(4);
    expect(result.current.error).toMatch(/desatualizados/);
  });

  it('update e remove barrados pela RLS (0 linhas) devolvem false com toast; remove ok tira da lista', async () => {
    enfileirar('metas', { data: [meta({ tipo: 'audiencias' })] });
    enfileirar('office_teams', { data: [] });
    enfileirar('audiencias', { count: 0 });
    const { result } = renderHook(() => useMetas());
    await waitFor(() => expect(result.current.loading).toBe(false));

    enfileirar('metas', { data: [] });
    let ok: boolean | undefined;
    await act(async () => { ok = await result.current.update('m1', { titulo: 'x', tipo: 'audiencias', periodo: 'mensal', valorMeta: 3 } as any); });
    expect(ok).toBe(false);
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Erro ao salvar', description: PERMISSAO_NEGADA }));
    expect(chamadasCom('metas', 'update').at(-1)!.ops.some(([m]) => m === 'select')).toBe(true);

    enfileirar('metas', { data: [] });
    await act(async () => { ok = await result.current.remove('m1'); });
    expect(ok).toBe(false);
    expect(result.current.metas).toHaveLength(1);

    enfileirar('metas', { data: [{ id: 'm1' }] });
    await act(async () => { ok = await result.current.remove('m1'); });
    expect(ok).toBe(true);
    expect(result.current.metas).toHaveLength(0);
  });

  it('create: erro de cota do plano mostra a mensagem acionável e devolve false', async () => {
    enfileirar('metas', { data: [] });
    enfileirar('office_teams', { data: [] });
    const { result } = renderHook(() => useMetas());
    await waitFor(() => expect(result.current.loading).toBe(false));
    enfileirar('metas', { error: { message: 'plano: limite de metas atingido', code: 'P0001' } });
    let ok: boolean | undefined;
    await act(async () => { ok = await result.current.create({ titulo: 'Nova', tipo: 'clientes', periodo: 'mensal', valorMeta: 5 } as any); });
    expect(ok).toBe(false);
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
    const ins = chamadasCom('metas', 'insert').at(-1)!;
    expect((ins.ops.find(([m]) => m === 'insert')![1][0] as Record<string, unknown>)).toMatchObject({ office_id: 'o1', user_id: 'u1', valor_atual: 0, status: 'ativa' });
  });
});
