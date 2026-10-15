// Hook de Clientes (useState + invalidação das listas TanStack): lista, criação com
// saneamento de campos, exclusão direta (admin) e pedido de exclusão (comum).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { enfileirar, chamadasCom, resetSupabaseMock } from '../helpers/supabaseMock';
import { PERMISSAO_NEGADA } from '@/lib/errors';

vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabase } = await import('../helpers/supabaseMock');
  return { supabase: mockSupabase };
});
const auth = { user: { id: 'u1', office_id: 'o1' }, isAdmin: false, isOfficeAdmin: true, isSuperAdmin: false };
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
const perms = { canDeleteClients: true };
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => perms }));
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }));

import { useClientes } from '@/hooks/useClientes';

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
};
const cli = (over: Record<string, unknown> = {}) => ({ id: 'c1', nome: 'Maria', office_id: 'o1', deletado: false, deletado_pendente: false, processos: [{ count: 2 }], ...over });

describe('useClientes', () => {
  beforeEach(() => { resetSupabaseMock(); mockToast.mockClear(); auth.isOfficeAdmin = true; perms.canDeleteClients = true; });

  it('lista do escritório filtra deletado e deletado_pendente', async () => {
    enfileirar('clientes', { data: [cli()] });
    const { result } = renderHook(() => useClientes(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toHaveLength(1);
    const sel = chamadasCom('clientes', 'select')[0];
    expect(sel.ops).toEqual(expect.arrayContaining([['eq', ['office_id', 'o1']], ['eq', ['deletado', false]], ['eq', ['deletado_pendente', false]]]));
  });

  it('erro na busca é exposto em `error`', async () => {
    enfileirar('clientes', { error: { message: 'rede' } });
    const { result } = renderHook(() => useClientes(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeTruthy();
  });

  it('criar converte strings vazias de data/endereço/origem em null e grava office_id/user_id', async () => {
    enfileirar('clientes', { data: [] });
    const { result } = renderHook(() => useClientes(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    enfileirar('clientes', { data: cli({ id: 'c9', nome: 'Novo' }) });
    let criado: unknown;
    await act(async () => { criado = await result.current.create({ nome: 'Novo', data_aniversario: '', endereco: '', origem: '' } as never); });
    expect(criado).toMatchObject({ id: 'c9' });
    const ins = chamadasCom('clientes', 'insert').at(-1)!;
    const payload = (ins.ops.find(([m]) => m === 'insert')![1][0] as Array<Record<string, unknown>>)[0];
    expect(payload).toMatchObject({ nome: 'Novo', data_aniversario: null, endereco: null, origem: null, office_id: 'o1', user_id: 'u1' });
    expect(result.current.data[0]).toMatchObject({ id: 'c9' });
  });

  it('criar com erro de cota de plano mostra a mensagem acionável e devolve null', async () => {
    enfileirar('clientes', { data: [] });
    const { result } = renderHook(() => useClientes(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    enfileirar('clientes', { error: { message: 'PLAN_QUOTA_EXCEEDED: clientes 30/30 (Básico)' } });
    let criado: unknown = 'x';
    await act(async () => { criado = await result.current.create({ nome: 'Novo' } as never); });
    expect(criado).toBeNull();
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
  });

  it('admin: excluir direto barrado pela RLS → erro, lista intacta', async () => {
    enfileirar('clientes', { data: [cli()] });
    const { result } = renderHook(() => useClientes(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    enfileirar('clientes', { data: [] });
    let ok: boolean | undefined;
    await act(async () => { ok = await result.current.requestDelete('c1'); });
    expect(ok).toBe(false);
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive', description: PERMISSAO_NEGADA }));
    expect(result.current.data).toHaveLength(1);
  });

  it('comum: pedido de exclusão falha e a reversão do deletado_pendente é barrada → erro cita a Lixeira', async () => {
    auth.isOfficeAdmin = false;
    enfileirar('clientes', { data: [cli()] });
    const { result } = renderHook(() => useClientes(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    enfileirar('clientes', { data: [{ id: 'c1' }] });            // marca deletado_pendente
    enfileirar('exclusoes_pendentes', { error: { message: 'boom' } }); // registro da solicitação falha
    enfileirar('clientes', { data: [] });                          // reversão barrada pela RLS (0 linhas)
    let ok: boolean | undefined;
    await act(async () => { ok = await result.current.requestDelete('c1', 'motivo'); });
    expect(ok).toBe(false);
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive', description: expect.stringContaining('Lixeira') }));
    const reversao = chamadasCom('clientes', 'update').at(-1)!;
    expect(reversao.ops).toEqual(expect.arrayContaining([['update', [{ deletado_pendente: false }]], ['in', ['id', ['c1']]]]));
    expect(reversao.ops.some(([m]) => m === 'select')).toBe(true);
  });

  it('sem permissão canDeleteClients não chama o banco e devolve false', async () => {
    perms.canDeleteClients = false;
    enfileirar('clientes', { data: [cli()] });
    const { result } = renderHook(() => useClientes(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    let ok: boolean | undefined;
    await act(async () => { ok = await result.current.requestDelete('c1'); });
    expect(ok).toBe(false);
    expect(chamadasCom('clientes', 'update')).toHaveLength(0);
  });
});
