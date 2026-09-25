import { describe, it, expect, vi, beforeEach } from 'vitest';
import { enfileirar, chamadasCom, resetSupabaseMock } from '../helpers/supabaseMock';

vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabase } = await import('../helpers/supabaseMock');
  return { supabase: mockSupabase };
});

import { concluirPrazoDb, concluirTarefaDb } from '@/lib/concluirItens';
import { assertRowsAffected, PERMISSAO_NEGADA } from '@/lib/errors';

describe('concluirItens — caminho bloqueado pela RLS', () => {
  beforeEach(() => resetSupabaseMock());

  it('concluirPrazoDb devolve as linhas afetadas para o chamador conferir', async () => {
    enfileirar('prazos', { data: [{ id: 'p1' }] });
    const { data, error } = await concluirPrazoDb('p1', 'u1');
    expect(() => assertRowsAffected(data as unknown[], error, 1)).not.toThrow();
  });

  it('RLS barrando (0 linhas, sem erro) vira PERMISSAO_NEGADA no assert', async () => {
    enfileirar('prazos', { data: [] });
    const { data, error } = await concluirPrazoDb('p1', 'u1');
    expect(error).toBeNull();
    expect(() => assertRowsAffected(data as unknown[], error, 1)).toThrow(PERMISSAO_NEGADA);
  });

  it('cai no fallback sem colunas de auditoria quando o 1º update falha', async () => {
    enfileirar('prazos',
      { error: { message: 'column "concluido_por" does not exist' } },
      { data: [{ id: 'p1' }] },
    );
    const { data, error } = await concluirPrazoDb('p1', 'u1');
    expect(error).toBeNull();
    expect(data).toEqual([{ id: 'p1' }]);
    expect(chamadasCom('prazos', 'update')).toHaveLength(2);
  });

  it('concluirTarefaDb também repassa 0 linhas (RLS) sem mascarar como sucesso', async () => {
    enfileirar('tarefas', { data: [] });
    const { data, error } = await concluirTarefaDb('t1', 'u1');
    expect(() => assertRowsAffected(data as unknown[], error, 1)).toThrow(PERMISSAO_NEGADA);
  });
});
