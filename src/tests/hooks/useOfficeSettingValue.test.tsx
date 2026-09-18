// Mesma regressão do useOfficeSettingList (PR #88), pro caso de valor escalar:
// se o fetch inicial falha, `save` bloqueia em vez de gravar o defaultValue por
// cima do valor real — o teste crítico é que `update` nunca é chamado.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useOfficeSettingValue } from '@/hooks/useOfficeSettingValue';

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

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: { id: 'user-1', office_id: 'office-1' } })),
}));

const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({ toast: mockToast })),
}));

describe('useOfficeSettingValue — bloqueio de save após load com erro', () => {
  beforeEach(() => {
    mockToast.mockClear();
    updateSpy.mockClear();
    loadResult = { data: null, error: null };
    updateResult = { data: [{ id: 'office-1' }], error: null };
  });

  it('load com erro: expõe error, mantém defaultValue e RECUSA save (update nunca é chamado)', async () => {
    loadResult = { data: null, error: { message: 'network down' } };

    const { result } = renderHook(() => useOfficeSettingValue<number>('ts_valor_hora_padrao', 0));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeTruthy();
    expect(result.current.value).toBe(0);

    let ok: boolean | undefined;
    await act(async () => { ok = await result.current.save(999); });

    expect(ok).toBe(false);
    expect(updateSpy).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive', title: 'Não foi possível salvar' }));
    // value não deve ter sido otimisticamente trocado pro que seria gravado
    expect(result.current.value).toBe(0);
  });

  it('load com sucesso: save funciona normalmente e chama update', async () => {
    loadResult = { data: { settings: { ts_valor_hora_padrao: 350 } }, error: null };

    const { result } = renderHook(() => useOfficeSettingValue<number>('ts_valor_hora_padrao', 0));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.value).toBe(350);

    let ok: boolean | undefined;
    await act(async () => { ok = await result.current.save(400); });

    expect(ok).toBe(true);
    expect(updateSpy).toHaveBeenCalledTimes(1);
  });
});
