/**
 * Tipos TypeScript para integração com Stripe
 * Documentação: https://stripe.com/docs/api
 */

export interface StripeCustomer {
  id: string;
  email: string;
  name: string;
  phone?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };
  metadata?: Record<string, string>;
  created: number;
  updated: number;
}

export interface StripePaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: StripePaymentStatus;
  customer: string;
  payment_method?: string;
  metadata?: Record<string, string>;
  created: number;
  client_secret?: string;
  last_payment_error?: {
    code: string;
    message: string;
  };
}

export interface StripeSubscription {
  id: string;
  customer: string;
  status: StripeSubscriptionStatus;
  current_period_start: number;
  current_period_end: number;
  plan: {
    id: string;
    amount: number;
    currency: string;
    interval: string;
    interval_count: number;
  };
  metadata?: Record<string, string>;
  created: number;
  ended_at?: number;
  cancel_at_period_end: boolean;
}

export interface StripeCheckoutSession {
  id: string;
  url: string;
  customer: string;
  payment_intent?: string;
  subscription?: string;
  status: 'open' | 'complete' | 'expired';
  metadata?: Record<string, string>;
  created: number;
  expires_at: number;
}

export type StripePaymentStatus = 
  | 'requires_payment_method'
  | 'requires_confirmation'
  | 'requires_action'
  | 'processing'
  | 'succeeded'
  | 'canceled'
  | 'payment_failed';

export type StripeSubscriptionStatus = 
  | 'incomplete'
  | 'incomplete_expired'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid';

export interface StripeWebhookEvent {
  id: string;
  object: 'event';
  api_version: string;
  created: number;
  data: {
    object: any;
  };
  livemode: boolean;
  pending_webhooks: number;
  request: {
    id: string | null;
    idempotency_key: string | null;
  };
  type: StripeWebhookType;
}

export type StripeWebhookType = 
  | 'payment_intent.succeeded'
  | 'payment_intent.payment_failed'
  | 'invoice.payment_succeeded'
  | 'invoice.payment_failed'
  | 'customer.subscription.created'
  | 'customer.subscription.updated'
  | 'customer.subscription.deleted'
  | 'checkout.session.completed'
  | 'checkout.session.expired';

export interface StripeSystemConfig {
  publishableKey: string;
  environment: 'test' | 'production';
  webhookSecret?: string;
}

export interface StripeError {
  type: string;
  code?: string;
  message: string;
  decline_code?: string;
}

export interface StripeApiResponse<T> {
  object: string;
  data: T[];
  has_more: boolean;
  url: string;
}

export interface StripeCustomerFilters {
  email?: string;
  limit?: number;
  starting_after?: string;
  ending_before?: string;
}

export interface StripePaymentFilters {
  customer?: string;
  status?: StripePaymentStatus;
  limit?: number;
  starting_after?: string;
  ending_before?: string;
}

export interface StripeSubscriptionFilters {
  customer?: string;
  status?: StripeSubscriptionStatus;
  limit?: number;
  starting_after?: string;
  ending_before?: string;
}

export interface StripeValidationResult {
  valid: boolean;
  message?: string;
}

export interface StripeWebhookValidation {
  valid: boolean;
  event?: StripeWebhookType;
  payload?: StripeWebhookEvent;
}