// useClientesLista / useClientesStats / useClientesAniversariantesDoMes: lista
// paginada sem leads, filtros e busca no servidor, contagens que falham alto.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { enfileirar, chamadasCom, resetSupabaseMock } from '../helpers/supabaseMock';
import { wrapper } from './_setup';

vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabase } = await import('../helpers/supabaseMock');
  return { supabase: mockSupabase };
});
const auth = { user: { id: 'u1', office_id: 'o1' } as { id: string; office_id: string | null } | null };
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));

import { useClientesLista, useClientesStats, useClientesAniversariantesDoMes } from '@/hooks/useClientesLista';

const SEM_LEAD = 'status.is.null,status.not.ilike.lead';

describe('useClientesLista', () => {
  beforeEach(() => { resetSupabaseMock(); auth.user = { id: 'u1', office_id: 'o1' }; });

  it('exclui leads e excluídos, pagina e ordena por recentes por padrão', async () => {
    enfileirar('clientes', { data: [{ id: 'c1', nome: 'Ana' }], count: 23 });
    const { result } = renderHook(() => useClientesLista({ page: 3, pageSize: 10, sortBy: 'recentes' }), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.total).toBe(23);
    expect(result.current.data).toEqual([{ id: 'c1', nome: 'Ana' }]);
    const sel = chamadasCom('clientes', 'select')[0];
    expect(sel.ops).toEqual(expect.arrayContaining([
      ['eq', ['office_id', 'o1']], ['eq', ['deletado', false]], ['eq', ['deletado_pendente', false]],
      ['or', [SEM_LEAD]], ['order', ['created_at', { ascending: false }]], ['range', [20, 29]],
    ]));
    expect(sel.ops.filter(([m]) => m === 'or')).toHaveLength(1);
  });

  it('aplica todos os filtros e a busca com escape; ordena por nome', async () => {
    enfileirar('clientes', { data: [], count: 0 });
    const de = new Date('2026-01-01T00:00:00Z'); const ate = new Date('2026-02-01T00:00:00Z');
    const { result } = renderHook(() => useClientesLista({
      page: 1, pageSize: 20, sortBy: 'nome', search: ' Silva, "Ltda" ', tipoPessoa: 'juridica', origem: 'indicacao',
      status: 'Ativo', dataInicioFrom: de, dataInicioTo: ate, teamMemberIds: ['u1', 'u2'],
    }), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    const sel = chamadasCom('clientes', 'select')[0];
    expect(sel.ops).toEqual(expect.arrayContaining([
      ['eq', ['tipo_pessoa', 'juridica']], ['eq', ['origem', 'indicacao']], ['ilike', ['status', 'Ativo']],
      ['gte', ['created_at', de.toISOString()]], ['lte', ['created_at', ate.toISOString()]],
      ['in', ['user_id', ['u1', 'u2']]], ['order', ['nome', { ascending: true }]], ['range', [0, 19]],
    ]));
    const ors = sel.ops.filter(([m]) => m === 'or').map(([, a]) => a[0]);
    const esc = '"%Silva, \\"Ltda\\"%"';
    expect(ors).toEqual([SEM_LEAD, `nome.ilike.${esc},email.ilike.${esc},cpf_cnpj.ilike.${esc},telefone.ilike.${esc}`]);
  });

  it('erro vira `error`; sem escritório não consulta', async () => {
    enfileirar('clientes', { error: { message: 'boom' } });
    const { result } = renderHook(() => useClientesLista({ page: 1, pageSize: 10, sortBy: 'recentes' }), { wrapper });
    await waitFor(() => expect(result.current.error).toBe('boom'));
    expect(result.current.data).toEqual([]);

    resetSupabaseMock();
    auth.user = { id: 'u1', office_id: null };
    const { result: r2 } = renderHook(() => useClientesLista({ page: 1, pageSize: 10, sortBy: 'recentes' }), { wrapper });
    expect(r2.current.data).toEqual([]);
    expect(chamadasCom('clientes', 'select')).toHaveLength(0);
  });
});

describe('useClientesStats', () => {
  beforeEach(() => { resetSupabaseMock(); auth.user = { id: 'u1', office_id: 'o1' }; });

  it('quatro contagens head, sem leads; falha em qualquer uma vira isError', async () => {
    enfileirar('clientes', { count: 10 }, { count: 7 }, { count: 2 }, { count: 4 });
    const { result } = renderHook(() => useClientesStats(), { wrapper });
    await waitFor(() => expect(result.current.total).toBe(10));
    expect(result.current).toEqual({ total: 10, ativos: 7, inativos: 2, juridica: 4, isError: false });
    const sels = chamadasCom('clientes', 'select');
    expect(sels).toHaveLength(4);
    for (const s of sels) expect(s.ops).toEqual(expect.arrayContaining([['select', ['id', { count: 'exact', head: true }]], ['or', [SEM_LEAD]]]));
    expect(sels[1].ops).toEqual(expect.arrayContaining([['ilike', ['status', 'ativo']]]));
    expect(sels[3].ops).toEqual(expect.arrayContaining([['eq', ['tipo_pessoa', 'juridica']]]));

    resetSupabaseMock();
    enfileirar('clientes', { count: 10 }, { count: 7 }, { error: { message: 'boom' } }, { count: 4 });
    const { result: r2 } = renderHook(() => useClientesStats(), { wrapper });
    await waitFor(() => expect(r2.current.isError).toBe(true));
    expect(r2.current.total).toBe(0);
  });
});

describe('useClientesAniversariantesDoMes', () => {
  beforeEach(() => { resetSupabaseMock(); auth.user = { id: 'u1', office_id: 'o1' }; });

  it('filtra pelo mês corrente com like no padrão ____-MM-__', async () => {
    enfileirar('clientes', { data: [{ id: 'c1', nome: 'Ana' }] });
    const { result } = renderHook(() => useClientesAniversariantesDoMes(), { wrapper });
    await waitFor(() => expect(result.current).toHaveLength(1));
    const mes = String(new Date().getMonth() + 1).padStart(2, '0');
    const sel = chamadasCom('clientes', 'select')[0];
    expect(sel.ops).toEqual(expect.arrayContaining([['like', ['data_aniversario', `____-${mes}-__`]], ['or', [SEM_LEAD]]]));
  });
});
