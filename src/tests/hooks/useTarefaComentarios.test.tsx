// useTarefaComentarios / useSubtarefas: lista por tarefa (tabela ausente = vazio),
// adicionar com office/user e exclusão/toggle com checagem de linhas (RLS).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { enfileirar, chamadasCom, resetSupabaseMock } from '../helpers/supabaseMock';
import { wrapper } from './_setup';

vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabase } = await import('../helpers/supabaseMock');
  return { supabase: mockSupabase };
});
const auth = { user: { id: 'u1', office_id: 'o1' } as { id: string; office_id: string | null } | null };
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }));

import { useTarefaComentarios } from '@/hooks/useTarefaComentarios';
import { useSubtarefas } from '@/hooks/useSubtarefas';

describe('useTarefaComentarios', () => {
  beforeEach(() => { resetSupabaseMock(); mockToast.mockClear(); auth.user = { id: 'u1', office_id: 'o1' }; });

  it('lista os comentários não excluídos da tarefa em ordem cronológica', async () => {
    enfileirar('tarefa_comentarios', { data: [{ id: 'c1', texto: 'oi' }] });
    const { result } = renderHook(() => useTarefaComentarios('t1'), { wrapper });
    await waitFor(() => expect(result.current.comentarios).toHaveLength(1));
    expect(chamadasCom('tarefa_comentarios', 'select')[0].ops).toEqual(expect.arrayContaining([['eq', ['tarefa_id', 't1']], ['eq', ['deletado', false]], ['order', ['created_at', { ascending: true }]]]));
  });

  it('tabela ausente → lista vazia sem erro; outro erro → isError; sem tarefa não consulta', async () => {
    enfileirar('tarefa_comentarios', { error: { code: 'PGRST205', message: 'schema cache' } });
    const { result } = renderHook(() => useTarefaComentarios('t1'), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.comentarios).toEqual([]);
    expect(result.current.isError).toBe(false);

    enfileirar('tarefa_comentarios', { error: { message: 'boom' } });
    const { result: r2 } = renderHook(() => useTarefaComentarios('t2'), { wrapper });
    await waitFor(() => expect(r2.current.isError).toBe(true));

    resetSupabaseMock();
    renderHook(() => useTarefaComentarios(null), { wrapper });
    expect(chamadasCom('tarefa_comentarios', 'select')).toHaveLength(0);
  });

  it('add insere com tarefa/escritório/usuário e texto limpo; sem escritório falha com toast', async () => {
    enfileirar('tarefa_comentarios', { data: [] });
    const { result } = renderHook(() => useTarefaComentarios('t1'), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    enfileirar('tarefa_comentarios', { data: null });
    await act(async () => { await result.current.add.mutateAsync('  olá  '); });
    expect(chamadasCom('tarefa_comentarios', 'insert')[0].ops[0]).toEqual(['insert', [{ tarefa_id: 't1', office_id: 'o1', user_id: 'u1', texto: 'olá' }]]);

    auth.user = { id: 'u1', office_id: null };
    const { result: r2 } = renderHook(() => useTarefaComentarios('t1'), { wrapper });
    await act(async () => { await r2.current.add.mutateAsync('x').catch(() => undefined); });
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Erro ao comentar', description: 'Sem tarefa/escritório/usuário' }));
    expect(chamadasCom('tarefa_comentarios', 'insert')).toHaveLength(1);
  });

  it('remove é soft-delete com .select; RLS (0 linhas) → toast', async () => {
    enfileirar('tarefa_comentarios', { data: [] });
    const { result } = renderHook(() => useTarefaComentarios('t1'), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    enfileirar('tarefa_comentarios', { data: [{ id: 'c1' }] });
    await act(async () => { await result.current.remove.mutateAsync('c1'); });
    expect(chamadasCom('tarefa_comentarios', 'update')[0].ops).toEqual(expect.arrayContaining([['update', [{ deletado: true }]], ['eq', ['id', 'c1']], ['select', ['id']]]));
    expect(mockToast).not.toHaveBeenCalled();
    enfileirar('tarefa_comentarios', { data: [] });
    await act(async () => { await result.current.remove.mutateAsync('c1').catch(() => undefined); });
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Erro ao excluir' }));
  });
});

describe('useSubtarefas', () => {
  beforeEach(() => { resetSupabaseMock(); mockToast.mockClear(); auth.user = { id: 'u1', office_id: 'o1' }; });

  it('lista por ordem e data; add usa a próxima posição; toggle grava concluida com .select', async () => {
    enfileirar('tarefa_subtarefas', { data: [{ id: 's1', titulo: 'a', concluida: false, ordem: 0 }, { id: 's2', titulo: 'b', concluida: true, ordem: 1 }] });
    const { result } = renderHook(() => useSubtarefas('t1'), { wrapper });
    await waitFor(() => expect(result.current.subtarefas).toHaveLength(2));
    expect(chamadasCom('tarefa_subtarefas', 'select')[0].ops).toEqual(expect.arrayContaining([['eq', ['tarefa_id', 't1']], ['eq', ['deletado', false]], ['order', ['ordem', { ascending: true }]], ['order', ['created_at', { ascending: true }]]]));

    enfileirar('tarefa_subtarefas', { data: null });
    await act(async () => { await result.current.add.mutateAsync(' c '); });
    expect(chamadasCom('tarefa_subtarefas', 'insert')[0].ops[0]).toEqual(['insert', [{ tarefa_id: 't1', office_id: 'o1', titulo: 'c', ordem: 2 }]]);

    enfileirar('tarefa_subtarefas', { data: [{ id: 's1' }] });
    await act(async () => { await result.current.toggle.mutateAsync({ id: 's1', concluida: true }); });
    expect(chamadasCom('tarefa_subtarefas', 'update')[0].ops).toEqual(expect.arrayContaining([['update', [{ concluida: true }]], ['eq', ['id', 's1']], ['select', ['id']]]));
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('tabela ausente → vazio; erro no add vira toast com a mensagem', async () => {
    enfileirar('tarefa_subtarefas', { error: { code: '42P01', message: 'relation does not exist' } });
    const { result } = renderHook(() => useSubtarefas('t1'), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.subtarefas).toEqual([]);
    expect(result.current.isError).toBe(false);

    enfileirar('tarefa_subtarefas', { error: { message: 'insert negado' } });
    await act(async () => { await result.current.add.mutateAsync('x').catch(() => undefined); });
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Erro ao adicionar item', description: 'insert negado' }));
  });
});
