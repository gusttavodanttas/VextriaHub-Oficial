import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { enfileirar, chamadasCom, resetSupabaseMock } from '../helpers/supabaseMock';

vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabase } = await import('../helpers/supabaseMock');
  return { supabase: mockSupabase };
});
const user = { id: 'admin1', office_id: 'o1' };
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user }) }));
vi.mock('@/hooks/useUserRole', () => ({ useUserRole: () => ({ canManageOffice: true }) }));
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }));

import { useExclusoesPendentes } from '@/hooks/useExclusoesPendentes';

const pendente = { id: 'e1', tabela: 'clientes', registro_id: 'c1', user_id: 'u2', status: 'pendente', solicitado_em: new Date().toISOString(), dados_registro: {}, motivo: null };

describe('useExclusoesPendentes — aprovação bloqueada pela RLS', () => {
  beforeEach(() => { resetSupabaseMock(); mockToast.mockClear(); });

  it('não marca a solicitação como aprovada se o registro não foi excluído', async () => {
    enfileirar('exclusoes_pendentes', { data: [pendente] });
    enfileirar('profiles', { data: [] });
    const { result } = renderHook(() => useExclusoesPendentes());
    await waitFor(() => expect(result.current.data).toHaveLength(1));

    enfileirar('clientes', { data: [] }); // soft-delete barrado: 0 linhas
    let ok: boolean | undefined;
    await act(async () => { ok = await result.current.aprovarExclusao('e1'); });

    expect(ok).toBe(false);
    // O log de auditoria não pode dizer "aprovado" com o registro ainda vivo.
    expect(chamadasCom('exclusoes_pendentes', 'update')).toHaveLength(0);
    expect(result.current.data).toHaveLength(1);
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Erro ao aprovar exclusão', variant: 'destructive' }));
  });

  it('aprovação em lote só aprova as que o banco realmente excluiu', async () => {
    const outra = { ...pendente, id: 'e2', registro_id: 'c2' };
    enfileirar('exclusoes_pendentes', { data: [pendente, outra] });
    enfileirar('profiles', { data: [] });
    const { result } = renderHook(() => useExclusoesPendentes());
    await waitFor(() => expect(result.current.data).toHaveLength(2));

    enfileirar('clientes', { data: [{ id: 'c1' }] }, { data: [] }); // c1 ok, c2 barrado
    enfileirar('exclusoes_pendentes', { data: [{ id: 'e1' }] });
    await act(async () => { await result.current.aprovarMultiplasExclusoes(['e1', 'e2']); });

    const updates = chamadasCom('exclusoes_pendentes', 'update');
    expect(updates).toHaveLength(1);
    expect(updates[0].ops).toContainEqual(['in', ['id', ['e1']]]);
    expect(result.current.data.map((d) => d.id)).toEqual(['e2']);
  });
});
