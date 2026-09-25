import { vi } from 'vitest';

// Mock encadeável do client do Supabase para testes de hooks. Cada `.from(tabela)`
// devolve um builder que aceita qualquer cadeia (.update().eq().select()...) e,
// ao ser aguardado, resolve com o próximo resultado enfileirado para aquela tabela
// (ou `{ data: [], error: null }` se a fila estiver vazia).
//
// O caso central que estes testes cobrem é o da RLS: o PostgREST NÃO devolve erro
// quando uma policy barra um UPDATE/DELETE — só `data: []`. Enfileirar
// `{ data: [] }` simula exatamente isso.

export type MockResult = { data?: unknown; error?: unknown; count?: number | null };
export type MockCall = { table: string; ops: Array<[string, unknown[]]> };

const METODOS = [
  'select', 'insert', 'update', 'delete', 'upsert',
  'eq', 'neq', 'in', 'is', 'not', 'or', 'gte', 'lte', 'lt', 'gt', 'ilike',
  'order', 'limit', 'range', 'single', 'maybeSingle',
] as const;

const filas: Record<string, MockResult[]> = {};
export const chamadas: MockCall[] = [];

function builder(table: string) {
  const call: MockCall = { table, ops: [] };
  chamadas.push(call);
  const b: Record<string, unknown> = {};
  for (const m of METODOS) {
    b[m] = (...args: unknown[]) => { call.ops.push([m, args]); return b; };
  }
  b.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => {
    const r = filas[table]?.shift() ?? { data: [], error: null };
    return Promise.resolve({ data: r.data ?? null, error: r.error ?? null, count: r.count ?? null }).then(resolve, reject);
  };
  return b;
}

const canal = { on: () => canal, subscribe: () => canal };

export const mockSupabase = {
  from: vi.fn((table: string) => builder(table)),
  channel: vi.fn(() => canal),
  removeChannel: vi.fn(),
  rpc: vi.fn(async () => ({ data: null, error: null })),
};

/** Enfileira resultados (em ordem) para as próximas consultas à tabela. */
export function enfileirar(table: string, ...results: MockResult[]) {
  (filas[table] ||= []).push(...results);
}

/** Chamadas feitas a uma tabela que incluem a operação dada (ex.: 'update'). */
export function chamadasCom(table: string, op: string) {
  return chamadas.filter((c) => c.table === table && c.ops.some(([m]) => m === op));
}

export function resetSupabaseMock() {
  for (const k of Object.keys(filas)) delete filas[k];
  chamadas.length = 0;
  mockSupabase.from.mockClear();
}
