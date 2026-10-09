// useTimesheetTimer: cronômetro do timer ativo, abertura via ?new=1, itens de
// referência por categoria/cliente (com erro exposto) e iniciar só fecha em sucesso.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { enfileirar, chamadasCom, resetSupabaseMock } from '../helpers/supabaseMock';

vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabase } = await import('../helpers/supabaseMock');
  return { supabase: mockSupabase };
});

import { useTimesheetTimer } from '@/hooks/useTimesheetTimer';

const user = { id: 'u1' };
const config = { valorPadrao: 200 } as never;

function montar(over: { activeTimer?: unknown; startTimer?: (...a: unknown[]) => Promise<unknown> } = {}) {
  const startTimer = over.startTimer ?? vi.fn(async () => ({ id: 't' }));
  const navigate = vi.fn();
  const r = renderHook(({ activeTimer }) => useTimesheetTimer({ activeTimer, startTimer, config, user, navigate }), { initialProps: { activeTimer: over.activeTimer ?? null } });
  return { ...r, startTimer, navigate };
}

describe('useTimesheetTimer', () => {
  beforeEach(() => { resetSupabaseMock(); window.history.replaceState({}, '', '/timesheet'); });
  afterEach(() => { vi.useRealTimers(); });

  it('cronômetro conta a partir de data_inicio e zera sem timer ativo', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-09T10:00:10Z'));
    const { result, rerender } = montar({ activeTimer: { status: 'ativo', data_inicio: '2026-10-09T10:00:00Z' } });
    expect(result.current.elapsedTime).toBe(10);
    act(() => { vi.advanceTimersByTime(2000); });
    expect(result.current.elapsedTime).toBe(12);
    rerender({ activeTimer: { status: 'pausado', data_inicio: '2026-10-09T10:00:00Z' } });
    expect(result.current.elapsedTime).toBe(0);
  });

  it('?new=1 abre o diálogo e limpa a URL; openTimer usa o valor padrão', () => {
    window.history.replaceState({}, '', '/timesheet?new=1');
    const { result } = montar();
    expect(result.current.dialogOpen).toBe(true);
    expect(window.location.search).toBe('');
    act(() => { result.current.setDialogOpen(false); });
    act(() => { result.current.openTimer(); });
    expect(result.current.dialogOpen).toBe(true);
    expect(result.current.valorHora).toBe('200');
  });

  it('categoria define o tipo de referência e carrega os itens do usuário (filtrando por cliente)', async () => {
    enfileirar('tarefas', { data: [{ id: 'x1', titulo: 'Ligar', data_vencimento: '2026-10-10' }, { id: 'x2', titulo: null, data_vencimento: null }] });
    const { result } = montar();
    act(() => { result.current.setClienteId('c1'); });
    act(() => { result.current.setRefTipo('tarefa'); });
    await waitFor(() => expect(result.current.refLoading).toBe(false));
    expect(result.current.refItems).toEqual([{ id: 'x1', label: 'Ligar', sublabel: '10/10/2026' }, { id: 'x2', label: 'Sem título', sublabel: expect.any(String) }]);
    const sel = chamadasCom('tarefas', 'select')[0];
    expect(sel.ops).toEqual(expect.arrayContaining([['eq', ['user_id', 'u1']], ['eq', ['deletado', false]], ['eq', ['cliente_id', 'c1']], ['order', ['data_vencimento', { ascending: false }]], ['limit', [50]]]));

    // handleSetCategoria: peticao → consultivo (tabela processos) e zera a seleção
    enfileirar('processos', { data: [{ id: 'p1', titulo: 'Caso', created_at: '2026-10-01' }] });
    act(() => { result.current.setRefId('x1'); result.current.setRefLabel('Ligar'); });
    act(() => { result.current.handleSetCategoria('peticao' as never); });
    expect(result.current.refTipo).toBe('consultivo');
    expect(result.current.refId).toBe('');
    await waitFor(() => expect(result.current.refItems).toEqual([{ id: 'p1', label: 'Caso', sublabel: '01/10/2026' }]));
    expect(chamadasCom('processos', 'select')[0].ops).toEqual(expect.arrayContaining([['eq', ['cliente_id', 'c1']]]));
  });

  it('prazo com cliente: resolve os processos do cliente; sem processos não consulta prazos; erro vira refError', async () => {
    enfileirar('processos', { data: [{ id: 'p1' }, { id: 'p2' }] });
    enfileirar('prazos', { data: [{ id: 'z1', titulo: 'Contestação', data_fim_prazo: null, data_vencimento: '2026-10-20' }] });
    const { result } = montar();
    act(() => { result.current.setClienteId('c1'); });
    act(() => { result.current.setRefTipo('prazo'); });
    await waitFor(() => expect(result.current.refItems).toEqual([{ id: 'z1', label: 'Contestação', sublabel: 'Vence 20/10/2026' }]));
    expect(chamadasCom('prazos', 'select')[0].ops).toEqual(expect.arrayContaining([['in', ['processo_id', ['p1', 'p2']]], ['eq', ['deletado', false]]]));

    resetSupabaseMock();
    enfileirar('processos', { data: [] });
    act(() => { result.current.setClienteId('c2'); });
    await waitFor(() => expect(result.current.refLoading).toBe(false));
    expect(result.current.refItems).toEqual([]);
    expect(chamadasCom('prazos', 'select')).toHaveLength(0);

    resetSupabaseMock();
    enfileirar('processos', { error: { message: 'boom' } });
    act(() => { result.current.setClienteId('c3'); });
    await waitFor(() => expect(result.current.refError).toBe('boom'));
    expect(result.current.refItems).toEqual([]);
  });

  it('handleStart exige descrição e categoria; passa referência e cobrança; fecha só em sucesso', async () => {
    const startTimer = vi.fn(async () => null);
    const { result } = montar({ startTimer });
    await act(async () => { await result.current.handleStart(); });
    expect(startTimer).not.toHaveBeenCalled();

    act(() => { result.current.openTimer(); result.current.setDescricao('Peça'); result.current.setCategoria('peticao' as never); result.current.setRefTipo('consultivo'); result.current.setFaturavel(false); });
    // o carregamento dos itens de referência zera a seleção — escolhe depois dele
    await waitFor(() => expect(result.current.refLoading).toBe(false));
    act(() => { result.current.setRefId('p1'); result.current.setRefLabel('Caso'); });
    await act(async () => { await result.current.handleStart(); });
    expect(startTimer).toHaveBeenCalledWith('Peça', 'peticao', undefined, undefined, 'consultivo', 'p1', 'Caso', { faturavel: false, valor_hora: 200 });
    expect(result.current.dialogOpen).toBe(true); // falhou → mantém o que foi digitado
    expect(result.current.descricao).toBe('Peça');

    startTimer.mockResolvedValueOnce({ id: 't1' } as never);
    await act(async () => { await result.current.handleStart(); });
    expect(result.current.dialogOpen).toBe(false);
    expect(result.current.descricao).toBe('');
    expect(result.current.refTipo).toBe('');
    expect(result.current.valorHora).toBe('');
  });

  it('navigateToRef usa a rota do tipo com ?openId quando há id', () => {
    const { result, navigate } = montar();
    result.current.navigateToRef('audiencia', 'a1');
    result.current.navigateToRef('prazo', null);
    result.current.navigateToRef('inexistente', 'x');
    expect(navigate.mock.calls).toEqual([['/audiencias?openId=a1'], ['/prazos']]);
  });
});
