// Hook de Processos: lista via RLS (sem filtro manual), mapeamento, erro visível
// e arquivamento conferido.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { enfileirar, chamadasCom, resetSupabaseMock } from '../helpers/supabaseMock';

vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabase } = await import('../helpers/supabaseMock');
  return { supabase: mockSupabase };
});
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', office_id: 'o1' } }) }));
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }));

import { useProcessosV2, mapDatabaseToProcesso } from '@/hooks/useProcessosV2';

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
};
const row = (over: Record<string, unknown> = {}) => ({
  id: 'p1', titulo: 'Ação X', cliente: { nome: 'Maria' }, cliente_id: 'c1', status: 'ativo',
  numero_processo: '07070581820268070006', created_at: '2026-01-10T00:00:00Z', user_id: 'u1',
  office_id: 'o1', deletado: false, ...over,
});

describe('mapDatabaseToProcesso', () => {
  it('traduz status ativo → "Em andamento", cliente aninhado e flags com default false', () => {
    const p = mapDatabaseToProcesso(row());
    expect(p).toMatchObject({ id: 'p1', status: 'Em andamento', cliente: 'Maria', clienteId: 'c1', segredoJustica: false, justicaGratuita: false, officeId: 'o1' });
  });
  it('sem cliente vinculado usa o rótulo padrão', () => {
    expect(mapDatabaseToProcesso(row({ cliente: null })).cliente).toBe('Cliente não vinculado');
  });
});

describe('useProcessosV2', () => {
  beforeEach(() => { resetSupabaseMock(); mockToast.mockClear(); });

  it('lista confia na RLS: filtra só deletado=false, sem office_id/user_id manual', async () => {
    enfileirar('processos', { data: [row(), row({ id: 'p2' })] });
    const { result } = renderHook(() => useProcessosV2(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toHaveLength(2);
    const sel = chamadasCom('processos', 'select')[0];
    expect(sel.ops).toEqual(expect.arrayContaining([['eq', ['deletado', false]]]));
    expect(sel.ops.some(([m, a]) => m === 'eq' && (a[0] === 'office_id' || a[0] === 'user_id'))).toBe(false);
  });

  it('lista: false não consulta (só expõe as mutations)', async () => {
    const { result } = renderHook(() => useProcessosV2({ lista: false }), { wrapper });
    expect(result.current.loading).toBe(false);
    expect(chamadasCom('processos', 'select')).toHaveLength(0);
  });

  it('erro na busca vira `error` em texto (não lista vazia silenciosa)', async () => {
    // o hook tem retry: 1 — a segunda tentativa também precisa falhar
    enfileirar('processos', { error: { message: 'policy' } }, { error: { message: 'policy' } });
    const { result } = renderHook(() => useProcessosV2(), { wrapper });
    await waitFor(() => expect(result.current.error).toBe('policy'), { timeout: 4000 });
    expect(result.current.data).toEqual([]);
  });

  it('arquivar barrado pela RLS (0 linhas) → "Erro ao excluir processo", nunca "Processo arquivado"', async () => {
    enfileirar('processos', { data: [] });
    const { result } = renderHook(() => useProcessosV2(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    enfileirar('processos', { data: [] });
    await act(async () => { await result.current.requestDelete('p1').catch(() => undefined); });
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Erro ao excluir processo', variant: 'destructive' }));
    expect(mockToast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Processo arquivado' }));
  });

  it('arquivar com sucesso usa soft delete pendente e avisa', async () => {
    enfileirar('processos', { data: [] });
    const { result } = renderHook(() => useProcessosV2(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    enfileirar('processos', { data: [{ id: 'p1' }] });
    await act(async () => { await result.current.requestDelete('p1'); });
    const upd = chamadasCom('processos', 'update').at(-1)!;
    expect(upd.ops.find(([m]) => m === 'update')![1][0]).toMatchObject({ deletado: true, deletado_pendente: true });
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Processo arquivado' }));
  });

  it('update traduz campos (status "Em andamento" → ativo, CNJ só dígitos) e usa .single()', async () => {
    enfileirar('processos', { data: [] });
    const { result } = renderHook(() => useProcessosV2(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    enfileirar('processos', { data: row({ titulo: 'Novo título' }) });
    await act(async () => { await result.current.update('p1', { titulo: 'Novo título', status: 'Em andamento', numeroProcesso: '0707058-18.2026.8.07.0006' }); });
    const upd = chamadasCom('processos', 'update').at(-1)!;
    expect(upd.ops.find(([m]) => m === 'update')![1][0]).toMatchObject({ titulo: 'Novo título', status: 'ativo', numero_processo: '07070581820268070006' });
    expect(upd.ops.some(([m]) => m === 'single')).toBe(true);
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Processo atualizado' }));
  });
});
