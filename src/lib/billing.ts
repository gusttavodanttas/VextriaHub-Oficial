// Regras de cobrança/acesso da VextriaHub em funções PURAS e testáveis.
//
// evaluateAccess() é o portão de acesso do CLIENTE (frontend). Ele ESPELHA o
// portão do servidor office_has_access() (usado pelas policies RLS):
//   is_lifetime OR status in ('ativa','cortesia')
//   OR (trial_ends_at >= hoje AND status in ('trial','pendente'))
//
// Ao mudar a regra, mude AQUI e na migration do office_has_access JUNTAS —
// os testes em src/tests/lib/billing.test.ts travam este comportamento e vão
// gritar se alguém quebrar o "pagou → tem acesso / não pagou → bloqueia".

// --------------------------------------------------------------------------
// Mapa evento Asaas → status da assinatura (usado pelo webhook asaas-webhook).
// A função Deno do webhook é autocontida (convenção do projeto: sem imports
// relativos), então estas listas são a SPEC executável e testada. O teste de
// contrato em src/tests/lib/billing.test.ts lê o fonte do webhook e falha se as
// listas lá divergirem daqui — travando o "pagou → ativa / atrasou → bloqueia"
// nos dois sentidos. Ao mudar um evento, mude AQUI e no webhook juntos.
export const ASAAS_PAID_EVENTS = ['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED', 'PAYMENT_RECEIVED_IN_CASH'] as const;
export const ASAAS_OVERDUE_EVENTS = ['PAYMENT_OVERDUE'] as const;
export const ASAAS_DEAD_EVENTS = ['PAYMENT_REFUNDED', 'PAYMENT_CHARGEBACK_REQUESTED', 'PAYMENT_CHARGEBACK_DISPUTE'] as const;

export type SubscriptionStatus = 'ativa' | 'atrasada' | 'cancelada';

/** Evento de cobrança do Asaas → novo status (ou null = não mexe no status). */
export function mapAsaasEventToStatus(event: string): SubscriptionStatus | null {
  if ((ASAAS_PAID_EVENTS as readonly string[]).includes(event)) return 'ativa';
  if ((ASAAS_OVERDUE_EVENTS as readonly string[]).includes(event)) return 'atrasada';
  if ((ASAAS_DEAD_EVENTS as readonly string[]).includes(event)) return 'cancelada';
  return null;
}

export type PaymentStatus = 'paid' | 'pending' | 'overdue' | 'canceled' | 'unknown' | 'trial';

/** Estado da assinatura lido de office_subscriptions (null = ainda sem linha). */
export interface SubscriptionSnapshot {
  status: string;
  trial_ends_at: string | null; // 'YYYY-MM-DD'
  is_lifetime: boolean | null;
}

export interface AccessInput {
  role?: string | null;   // profiles.role — 'super_admin' fura o portão
  hasOffice: boolean;      // já tem office_id?
  subscription: SubscriptionSnapshot | null;
  /** Injetável para teste determinístico; default = agora (horário local). */
  today?: Date;
}

export interface AccessDecision {
  needsPayment: boolean;
  hasActiveSubscription: boolean;
  paymentStatus: PaymentStatus;
  daysLeft: number;
  message?: string;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * Decide se o escritório tem acesso ou precisa pagar. Função pura: mesma
 * entrada → mesma saída, sem I/O. O hook usePaymentValidation faz o fetch e
 * delega a decisão para cá.
 */
export function evaluateAccess(input: AccessInput): AccessDecision {
  const { role, hasOffice, subscription: sub } = input;
  const today = startOfDay(input.today ?? new Date());

  // Super admin sempre liberado.
  if (role === 'super_admin') {
    return { needsPayment: false, hasActiveSubscription: true, paymentStatus: 'paid', daysLeft: 0, message: 'Super admin' };
  }

  // Sem escritório ainda (ex.: acabou de cadastrar) → não bloqueia.
  if (!hasOffice) {
    return { needsPayment: false, hasActiveSubscription: false, paymentStatus: 'unknown', daysLeft: 0 };
  }

  // Sem linha de assinatura (o trigger cria no login) → não bloqueia.
  if (!sub) {
    return { needsPayment: false, hasActiveSubscription: true, paymentStatus: 'trial', daysLeft: 0, message: 'Período de teste' };
  }

  const trialEnds = sub.trial_ends_at ? startOfDay(new Date(sub.trial_ends_at + 'T00:00:00')) : null;
  // O teste vale para 'trial' E 'pendente' (ex.: boleto gerado no meio do trial)
  // e exige data futura — evita expulsar do app quem está convertendo.
  const trialActive = !!trialEnds && trialEnds >= today && (sub.status === 'trial' || sub.status === 'pendente');
  const daysLeft = trialEnds ? Math.max(0, Math.ceil((trialEnds.getTime() - today.getTime()) / 86400000)) : 0;
  const paidAccess = !!sub.is_lifetime || sub.status === 'ativa' || sub.status === 'cortesia';

  if (paidAccess || trialActive) {
    return {
      needsPayment: false,
      hasActiveSubscription: true,
      paymentStatus: paidAccess ? 'paid' : 'trial',
      daysLeft,
      message: trialActive ? `Período de teste: ${daysLeft} dia(s) restante(s)` : undefined,
    };
  }

  // Sem acesso → bloquear, com mensagem conforme o motivo.
  const paymentStatus: PaymentStatus =
    sub.status === 'atrasada' ? 'overdue' : sub.status === 'cancelada' ? 'canceled' : 'pending';
  const message =
    sub.status === 'atrasada' ? 'Pagamento em atraso. Regularize para continuar.' :
    sub.status === 'cancelada' ? 'Assinatura cancelada.' :
    sub.status === 'trial' ? 'Período de teste expirado. Assine para continuar.' :
    'Assinatura pendente. Conclua o pagamento para continuar.';
  return { needsPayment: true, hasActiveSubscription: false, paymentStatus, daysLeft, message };
}
