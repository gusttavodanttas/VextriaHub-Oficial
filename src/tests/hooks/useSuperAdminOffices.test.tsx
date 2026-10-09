// useSuperAdminOffices: só super admin; monta a lista de escritórios com admin,
// status de pagamento e plano; mutations com RLS/RPC/edge function.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { enfileirar, chamadasCom, resetSupabaseMock, mockSupabase } from '../helpers/supabaseMock';

vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabase } = await import('../helpers/supabaseMock');
  return { supabase: mockSupabase };
});
const auth = { isSuperAdmin: true };
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }));

import { useSuperAdminOffices } from '@/hooks/useSuperAdminOffices';

const office = (over: Record<string, unknown> = {}) => ({
  id: 'o1', name: 'Dantas', email: 'd@x', address: null, phone: null, active: true, plan: 'basico',
  created_at: '2026-01-01', office_subscriptions: [{ status: 'ativa', plan_name: 'pro', value: '99.9', next_due_date: '2026-11-01', is_lifetime: false, manual_discount_percent: null }],
  ...over,
});

function carregarUm(over: Record<string, unknown> = {}) {
  enfileirar('offices', { data: [office(over)] });
  enfileirar('office_users', { data: [{ office_id: 'o1', role: 'user', user_id: 'u2' }, { office_id: 'o1', role: 'admin', user_id: 'u1' }] });
  enfileirar('profiles', { data: [{ user_id: 'u1', full_name: 'Gustavo', email: 'g@x' }] });
}

describe('useSuperAdminOffices', () => {
  beforeEach(() => {
    resetSupabaseMock(); mockToast.mockClear(); auth.isSuperAdmin = true;
    mockSupabase.rpc.mockReset(); mockSupabase.functions.invoke.mockReset();
  });

  it('não super admin: "Acesso negado." sem consultar', async () => {
    auth.isSuperAdmin = false;
    const { result } = renderHook(() => useSuperAdminOffices());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Acesso negado.');
    expect(chamadasCom('offices', 'select')).toHaveLength(0);
  });

  it('monta o escritório com o admin (preferido ao usuário comum), pagamento em dia e plano', async () => {
    carregarUm();
    const { result } = renderHook(() => useSuperAdminOffices());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.admins).toHaveLength(1);
    expect(result.current.admins[0]).toMatchObject({
      id: 'u1', full_name: 'Gustavo', email: 'g@x', role: 'admin', office_id: 'o1', office_name: 'Dantas',
      payment_status: 'em_dia', plan_name: 'pro', price: 99.9, end_date: '2026-11-01', is_trial: false, is_lifetime: false,
      manual_discount_percent: 0, active: true,
    });
    expect(chamadasCom('office_users', 'select')[0].ops).toEqual(expect.arrayContaining([['in', ['office_id', ['o1']]]]));
    expect(chamadasCom('profiles', 'select')[0].ops).toEqual(expect.arrayContaining([['in', ['user_id', ['u2', 'u1']]]]));
  });

  it('status de pagamento/plano por tipo de assinatura (cortesia, trial, atrasada, sem assinatura)', async () => {
    enfileirar('offices', { data: [
      office({ id: 'a', office_subscriptions: [{ status: 'cortesia', value: 0 }] }),
      office({ id: 'b', office_subscriptions: [{ status: 'trial', plan_name: 'pro' }] }),
      office({ id: 'c', office_subscriptions: [{ status: 'atrasada', plan_name: 'pro' }] }),
      office({ id: 'd', office_subscriptions: [{ status: 'pendente', plan_name: 'pro' }] }),
      office({ id: 'e', office_subscriptions: [], plan: null, name: null }),
      office({ id: 'f', office_subscriptions: [{ status: 'cancelada', is_lifetime: true, manual_discount_percent: '15' }] }),
    ] });
    enfileirar('office_users', { data: [] });
    const { result } = renderHook(() => useSuperAdminOffices());
    await waitFor(() => expect(result.current.loading).toBe(false));
    const por = Object.fromEntries(result.current.admins.map((a) => [a.office_id, a]));
    expect(por.a).toMatchObject({ payment_status: 'em_dia', plan_name: 'cortesia' });
    expect(por.b).toMatchObject({ payment_status: 'em_dia', plan_name: 'trial', is_trial: true });
    expect(por.c).toMatchObject({ payment_status: 'vencido', plan_name: 'pro' });
    expect(por.d).toMatchObject({ payment_status: 'proximo_vencimento' });
    expect(por.e).toMatchObject({ payment_status: 'pendente', plan_name: 'Free', office_name: 'Escritório Sem Nome', full_name: 'Usuário Hub', email: 'Sem e-mail', id: 'e', role: 'user' });
    expect(por.f).toMatchObject({ payment_status: 'em_dia', plan_name: 'lifetime', is_lifetime: true, manual_discount_percent: 15 });
    // sem usuários não busca perfis
    expect(chamadasCom('profiles', 'select')).toHaveLength(0);
  });

  it('erro ao listar vira `error`; falha nos perfis só avisa', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    enfileirar('offices', { error: { message: 'boom' } });
    const { result } = renderHook(() => useSuperAdminOffices());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Erro ao carregar dados administrativos.');

    resetSupabaseMock();
    enfileirar('offices', { data: [office()] });
    enfileirar('office_users', { data: [{ office_id: 'o1', role: 'admin', user_id: 'u1' }] });
    enfileirar('profiles', { error: { message: 'perfis' } });
    const { result: r2 } = renderHook(() => useSuperAdminOffices());
    await waitFor(() => expect(r2.current.loading).toBe(false));
    expect(r2.current.error).toBeNull();
    expect(r2.current.admins[0]).toMatchObject({ id: 'u1', full_name: 'Usuário Hub' });
  });

  it('updateOfficeStatus: 1 linha → toast e recarrega; RLS (0 linhas) → erro e false', async () => {
    carregarUm();
    const { result } = renderHook(() => useSuperAdminOffices());
    await waitFor(() => expect(result.current.loading).toBe(false));

    enfileirar('offices', { data: [{ id: 'o1' }] });
    carregarUm({ active: false });
    let ok = false;
    await act(async () => { ok = await result.current.updateOfficeStatus('o1', false); });
    expect(ok).toBe(true);
    expect(chamadasCom('offices', 'update')[0].ops).toEqual(expect.arrayContaining([['update', [{ active: false }]], ['eq', ['id', 'o1']], ['select', ['id']]]));
    expect(mockToast).toHaveBeenCalledWith({ title: 'Acesso Suspenso' });
    await waitFor(() => expect(result.current.admins[0].active).toBe(false));

    enfileirar('offices', { data: [] });
    await act(async () => { ok = await result.current.updateOfficeStatus('o1', true); });
    expect(ok).toBe(false);
    expect(mockToast).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Erro', variant: 'destructive' }));
    expect(chamadasCom('offices', 'order')).toHaveLength(2); // não recarregou após a falha
  });

  it('updateOfficeFull: traduz o plano, grava só os campos informados e recarrega', async () => {
    carregarUm();
    const { result } = renderHook(() => useSuperAdminOffices());
    await waitFor(() => expect(result.current.loading).toBe(false));

    enfileirar('offices', { data: [{ id: 'o1' }] });
    carregarUm();
    let ok = false;
    await act(async () => { ok = await result.current.updateOfficeFull('o1', { office_name: 'Novo', plan_name: 'pro', phone: '61' }); });
    expect(ok).toBe(true);
    const up = chamadasCom('offices', 'update')[0];
    expect(up.ops[0]).toEqual(['update', [{ name: 'Novo', phone: '61', plan: 'intermediario' }]]);
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Dados Sincronizados' }));

    // nada pra gravar → não toca o banco, mas ainda "sincroniza"
    await act(async () => { ok = await result.current.updateOfficeFull('o1', { full_name: 'ignorado' }); });
    expect(ok).toBe(true);
    expect(chamadasCom('offices', 'update')).toHaveLength(1);

    vi.spyOn(console, 'error').mockImplementation(() => {});
    enfileirar('offices', { data: [] });
    await act(async () => { ok = await result.current.updateOfficeFull('o1', { office_email: 'n@x' }); });
    expect(ok).toBe(false);
    expect(mockToast).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Erro ao salvar', variant: 'destructive' }));
  });

  it('deleteOffice via RPC com confirmação por nome; erro vira toast', async () => {
    carregarUm();
    const { result } = renderHook(() => useSuperAdminOffices());
    await waitFor(() => expect(result.current.loading).toBe(false));

    mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: null });
    enfileirar('offices', { data: [] });
    let ok = false;
    await act(async () => { ok = await result.current.deleteOffice('o1', 'Dantas'); });
    expect(ok).toBe(true);
    expect(mockSupabase.rpc).toHaveBeenCalledWith('delete_office', { p_office_id: 'o1', p_confirm_name: 'Dantas' });
    await waitFor(() => expect(result.current.admins).toEqual([]));

    mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: { message: 'Nome não confere' } });
    await act(async () => { ok = await result.current.deleteOffice('o1', 'Errado'); });
    expect(ok).toBe(false);
    expect(mockToast).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Erro ao excluir', description: 'Nome não confere' }));
  });

  it('manageAccess chama a edge function e trata erro do transporte e erro no payload', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    carregarUm();
    const { result } = renderHook(() => useSuperAdminOffices());
    await waitFor(() => expect(result.current.loading).toBe(false));

    mockSupabase.functions.invoke.mockResolvedValueOnce({ data: { ok: true }, error: null });
    carregarUm();
    let ok = false;
    await act(async () => { ok = await result.current.manageAccess('o1', 'apply_discount', { discount_percent: 20, reason: 'parceiro' }); });
    expect(ok).toBe(true);
    expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('admin-office-access', {
      body: { office_id: 'o1', action: 'apply_discount', discount_percent: 20, trial_days: undefined, reason: 'parceiro' },
    });
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Sucesso!', description: 'Desconto aplicado.' }));

    mockSupabase.functions.invoke.mockResolvedValueOnce({ data: { error: 'Já é vitalício' }, error: null });
    await act(async () => { ok = await result.current.manageAccess('o1', 'grant_lifetime'); });
    expect(ok).toBe(false);
    expect(mockToast).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Falha na operação', description: 'Já é vitalício' }));

    mockSupabase.functions.invoke.mockResolvedValueOnce({ data: null, error: { message: 'HTTP 500' } });
    await act(async () => { ok = await result.current.manageAccess('o1', 'grant_trial', { trial_days: 7 }); });
    expect(ok).toBe(false);
    expect(mockToast).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Falha na operação', description: 'HTTP 500' }));
  });
});
