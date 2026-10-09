// useAudienciaTipos: tabela por escritório com semeadura; localStorage só quando a
// tabela não existe; erro bloqueia a edição; mutations com RLS desfazem o otimista.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { enfileirar, chamadasCom, chamadas, resetSupabaseMock } from '../helpers/supabaseMock';

vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabase } = await import('../helpers/supabaseMock');
  return { supabase: mockSupabase };
});
const auth = { user: { id: 'u1', office_id: 'o1' } as { id: string; office_id: string | null } };
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }));
const captureError = vi.fn();
vi.mock('@/lib/monitoring', () => ({ captureError: (...a: unknown[]) => captureError(...a) }));

import { useAudienciaTipos } from '@/hooks/useAudienciaTipos';

const linhas = (...nomes: string[]) => ({ data: nomes.map((nome) => ({ nome })) });

describe('useAudienciaTipos', () => {
  beforeEach(() => { resetSupabaseMock(); mockToast.mockClear(); captureError.mockClear(); localStorage.clear(); auth.user = { id: 'u1', office_id: 'o1' }; });

  it('carrega da tabela do escritório; tabela vazia semeia com os padrões', async () => {
    enfileirar('audiencia_tipos', linhas('Instrução', 'Una'));
    const { result } = renderHook(() => useAudienciaTipos());
    await waitFor(() => expect(result.current.tipos).toEqual(['Instrução', 'Una']));
    expect(chamadasCom('audiencia_tipos', 'select')[0].ops).toEqual(expect.arrayContaining([['eq', ['office_id', 'o1']]]));
    expect(chamadasCom('audiencia_tipos', 'insert')).toHaveLength(0);

    resetSupabaseMock();
    enfileirar('audiencia_tipos', { data: [] });
    const { result: r2 } = renderHook(() => useAudienciaTipos());
    await waitFor(() => expect(r2.current.tipos.length).toBeGreaterThan(0));
    expect(r2.current.tipos).toContain('Conciliação');
    const ins = chamadasCom('audiencia_tipos', 'insert')[0];
    expect((ins.ops[0][1][0] as unknown[]).length).toBe(r2.current.tipos.length);
    expect((ins.ops[0][1][0] as Array<{ office_id: string }>)[0].office_id).toBe('o1');
  });

  it('tabela inexistente → modo local (grava no localStorage); outro erro → bloqueia a edição', async () => {
    localStorage.setItem('audiencia_tipos_o1', JSON.stringify(['Local A']));
    enfileirar('audiencia_tipos', { error: { code: '42P01', message: 'relation does not exist' } });
    const { result } = renderHook(() => useAudienciaTipos());
    await waitFor(() => expect(result.current.tipos).toEqual(['Local A']));
    expect(result.current.error).toBeNull();
    act(() => { expect(result.current.add('Novo')).toBe(true); });
    expect(JSON.parse(localStorage.getItem('audiencia_tipos_o1')!)).toEqual(['Local A', 'Novo']);
    expect(chamadasCom('audiencia_tipos', 'insert')).toHaveLength(0);

    resetSupabaseMock(); mockToast.mockClear();
    enfileirar('audiencia_tipos', { error: { message: 'permission denied' } });
    const { result: r2 } = renderHook(() => useAudienciaTipos());
    await waitFor(() => expect(r2.current.error).toBe('permission denied'));
    expect(r2.current.tipos).toEqual(['Local A', 'Novo']); // referência local, só leitura
    act(() => { expect(r2.current.add('Bloqueado')).toBe(false); });
    act(() => { r2.current.remove('Novo'); });
    expect(r2.current.tipos).toEqual(['Local A', 'Novo']);
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Não foi possível salvar' }));
    expect(chamadasCom('audiencia_tipos', 'insert')).toHaveLength(0);
    expect(chamadasCom('audiencia_tipos', 'delete')).toHaveLength(0);
  });

  it('add: ignora duplicata (case-insensitive) e insere no banco em ordem alfabética', async () => {
    enfileirar('audiencia_tipos', linhas('Instrução', 'Una'));
    const { result } = renderHook(() => useAudienciaTipos());
    await waitFor(() => expect(result.current.tipos).toHaveLength(2));
    act(() => { expect(result.current.add('  una ')).toBe(false); });
    act(() => { expect(result.current.add('')).toBe(false); });
    await act(async () => { expect(result.current.add(' Cível ')).toBe(true); });
    expect(result.current.tipos).toEqual(['Cível', 'Instrução', 'Una']);
    expect(chamadasCom('audiencia_tipos', 'insert')[0].ops[0]).toEqual(['insert', [{ office_id: 'o1', nome: 'Cível' }]]);
  });

  it('rename/remove: RLS barrando (0 linhas) → toast e recarrega, desfazendo o otimista', async () => {
    enfileirar('audiencia_tipos', linhas('Instrução', 'Una'));
    const { result } = renderHook(() => useAudienciaTipos());
    await waitFor(() => expect(result.current.tipos).toHaveLength(2));

    enfileirar('audiencia_tipos', { data: [] }); // update barrado
    enfileirar('audiencia_tipos', linhas('Instrução', 'Una')); // reload
    await act(async () => { expect(result.current.rename('Una', 'Unificada')).toBe(true); });
    await waitFor(() => expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Erro ao renomear tipo' })));
    await waitFor(() => expect(result.current.tipos).toEqual(['Instrução', 'Una']));
    const up = chamadasCom('audiencia_tipos', 'update')[0];
    expect(up.ops).toEqual(expect.arrayContaining([['update', [{ nome: 'Unificada' }]], ['eq', ['nome', 'Una']], ['select', ['id']]]));

    enfileirar('audiencia_tipos', { data: [{ id: 'x' }] }); // delete ok
    await act(async () => { result.current.remove('Una'); });
    expect(result.current.tipos).toEqual(['Instrução']);
    const del = chamadasCom('audiencia_tipos', 'delete')[0];
    expect(del.ops).toEqual(expect.arrayContaining([['eq', ['office_id', 'o1']], ['eq', ['nome', 'Una']], ['select', ['id']]]));
  });

  it('reset: insere os padrões que faltam antes de apagar os extras', async () => {
    enfileirar('audiencia_tipos', linhas('Conciliação', 'Extra'));
    const { result } = renderHook(() => useAudienciaTipos());
    await waitFor(() => expect(result.current.tipos).toHaveLength(2));
    enfileirar('audiencia_tipos', { data: null }); // insert dos faltantes
    enfileirar('audiencia_tipos', { data: [{ id: 'e' }] }); // delete do extra
    enfileirar('audiencia_tipos', linhas('Cível', 'Conciliação')); // reload
    await act(async () => { result.current.reset(); });
    await waitFor(() => expect(chamadasCom('audiencia_tipos', 'order')).toHaveLength(2));
    const ins = chamadasCom('audiencia_tipos', 'insert')[0];
    const nomes = (ins.ops[0][1][0] as Array<{ nome: string }>).map((r) => r.nome);
    expect(nomes).not.toContain('Conciliação');
    expect(nomes).toContain('Cível');
    const del = chamadasCom('audiencia_tipos', 'delete')[0];
    expect(del.ops).toEqual(expect.arrayContaining([['in', ['nome', ['Extra']]], ['select', ['id']]]));
    expect(chamadas.indexOf(ins)).toBeLessThan(chamadas.indexOf(del)); // insere antes de apagar
    expect(mockToast).not.toHaveBeenCalled();
  });
});
