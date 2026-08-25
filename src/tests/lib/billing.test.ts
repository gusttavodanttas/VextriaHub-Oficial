import { describe, it, expect } from 'vitest';
import {
  evaluateAccess,
  mapAsaasEventToStatus,
  ASAAS_PAID_EVENTS,
  ASAAS_OVERDUE_EVENTS,
  ASAAS_DEAD_EVENTS,
  type AccessInput,
} from '@/lib/billing';

// "hoje" fixo para testes determinísticos (22/08/2026, meia-noite local).
const TODAY = new Date(2026, 7, 22);
const base = (over: Partial<AccessInput> = {}): AccessInput => ({
  role: 'admin',
  hasOffice: true,
  subscription: null,
  today: TODAY,
  ...over,
});

describe('evaluateAccess — portão de acesso (espelha office_has_access)', () => {
  describe('furos do portão (nunca bloqueiam)', () => {
    it('super_admin sempre liberado, mesmo sem escritório/assinatura', () => {
      const d = evaluateAccess(base({ role: 'super_admin', hasOffice: false, subscription: null }));
      expect(d.needsPayment).toBe(false);
      expect(d.hasActiveSubscription).toBe(true);
      expect(d.paymentStatus).toBe('paid');
    });

    it('super_admin liberado mesmo com assinatura cancelada', () => {
      const d = evaluateAccess(base({ role: 'super_admin', subscription: { status: 'cancelada', trial_ends_at: null, is_lifetime: false } }));
      expect(d.needsPayment).toBe(false);
      expect(d.paymentStatus).toBe('paid');
    });

    it('sem escritório ainda (acabou de cadastrar) não bloqueia', () => {
      const d = evaluateAccess(base({ hasOffice: false, subscription: null }));
      expect(d.needsPayment).toBe(false);
      expect(d.paymentStatus).toBe('unknown');
      expect(d.hasActiveSubscription).toBe(false);
    });

    it('sem linha de assinatura (trigger ainda não criou) não bloqueia', () => {
      const d = evaluateAccess(base({ subscription: null }));
      expect(d.needsPayment).toBe(false);
      expect(d.paymentStatus).toBe('trial');
      expect(d.hasActiveSubscription).toBe(true);
    });
  });

  describe('acesso pago', () => {
    it('is_lifetime libera (vitalício)', () => {
      const d = evaluateAccess(base({ subscription: { status: 'trial', trial_ends_at: '2020-01-01', is_lifetime: true } }));
      expect(d.needsPayment).toBe(false);
      expect(d.paymentStatus).toBe('paid');
    });

    it('is_lifetime VENCE status cancelada (vitalício ganha)', () => {
      const d = evaluateAccess(base({ subscription: { status: 'cancelada', trial_ends_at: null, is_lifetime: true } }));
      expect(d.needsPayment).toBe(false);
      expect(d.paymentStatus).toBe('paid');
    });

    it('status ativa libera', () => {
      const d = evaluateAccess(base({ subscription: { status: 'ativa', trial_ends_at: null, is_lifetime: false } }));
      expect(d.needsPayment).toBe(false);
      expect(d.paymentStatus).toBe('paid');
    });

    it('status cortesia libera', () => {
      const d = evaluateAccess(base({ subscription: { status: 'cortesia', trial_ends_at: null, is_lifetime: false } }));
      expect(d.needsPayment).toBe(false);
      expect(d.paymentStatus).toBe('paid');
    });
  });

  describe('período de teste', () => {
    it('trial com data futura libera e conta os dias', () => {
      const d = evaluateAccess(base({ subscription: { status: 'trial', trial_ends_at: '2026-08-25', is_lifetime: false } }));
      expect(d.needsPayment).toBe(false);
      expect(d.paymentStatus).toBe('trial');
      expect(d.daysLeft).toBe(3);
      expect(d.message).toContain('3 dia');
    });

    it('pendente com data futura AINDA libera (boleto gerado no meio do trial — convertendo)', () => {
      const d = evaluateAccess(base({ subscription: { status: 'pendente', trial_ends_at: '2026-08-25', is_lifetime: false } }));
      expect(d.needsPayment).toBe(false);
      expect(d.paymentStatus).toBe('trial');
    });

    it('trial que termina HOJE ainda está ativo (>= hoje)', () => {
      const d = evaluateAccess(base({ subscription: { status: 'trial', trial_ends_at: '2026-08-22', is_lifetime: false } }));
      expect(d.needsPayment).toBe(false);
    });

    it('trial EXPIRADO bloqueia', () => {
      const d = evaluateAccess(base({ subscription: { status: 'trial', trial_ends_at: '2026-08-20', is_lifetime: false } }));
      expect(d.needsPayment).toBe(true);
      expect(d.paymentStatus).toBe('pending');
      expect(d.message).toContain('expirado');
    });
  });

  describe('carência pós-trial (pendente — 7 dias após o fim do trial)', () => {
    // Ancorada em trial_ends_at (que o usuário NÃO controla) — não em next_due_date,
    // que abria bypass de paywall (v11). Cobre o pagamento do 1º boleto de quem
    // assina perto do fim do teste, sem virar acesso grátis eterno.
    it('pendente com trial vencido há 2 dias AINDA libera (dentro dos 7 de carência)', () => {
      // TODAY=22/08; trial_ends 20/08 → +7 = 27/08 → hoje dentro da carência.
      const d = evaluateAccess(base({ subscription: { status: 'pendente', trial_ends_at: '2026-08-20', is_lifetime: false } }));
      expect(d.needsPayment).toBe(false);
      expect(d.hasActiveSubscription).toBe(true);
    });

    it('pendente no ÚLTIMO dia da carência (trial+7 = hoje) ainda libera', () => {
      // trial_ends 15/08 → +7 = 22/08 = hoje → limite inclusivo.
      const d = evaluateAccess(base({ subscription: { status: 'pendente', trial_ends_at: '2026-08-15', is_lifetime: false } }));
      expect(d.needsPayment).toBe(false);
    });

    it('pendente com trial vencido há mais de 7 dias BLOQUEIA', () => {
      // trial_ends 14/08 → +7 = 21/08 < hoje (22/08) → carência acabou.
      const d = evaluateAccess(base({ subscription: { status: 'pendente', trial_ends_at: '2026-08-14', is_lifetime: false } }));
      expect(d.needsPayment).toBe(true);
      expect(d.paymentStatus).toBe('pending');
    });

    it('a carência é só de pendente: trial EXPIRADO (status trial) não ganha carência', () => {
      // status 'trial' vencido há 2 dias continua bloqueado — a carência é pós-conversão (pendente).
      const d = evaluateAccess(base({ subscription: { status: 'trial', trial_ends_at: '2026-08-20', is_lifetime: false } }));
      expect(d.needsPayment).toBe(true);
    });
  });

  describe('bloqueios', () => {
    it('atrasada bloqueia com aviso de regularizar', () => {
      const d = evaluateAccess(base({ subscription: { status: 'atrasada', trial_ends_at: null, is_lifetime: false } }));
      expect(d.needsPayment).toBe(true);
      expect(d.hasActiveSubscription).toBe(false);
      expect(d.paymentStatus).toBe('overdue');
      expect(d.message).toContain('atraso');
    });

    it('cancelada bloqueia', () => {
      const d = evaluateAccess(base({ subscription: { status: 'cancelada', trial_ends_at: null, is_lifetime: false } }));
      expect(d.needsPayment).toBe(true);
      expect(d.paymentStatus).toBe('canceled');
    });

    it('pendente sem trial (ou trial vencido) bloqueia como pendente', () => {
      const d = evaluateAccess(base({ subscription: { status: 'pendente', trial_ends_at: null, is_lifetime: false } }));
      expect(d.needsPayment).toBe(true);
      expect(d.paymentStatus).toBe('pending');
    });

    it('atrasada NÃO é resgatada por trial_ends_at futuro (status manda)', () => {
      // trial futuro só vale para status trial/pendente; atrasada continua bloqueada.
      const d = evaluateAccess(base({ subscription: { status: 'atrasada', trial_ends_at: '2026-12-31', is_lifetime: false } }));
      expect(d.needsPayment).toBe(true);
      expect(d.paymentStatus).toBe('overdue');
    });
  });
});

describe('mapAsaasEventToStatus — evento do webhook → status da assinatura', () => {
  it('eventos de pagamento confirmado viram "ativa"', () => {
    expect(mapAsaasEventToStatus('PAYMENT_CONFIRMED')).toBe('ativa');
    expect(mapAsaasEventToStatus('PAYMENT_RECEIVED')).toBe('ativa');
    expect(mapAsaasEventToStatus('PAYMENT_RECEIVED_IN_CASH')).toBe('ativa');
  });

  it('atraso vira "atrasada"', () => {
    expect(mapAsaasEventToStatus('PAYMENT_OVERDUE')).toBe('atrasada');
  });

  it('estorno/chargeback viram "cancelada"', () => {
    expect(mapAsaasEventToStatus('PAYMENT_REFUNDED')).toBe('cancelada');
    expect(mapAsaasEventToStatus('PAYMENT_CHARGEBACK_REQUESTED')).toBe('cancelada');
    expect(mapAsaasEventToStatus('PAYMENT_CHARGEBACK_DISPUTE')).toBe('cancelada');
  });

  it('evento irrelevante (ex.: criado/atualizado) NÃO muda o status', () => {
    expect(mapAsaasEventToStatus('PAYMENT_CREATED')).toBeNull();
    expect(mapAsaasEventToStatus('PAYMENT_UPDATED')).toBeNull();
    expect(mapAsaasEventToStatus('')).toBeNull();
    expect(mapAsaasEventToStatus('ALGO_DESCONHECIDO')).toBeNull();
  });

  it('nenhum evento aparece em dois baldes (buckets disjuntos)', () => {
    const all = [...ASAAS_PAID_EVENTS, ...ASAAS_OVERDUE_EVENTS, ...ASAAS_DEAD_EVENTS];
    expect(new Set(all).size).toBe(all.length);
  });
});
