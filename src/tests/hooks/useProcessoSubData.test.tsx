// Testes de fluxo do hook das sub-abas do processo.
// Travam regressões que já aconteceram em produção:
//  - audiência criada pelo drawer com status masculino ("agendado") → sumia na edição
//  - tarefa criada sem office_id → não aparecia na aba Tarefas
//  - atendimento sem o cliente do processo
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Registra cada insert (tabela + payload) e responde sucesso
const inserts: Array<{ table: string; payload: any }> = [];

vi.mock('@/integrations/supabase/client', () => {
  const makeBuilder = (table: string) => {
    const b: any = {};
    for (const m of ['select', 'eq', 'or', 'in', 'update']) b[m] = vi.fn(() => b);
    // fim das cadeias de leitura: resolve com lista vazia
    b.order = vi.fn(() => Promise.resolve({ data: [] }));
    b.maybeSingle = vi.fn(() => Promise.resolve({ data: null }));
    b.single = vi.fn(() => Promise.resolve({ data: null }));
    b.insert = vi.fn((payload: any) => {
      inserts.push({ table, payload });
      return Promise.resolve({ error: null });
    });
    return b;
  };
  return { supabase: { from: vi.fn((table: string) => makeBuilder(table)) } };
});

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: { id: 'user-1', office_id: 'office-1' } })),
}));

const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({ toast: mockToast })),
}));

import { useProcessoSubData } from '@/hooks/useProcessoSubData';

const processo = {
  id: 'proc-1',
  numeroProcesso: '0707058-18.2026.8.07.0006',
  clienteId: 'cli-9',
} as any;

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
};

/** Simula o submit de um AddForm: <form> real com inputs nomeados. */
function formEvent(fields: Record<string, string>) {
  const form = document.createElement('form');
  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement('input');
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  return { preventDefault: () => {}, currentTarget: form } as unknown as React.FormEvent<HTMLFormElement>;
}

describe('useProcessoSubData — criação pelas sub-abas do processo', () => {
  beforeEach(() => {
    inserts.length = 0;
    mockToast.mockClear();
  });

  it('audiência nasce com status FEMININO (agendada) e office_id', async () => {
    const { result } = renderHook(() => useProcessoSubData(processo), { wrapper });
    let ok = false;
    await act(async () => {
      ok = await result.current.addAudiencia(formEvent({ titulo: 'Conciliação', data: '2026-08-03', horario: '14:00' }));
    });
    expect(ok).toBe(true);
    const ins = inserts.find(i => i.table === 'audiencias')!;
    expect(ins).toBeTruthy();
    expect(ins.payload.status).toBe('agendada'); // NUNCA "agendado"
    expect(ins.payload.office_id).toBe('office-1');
    expect(ins.payload.processo_id).toBe('proc-1');
    expect(ins.payload.titulo).toBe('Conciliação');
  });

  it('audiência sem título não grava e retorna false (form permanece aberto)', async () => {
    const { result } = renderHook(() => useProcessoSubData(processo), { wrapper });
    let ok = true;
    await act(async () => {
      ok = await result.current.addAudiencia(formEvent({ titulo: '   ', data: '2026-08-03' }));
    });
    expect(ok).toBe(false);
    expect(inserts.filter(i => i.table === 'audiencias')).toHaveLength(0);
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
  });

  it('tarefa criada pelo drawer leva office_id (bug: não aparecia na aba Tarefas)', async () => {
    const { result } = renderHook(() => useProcessoSubData(processo), { wrapper });
    let ok = false;
    await act(async () => {
      ok = await result.current.addTarefa(formEvent({ titulo: 'Elaborar contestação' }));
    });
    expect(ok).toBe(true);
    const ins = inserts.find(i => i.table === 'tarefas')!;
    expect(ins.payload.office_id).toBe('office-1');
    expect(ins.payload.status).toBe('pendente');
    expect(ins.payload.processo_id).toBe('proc-1');
  });

  it('atendimento herda o cliente do processo e usa status MASCULINO (agendado)', async () => {
    const { result } = renderHook(() => useProcessoSubData(processo), { wrapper });
    await act(async () => {
      await result.current.addAtendimento(formEvent({ tipo: 'reuniao', data: '2026-07-10', horario: '09:30' }));
    });
    const ins = inserts.find(i => i.table === 'atendimentos')!;
    expect(ins.payload.status).toBe('agendado');
    expect(ins.payload.cliente_id).toBe('cli-9');
    expect(ins.payload.office_id).toBe('office-1');
  });

  it('prazo criado pelo drawer grava data_vencimento e prioridade', async () => {
    const { result } = renderHook(() => useProcessoSubData(processo), { wrapper });
    await act(async () => {
      await result.current.addPrazo(formEvent({ titulo: 'Contestação', data_vencimento: '2026-07-20', prioridade: 'alta' }));
    });
    const ins = inserts.find(i => i.table === 'prazos')!;
    expect(ins.payload.data_vencimento).toBe('2026-07-20');
    expect(ins.payload.prioridade).toBe('alta');
    expect(ins.payload.status).toBe('pendente');
    expect(ins.payload.office_id).toBe('office-1');
  });
});
