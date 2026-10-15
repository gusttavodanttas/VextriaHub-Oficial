// usePaymentValidation: lê perfil + assinatura do escritório e delega a decisão
// a evaluateAccess; super admin não consulta assinatura; erro é fail-open.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { enfileirar, chamadasCom, resetSupabaseMock } from '../helpers/supabaseMock';

vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabase } = await import('../helpers/supabaseMock');
  return { supabase: mockSupabase };
});
const evaluateAccess = vi.fn();
vi.mock('@/lib/billing', () => ({ evaluateAccess: (...a: unknown[]) => evaluateAccess(...a) }));

import { usePaymentValidation } from '@/hooks/usePaymentValidation';

const decisao = { needsPayment: true, hasActiveSubscription: false, paymentStatus: 'overdue', daysLeft: 0, message: 'Vencida' };

describe('usePaymentValidation', () => {
  beforeEach(() => { resetSupabaseMock(); evaluateAccess.mockReset(); evaluateAccess.mockReturnValue(decisao); });

  it('busca o perfil, a assinatura do escritório e repassa a decisão', async () => {
    enfileirar('profiles', { data: { role: 'user', office_id: 'o1' } });
    enfileirar('office_subscriptions', { data: { status: 'atrasada', trial_ends_at: null, is_lifetime: false } });
    const { result } = renderHook(() => usePaymentValidation());
    let r: unknown;
    await act(async () => { r = await result.current.validatePayment('u1'); });
    expect(r).toEqual({ needsPayment: true, daysRegistered: 0, hasActiveSubscription: false, paymentStatus: 'overdue', message: 'Vencida' });
    expect(evaluateAccess).toHaveBeenCalledWith({ role: 'user', hasOffice: true, subscription: { status: 'atrasada', trial_ends_at: null, is_lifetime: false } });
    expect(chamadasCom('profiles', 'select')[0].ops).toEqual(expect.arrayContaining([['eq', ['user_id', 'u1']]]));
    expect(chamadasCom('office_subscriptions', 'select')[0].ops).toEqual(expect.arrayContaining([['eq', ['office_id', 'o1']]]));
    expect(result.current.loading).toBe(false);
  });

  it('officeId explícito prevalece; super admin e sem escritório não consultam assinatura', async () => {
    enfileirar('profiles', { data: { role: 'user', office_id: 'o1' } });
    enfileirar('office_subscriptions', { data: null });
    const { result } = renderHook(() => usePaymentValidation());
    await act(async () => { await result.current.validatePayment('u1', 'o9'); });
    expect(chamadasCom('office_subscriptions', 'select')[0].ops).toEqual(expect.arrayContaining([['eq', ['office_id', 'o9']]]));
    expect(evaluateAccess).toHaveBeenLastCalledWith({ role: 'user', hasOffice: true, subscription: null });

    resetSupabaseMock();
    enfileirar('profiles', { data: { role: 'super_admin', office_id: 'o1' } });
    await act(async () => { await result.current.validatePayment('u1'); });
    expect(chamadasCom('office_subscriptions', 'select')).toHaveLength(0);

    resetSupabaseMock();
    enfileirar('profiles', { data: { role: 'user', office_id: null } });
    await act(async () => { await result.current.validatePayment('u1'); });
    expect(chamadasCom('office_subscriptions', 'select')).toHaveLength(0);
    expect(evaluateAccess).toHaveBeenLastCalledWith({ role: 'user', hasOffice: false, subscription: null });
  });

  it('sem usuário não consulta; exceção é fail-open', async () => {
    const { result } = renderHook(() => usePaymentValidation());
    let r: { needsPayment: boolean; message?: string } | undefined;
    await act(async () => { r = await result.current.validatePayment(''); });
    expect(r).toMatchObject({ needsPayment: false, paymentStatus: 'unknown', message: 'Usuário não encontrado' });
    expect(chamadasCom('profiles', 'select')).toHaveLength(0);

    vi.spyOn(console, 'error').mockImplementation(() => {});
    enfileirar('profiles', { data: { role: 'user', office_id: 'o1' } });
    enfileirar('office_subscriptions', { data: null });
    evaluateAccess.mockImplementationOnce(() => { throw new Error('boom'); });
    await act(async () => { r = await result.current.validatePayment('u1'); });
    expect(r).toMatchObject({ needsPayment: false, paymentStatus: 'unknown', message: 'Erro ao validar status de pagamento' });
    expect(result.current.loading).toBe(false);
  });
});
