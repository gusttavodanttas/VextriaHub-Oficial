// useTimesheetManualEntry: formulário de lançamento manual/edição; turno que passa
// da meia-noite, fecha só em sucesso, data em fuso local.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTimesheetManualEntry } from '@/hooks/useTimesheetManualEntry';

const config = { valorPadrao: 250 } as never;

type Fn = ReturnType<typeof vi.fn<(...a: unknown[]) => Promise<boolean>>>;
function montar(update: Fn = vi.fn(async () => true), addManual: Fn = vi.fn(async () => true)) {
  const r = renderHook(() => useTimesheetManualEntry({ config, update, addManual }));
  return { ...r, update, addManual };
}

describe('useTimesheetManualEntry', () => {
  beforeEach(() => { vi.useRealTimers(); });

  it('openManual zera o formulário com a data local de hoje e o valor padrão', () => {
    const { result } = montar();
    act(() => { result.current.openManual(); });
    const hoje = new Date();
    const ymd = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
    expect(result.current.manualOpen).toBe(true);
    expect(result.current.editTarget).toBeNull();
    expect(result.current.mData).toBe(ymd);
    expect(result.current.mValor).toBe('250');
    expect(result.current.mInicio).toBe('09:00');
    expect(result.current.mFim).toBe('10:00');
    expect(result.current.mFat).toBe(true);
  });

  it('openEdit preenche a partir do lançamento, derivando o fim pela duração quando falta', () => {
    const { result } = montar();
    const ini = new Date(2026, 9, 9, 14, 30); // local
    act(() => {
      result.current.openEdit({ id: 't1', data_inicio: ini.toISOString(), data_fim: null, duracao_minutos: 90, tarefa_descricao: 'Peça', categoria: 'peticao', cliente_id: 'c1', faturavel: false, valor_hora: 300, observacoes: 'obs' });
    });
    expect(result.current.editTarget?.id).toBe('t1');
    expect(result.current.mData).toBe('2026-10-09');
    expect(result.current.mInicio).toBe('14:30');
    expect(result.current.mFim).toBe('16:00');
    expect(result.current.mFat).toBe(false);
    expect(result.current.mValor).toBe('300');
    expect(result.current.mCli).toBe('c1');
  });

  it('saveManual: novo lançamento calcula duração, fecha em sucesso e fica aberto em falha', async () => {
    const addManual: Fn = vi.fn(async () => true);
    const { result } = montar(undefined, addManual);
    act(() => { result.current.openManual(); });
    act(() => {
      result.current.setMDesc(' Audiência '); result.current.setMCat('audiencia' as never);
      result.current.setMData('2026-10-09'); result.current.setMInicio('09:00'); result.current.setMFim('10:45');
      result.current.setMValor(''); result.current.setMObs('  ');
    });
    await act(async () => { await result.current.saveManual(); });
    expect(addManual).toHaveBeenCalledTimes(1);
    const payload = addManual.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).toMatchObject({ tarefa_descricao: 'Audiência', categoria: 'audiencia', cliente_id: null, duracao_minutos: 105, observacoes: null, faturavel: true, valor_hora: null });
    expect(new Date(payload.data_inicio as string).getTime()).toBe(new Date('2026-10-09T09:00:00').getTime());
    expect(result.current.manualOpen).toBe(false);

    addManual.mockResolvedValueOnce(false);
    act(() => { result.current.openManual(); result.current.setMDesc('x'); result.current.setMCat('audiencia' as never); });
    await act(async () => { await result.current.saveManual(); });
    expect(result.current.manualOpen).toBe(true);
    expect(result.current.mSaving).toBe(false);
  });

  it('fim antes do início = turno que vira a meia-noite (dia seguinte); campos vazios não salvam', async () => {
    const update: Fn = vi.fn(async () => true);
    const { result } = montar(update);
    act(() => { result.current.openEdit({ id: 't1', data_inicio: new Date(2026, 9, 9, 23, 0).toISOString(), data_fim: new Date(2026, 9, 10, 0, 0).toISOString() }); });
    act(() => { result.current.setMDesc('Plantão'); result.current.setMCat('outro' as never); result.current.setMInicio('23:00'); result.current.setMFim('01:00'); result.current.setMValor('100'); });
    await act(async () => { await result.current.saveManual(); });
    expect(update).toHaveBeenCalledTimes(1);
    const [id, payload] = update.mock.calls[0] as [string, Record<string, unknown>];
    expect(id).toBe('t1');
    expect(payload.duracao_minutos).toBe(120);
    expect(payload.valor_hora).toBe(100);
    expect(new Date(payload.data_fim as string).getTime() - new Date(payload.data_inicio as string).getTime()).toBe(120 * 60000);

    act(() => { result.current.openManual(); });
    await act(async () => { await result.current.saveManual(); });
    expect(update).toHaveBeenCalledTimes(1);
    expect(result.current.manualOpen).toBe(true);
  });
});
