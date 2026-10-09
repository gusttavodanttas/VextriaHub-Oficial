// useProcessosEncontrados (caixa "Processos Encontrados"): carga, remoção que exige
// linha afetada e descarte com desfazer quando o registro falha.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { enfileirar, chamadasCom, resetSupabaseMock } from '../helpers/supabaseMock';
import { PERMISSAO_NEGADA } from '@/lib/errors';

vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabase } = await import('../helpers/supabaseMock');
  return { supabase: mockSupabase };
});
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', office_id: 'o1' } }) }));

import { useProcessosEncontrados } from '@/hooks/useProcessosEncontrados';

const item = { id: 'e1', numero_processo: '0707058-18.2026.8.07.0006', titulo: 'A x B', tribunal: null, payload: {} } as any;

describe('useProcessosEncontrados', () => {
  beforeEach(() => resetSupabaseMock());

  it('carrega a caixa do escritório e expõe erro de carga', async () => {
    enfileirar('processos_encontrados', { data: [item] });
    const { result } = renderHook(() => useProcessosEncontrados());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.count).toBe(1);
    expect(chamadasCom('processos_encontrados', 'select')[0].ops).toContainEqual(['eq', ['office_id', 'o1']]);

    resetSupabaseMock();
    enfileirar('processos_encontrados', { error: { message: 'boom' } });
    await act(async () => { await result.current.refetch(); });
    expect(result.current.error).toBe('boom');
  });

  it('remover: 0 linhas lança e o item continua na caixa', async () => {
    enfileirar('processos_encontrados', { data: [item] });
    const { result } = renderHook(() => useProcessosEncontrados());
    await waitFor(() => expect(result.current.loading).toBe(false));
    enfileirar('processos_encontrados', { data: [] });
    await expect(act(async () => { await result.current.remover('e1'); })).rejects.toThrow(PERMISSAO_NEGADA);
    expect(result.current.items).toHaveLength(1);
  });

  it('descartar: falha ao registrar o descarte desfaz o otimismo; duplicado segue e remove da caixa', async () => {
    enfileirar('processos_encontrados', { data: [item] });
    const { result } = renderHook(() => useProcessosEncontrados());
    await waitFor(() => expect(result.current.loading).toBe(false));

    enfileirar('processos_descartados', { error: { message: 'rede caiu' } });
    await expect(act(async () => { await result.current.descartar(item); })).rejects.toThrow('rede caiu');
    expect(result.current.items).toHaveLength(1);
    expect(chamadasCom('processos_encontrados', 'delete')).toHaveLength(0);

    enfileirar('processos_descartados', { error: { message: 'duplicate key value violates unique constraint' } });
    enfileirar('processos_encontrados', { data: [{ id: 'e1' }] });
    await act(async () => { await result.current.descartar(item); });
    expect(result.current.items).toHaveLength(0);
    const ins = chamadasCom('processos_descartados', 'insert').at(-1)!;
    expect(ins.ops.find(([m]) => m === 'insert')![1][0]).toMatchObject({ office_id: 'o1', numero_processo: '07070581820268070006', motivo: 'descartado_inbox', tribunal: expect.any(String) });
  });
});
