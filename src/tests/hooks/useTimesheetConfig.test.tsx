// Mesma regressão do useOfficeSettingList (PR #88/#89), na variante TanStack
// Query: queryFn precisa propagar o erro (throw) em vez de descartá-lo, senão
// a query "tinha sucesso" com EMPTY e `save` gravaria valorClientes: {} por
// cima dos valores por cliente já configurados. Teste crítico: update nunca é
// chamado quando o load falhou.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTimesheetConfig } from '@/hooks/useTimesheetConfig';

interface LoadResult { data: { settings?: Record<string, unknown> } | null; error: { message: string } | null }
interface UpdateResult { data: Array<{ id: string }> | null; error: { message: string } | null }

let loadResult: LoadResult;
let updateResult: UpdateResult;
const updateSpy = vi.fn();

vi.mock('@/integrations/supabase/client', () => {
  const readChain = {
    eq: () => readChain,
    maybeSingle: (): Promise<LoadResult> => Promise.resolve(loadResult),
  };
  const writeChain = {
    eq: () => writeChain,
    select: (): Promise<UpdateResult> => Promise.resolve(updateResult),
  };
  return {
    supabase: {
      from: () => ({
        select: () => readChain,
        update: (patch: Record<string, unknown>) => { updateSpy(patch); return writeChain; },
      }),
    },
  };
});

const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({ toast: mockToast })),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
};

describe('useTimesheetConfig — bloqueio de save após load com erro', () => {
  beforeEach(() => {
    mockToast.mockClear();
    updateSpy.mockClear();
    loadResult = { data: null, error: null };
    updateResult = { data: [{ id: 'office-1' }], error: null };
  });

  it('load com erro: isError true, config cai pro EMPTY e save RECUSA gravar (update nunca é chamado)', async () => {
    loadResult = { data: null, error: { message: 'network down' } };

    const { result } = renderHook(() => useTimesheetConfig('office-1'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.config).toEqual({ valorPadrao: null, valorClientes: {}, arredondamento: 'nenhum' });

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.save({ valorPadrao: 500, valorClientes: { 'cliente-forjado': 999 }, arredondamento: 'nenhum' });
    });

    expect(ok).toBe(false);
    expect(updateSpy).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive', title: 'Não foi possível salvar' }));
  });

  it('load com sucesso: save funciona normalmente e chama update', async () => {
    loadResult = { data: { settings: { ts_valor_hora_padrao: 350, ts_valor_hora_clientes: { 'cliente-1': 300 } } }, error: null };

    const { result } = renderHook(() => useTimesheetConfig('office-1'), { wrapper });

    await waitFor(() => expect(result.current.config.valorPadrao).toBe(350));
    expect(result.current.isError).toBe(false);
    expect(result.current.config.valorClientes).toEqual({ 'cliente-1': 300 });

    let ok: boolean | undefined;
    await act(async () => { ok = await result.current.save({ valorPadrao: 400 }); });

    expect(ok).toBe(true);
    expect(updateSpy).toHaveBeenCalledTimes(1);
  });
});
