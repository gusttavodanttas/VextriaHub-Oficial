// Trava a regressão corrigida na PR #88: se o fetch inicial de offices.settings
// falha, `persist` fazia sua própria leitura fresca e gravava os `defaults` por
// cima da configuração real (perda de dado silenciosa). `persist` agora recusa
// gravar enquanto o load não tiver sucesso — o teste crítico aqui é que o
// `update` NUNCA é chamado nesse cenário.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useOfficeSettingList } from '@/hooks/useOfficeSettingList';

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

const DEFAULTS = ['Indicação', 'Site'];

describe('useOfficeSettingList — bloqueio de persist após load com erro', () => {
  beforeEach(() => {
    mockToast.mockClear();
    updateSpy.mockClear();
    loadResult = { data: null, error: null };
    updateResult = { data: [{ id: 'office-1' }], error: null };
  });

  it('load com erro: expõe error, mantém defaults e RECUSA persist (update nunca é chamado)', async () => {
    loadResult = { data: null, error: { message: 'network down' } };

    const { result } = renderHook(() => useOfficeSettingList<string>('origens_cliente', DEFAULTS));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeTruthy();
    expect(result.current.items).toEqual(DEFAULTS);

    let ok: boolean | undefined;
    await act(async () => { ok = await result.current.persist(['Categoria forjada']); });

    expect(ok).toBe(false);
    expect(updateSpy).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive', title: 'Não foi possível salvar' }));
    // items não deve ter mudado pro valor que seria gravado — sem otimista nesse caminho
    expect(result.current.items).toEqual(DEFAULTS);
  });

  it('load com sucesso: persist funciona normalmente e chama update', async () => {
    loadResult = { data: { settings: { origens_cliente: ['Indicação'] } }, error: null };

    const { result } = renderHook(() => useOfficeSettingList<string>('origens_cliente', DEFAULTS));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.items).toEqual(['Indicação']);

    let ok: boolean | undefined;
    await act(async () => { ok = await result.current.persist(['Indicação', 'Nova origem']); });

    expect(ok).toBe(true);
    expect(updateSpy).toHaveBeenCalledTimes(1);
  });

  it('refetch depois de um load com erro limpa o error e permite persist de novo', async () => {
    loadResult = { data: null, error: { message: 'timeout' } };
    const { result } = renderHook(() => useOfficeSettingList<string>('origens_cliente', DEFAULTS));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeTruthy();

    loadResult = { data: { settings: {} }, error: null };
    await act(async () => { await result.current.refetch(); });

    expect(result.current.error).toBeNull();

    let ok: boolean | undefined;
    await act(async () => { ok = await result.current.persist(['Nova origem']); });
    expect(ok).toBe(true);
    expect(updateSpy).toHaveBeenCalledTimes(1);
  });
});
