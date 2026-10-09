// useConsultivoCategorias: carga, bloqueio do create enquanto a lista não carregou,
// slug gerado do rótulo e mutations com linhas afetadas.
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

import { useConsultivoCategorias } from '@/hooks/useConsultivoCategorias';

describe('useConsultivoCategorias', () => {
  beforeEach(() => { resetSupabaseMock(); mockToast.mockClear(); });

  it('carrega as categorias do escritório ordenadas', async () => {
    enfileirar('consultivo_categorias', { data: [{ id: 'k1', label: 'Contratos', valor: 'contratos' }] });
    const { result } = renderHook(() => useConsultivoCategorias());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toHaveLength(1);
    const sel = chamadasCom('consultivo_categorias', 'select')[0];
    expect(sel.ops).toEqual(expect.arrayContaining([['eq', ['office_id', 'o1']], ['order', ['ordem']]]));
  });

  it('com a carga falhando, expõe o erro e não deixa criar (a ordem seria gravada errada)', async () => {
    enfileirar('consultivo_categorias', { error: { message: 'boom' } });
    const { result } = renderHook(() => useConsultivoCategorias());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('boom');
    let ok: boolean | undefined;
    await act(async () => { ok = await result.current.create('Família', 'rose', 'Users'); });
    expect(ok).toBe(false);
    expect(chamadasCom('consultivo_categorias', 'insert')).toHaveLength(0);
  });

  it('create gera o slug sem acento e com a ordem = tamanho da lista', async () => {
    enfileirar('consultivo_categorias', { data: [{ id: 'k1' }, { id: 'k2' }] });
    const { result } = renderHook(() => useConsultivoCategorias());
    await waitFor(() => expect(result.current.loading).toBe(false));
    enfileirar('consultivo_categorias', { data: null });
    enfileirar('consultivo_categorias', { data: [{ id: 'k1' }, { id: 'k2' }, { id: 'k3' }] });
    await act(async () => { await result.current.create('Direito de Família', 'rose', 'Users'); });
    const ins = chamadasCom('consultivo_categorias', 'insert').at(-1)!;
    expect(ins.ops.find(([m]) => m === 'insert')![1][0]).toMatchObject({ valor: 'direito_de_familia', ordem: 2, office_id: 'o1' });
  });

  it('update e remove barrados pela RLS devolvem false com toast', async () => {
    enfileirar('consultivo_categorias', { data: [{ id: 'k1' }] });
    const { result } = renderHook(() => useConsultivoCategorias());
    await waitFor(() => expect(result.current.loading).toBe(false));
    enfileirar('consultivo_categorias', { data: [] });
    let ok: boolean | undefined;
    await act(async () => { ok = await result.current.update('k1', 'X', 'blue', 'Star'); });
    expect(ok).toBe(false);
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Erro ao atualizar', description: PERMISSAO_NEGADA }));
    enfileirar('consultivo_categorias', { data: [] });
    await act(async () => { ok = await result.current.remove('k1'); });
    expect(ok).toBe(false);
    expect(result.current.data).toHaveLength(1);
  });
});
