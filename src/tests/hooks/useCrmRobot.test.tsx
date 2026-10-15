// useCrmRobot: contatos de hoje, leads esfriando, auto follow-up (só quem gerencia
// o CRM, 1x/dia, guard só com escrita confirmada) e marcarContatado com RLS.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { enfileirar, chamadasCom, resetSupabaseMock } from '../helpers/supabaseMock';

vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabase } = await import('../helpers/supabaseMock');
  return { supabase: mockSupabase };
});
const auth = { user: { id: 'u1', office_id: 'o1' } as { id: string; office_id: string | null } };
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
const perms = { canManageCRM: true };
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => perms }));
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }));
const captureError = vi.fn();
vi.mock('@/lib/monitoring', () => ({ captureError: (...a: unknown[]) => captureError(...a) }));

import { useCrmRobot } from '@/hooks/useCrmRobot';

const iso = (d: Date) => d.toISOString().slice(0, 10);
const diasAtras = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };

const base = { office_id: 'o1', valor_estimado: 0, created_at: `${diasAtras(30)}T00:00:00Z` };

describe('useCrmRobot', () => {
  beforeEach(() => {
    resetSupabaseMock(); mockToast.mockClear(); captureError.mockClear();
    localStorage.clear(); perms.canManageCRM = true; auth.user = { id: 'u1', office_id: 'o1' };
  });

  it('contatosHoje = follow-up vencido; esfriando = quente/morno sem atendimento recente', async () => {
    const clientes = [
      { ...base, id: 'c1', status: 'quente', proximo_contato: diasAtras(1), valor_estimado: 100 },
      { ...base, id: 'c2', status: 'morno', proximo_contato: diasAtras(-5), valor_estimado: 500 },
      { ...base, id: 'c3', status: 'frio', proximo_contato: diasAtras(0) },
      { ...base, id: 'c4', status: 'cliente', proximo_contato: diasAtras(3) }, // não é lead ativo
      { ...base, id: 'c5', status: 'quente', proximo_contato: diasAtras(-1), created_at: `${diasAtras(1)}T00:00:00Z` }, // recém-criado
    ];
    enfileirar('atendimentos', { data: [{ cliente_id: 'c1', data_atendimento: diasAtras(2) }] });
    const { result } = renderHook(() => useCrmRobot(clientes));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.contatosHoje.map((c) => c.id)).toEqual(['c1', 'c3']);
    // c1 teve atendimento há 2 dias (não esfria); c2 sem atendimento há 7+ dias esfria; c5 é novo
    expect(result.current.esfriando.map((c) => c.id)).toEqual(['c2']);
    const sel = chamadasCom('atendimentos', 'select')[0];
    expect(sel.ops).toEqual(expect.arrayContaining([['in', ['cliente_id', ['c1', 'c2', 'c3', 'c5']]], ['eq', ['deletado', false]]]));
  });

  it('erro ao carregar atendimentos → error exposto e esfriando vazio (não infla a lista)', async () => {
    const clientes = [{ ...base, id: 'c1', status: 'quente', proximo_contato: null }];
    enfileirar('atendimentos', { error: { message: 'boom' } });
    enfileirar('clientes', { data: [{ id: 'c1' }] });
    const { result } = renderHook(() => useCrmRobot(clientes));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('boom');
    expect(result.current.esfriando).toEqual([]);
  });

  it('auto follow-up agenda +N dias nos leads sem data, uma vez por dia, só com escrita confirmada', async () => {
    const refresh = vi.fn();
    const clientes = [
      { ...base, id: 'c1', status: 'lead', proximo_contato: null },
      { ...base, id: 'c2', status: 'quente', proximo_contato: diasAtras(-2) },
    ];
    enfileirar('atendimentos', { data: [] });
    // RLS barra em silêncio → não marca o guard, não chama refresh, vai pro Sentry só se houver erro
    enfileirar('clientes', { data: [] });
    const { result, unmount } = renderHook(() => useCrmRobot(clientes, refresh, { followupDias: 5 }));
    await waitFor(() => expect(chamadasCom('clientes', 'update')).toHaveLength(1));
    await waitFor(() => expect(result.current.loading).toBe(false));
    const up = chamadasCom('clientes', 'update')[0];
    expect(up.ops).toEqual(expect.arrayContaining([
      ['update', [{ proximo_contato: diasAtras(-5) }]], ['in', ['id', ['c1']]], ['eq', ['office_id', 'o1']], ['select', ['id']],
    ]));
    expect(localStorage.getItem('crm_robot_followup_o1')).toBeNull();
    expect(refresh).not.toHaveBeenCalled();
    expect(captureError).not.toHaveBeenCalled();
    unmount();

    // Agora grava → guard do dia + refresh
    resetSupabaseMock();
    enfileirar('atendimentos', { data: [] });
    enfileirar('clientes', { data: [{ id: 'c1' }] });
    renderHook(() => useCrmRobot(clientes, refresh));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(Number(localStorage.getItem('crm_robot_followup_o1'))).toBeGreaterThan(0);

    // Guard do dia: segunda montagem não escreve de novo
    resetSupabaseMock();
    enfileirar('atendimentos', { data: [] });
    const { result: r3 } = renderHook(() => useCrmRobot(clientes, refresh));
    await waitFor(() => expect(r3.current.loading).toBe(false));
    expect(chamadasCom('clientes', 'update')).toHaveLength(0);
  });

  it('erro no auto follow-up vai pro Sentry; quem não gerencia o CRM nunca escreve', async () => {
    const clientes = [{ ...base, id: 'c1', status: 'lead', proximo_contato: null }];
    enfileirar('atendimentos', { data: [] });
    enfileirar('clientes', { error: { message: 'falhou' } });
    renderHook(() => useCrmRobot(clientes));
    await waitFor(() => expect(captureError).toHaveBeenCalledTimes(1));
    expect(captureError.mock.calls[0][1]).toEqual({ context: 'useCrmRobot.autoFollowup', officeId: 'o1' });
    expect(localStorage.getItem('crm_robot_followup_o1')).toBeNull();

    resetSupabaseMock();
    perms.canManageCRM = false;
    enfileirar('atendimentos', { data: [] });
    const { result } = renderHook(() => useCrmRobot(clientes));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(chamadasCom('clientes', 'update')).toHaveLength(0);
  });

  it('marcarContatado: 1 linha → refresh; RLS (0 linhas) → toast; sem permissão não escreve', async () => {
    localStorage.setItem('crm_robot_followup_o1', String(Date.now())); // desliga o auto follow-up
    const refresh = vi.fn();
    const clientes = [{ ...base, id: 'c1', status: 'quente', proximo_contato: diasAtras(1) }];
    enfileirar('atendimentos', { data: [] });
    const { result } = renderHook(() => useCrmRobot(clientes, refresh, { followupDias: 3 }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    enfileirar('clientes', { data: [{ id: 'c1' }] });
    await act(async () => { await result.current.marcarContatado('c1'); });
    expect(refresh).toHaveBeenCalledTimes(1);
    const up = chamadasCom('clientes', 'update')[0];
    expect(up.ops).toEqual(expect.arrayContaining([
      ['update', [{ proximo_contato: diasAtras(-3) }]], ['eq', ['id', 'c1']], ['eq', ['office_id', 'o1']], ['select', ['id']],
    ]));

    enfileirar('clientes', { data: [] });
    await act(async () => { await result.current.marcarContatado('c1'); });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Não foi possível marcar como contatado', variant: 'destructive' }));

    perms.canManageCRM = false;
    const { result: r2 } = renderHook(() => useCrmRobot(clientes, refresh));
    await waitFor(() => expect(r2.current.loading).toBe(false));
    await act(async () => { await r2.current.marcarContatado('c1'); });
    expect(chamadasCom('clientes', 'update')).toHaveLength(2);
  });
});
