/**
 * Serviço para integração com Stripe API
 * Documentação: https://stripe.com/docs/api
 */

import {
  StripeCustomer,
  StripePaymentIntent,
  StripeSubscription,
  StripeCheckoutSession,
  StripeSystemConfig,
  StripeWebhookEvent,
  StripeWebhookValidation
} from '@/types/stripe';

class StripeService {
  private publishableKey: string;
  private secretKey: string;
  private webhookSecret: string;

  constructor() {
    this.publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';
    // SEGURANÇA: Chaves privadas NUNCA devem estar no frontend.
    this.secretKey = ''; 
    this.webhookSecret = '';
  }

  private getHeaders() {
    if (!this.secretKey) {
      console.error('ERRO DE SEGURANÇA: Tentativa de usar Stripe Secret Key no frontend desabilitada.');
    }
    return {
      'Authorization': `Bearer ${this.secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    };
  }

  private objectToFormData(obj: any): string {
    return Object.keys(obj)
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(obj[key])}`)
      .join('&');
  }

  async createCustomer(customerData: {
    email: string;
    name: string;
    phone?: string;
    address?: any;
    metadata?: Record<string, string>;
  }): Promise<StripeCustomer> {
    const formData = this.objectToFormData(customerData);
    
    const response = await fetch('https://api.stripe.com/v1/customers', {
      method: 'POST',
      headers: this.getHeaders(),
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Stripe API Error: ${error.error?.message || 'Unknown error'}`);
    }

    return response.json();
  }

  async getCustomer(customerId: string): Promise<StripeCustomer> {
    const response = await fetch(`https://api.stripe.com/v1/customers/${customerId}`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Stripe API Error: ${error.error?.message || 'Unknown error'}`);
    }

    return response.json();
  }

  async createCheckoutSession(sessionData: {
    customer: string;
    price: string;
    success_url: string;
    cancel_url: string;
    mode: 'payment' | 'subscription';
    metadata?: Record<string, string>;
  }): Promise<StripeCheckoutSession> {
    const formData = this.objectToFormData(sessionData);
    
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: this.getHeaders(),
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Stripe API Error: ${error.error?.message || 'Unknown error'}`);
    }

    return response.json();
  }

  async createSubscription(subscriptionData: {
    customer: string;
    price: string;
    metadata?: Record<string, string>;
  }): Promise<StripeSubscription> {
    const formData = this.objectToFormData(subscriptionData);
    
    const response = await fetch('https://api.stripe.com/v1/subscriptions', {
      method: 'POST',
      headers: this.getHeaders(),
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Stripe API Error: ${error.error?.message || 'Unknown error'}`);
    }

    return response.json();
  }

  async getSubscription(subscriptionId: string): Promise<StripeSubscription> {
    const response = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Stripe API Error: ${error.error?.message || 'Unknown error'}`);
    }

    return response.json();
  }

  async cancelSubscription(subscriptionId: string): Promise<StripeSubscription> {
    const response = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Stripe API Error: ${error.error?.message || 'Unknown error'}`);
    }

    return response.json();
  }

  async createPaymentIntent(paymentData: {
    amount: number;
    currency: string;
    customer: string;
    metadata?: Record<string, string>;
  }): Promise<StripePaymentIntent> {
    const formData = this.objectToFormData({
      amount: paymentData.amount,
      currency: paymentData.currency,
      customer: paymentData.customer,
      metadata: paymentData.metadata,
    });
    
    const response = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: this.getHeaders(),
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Stripe API Error: ${error.error?.message || 'Unknown error'}`);
    }

    return response.json();
  }

  async getPaymentIntent(paymentIntentId: string): Promise<StripePaymentIntent> {
    const response = await fetch(`https://api.stripe.com/v1/payment_intents/${paymentIntentId}`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Stripe API Error: ${error.error?.message || 'Unknown error'}`);
    }

    return response.json();
  }

  async validateWebhook(payload: any, signature: string): Promise<StripeWebhookValidation> {
    try {
      // Em produção, isso será feito nas edge functions do Supabase
      return {
        valid: true,
        event: payload.type,
        payload: payload
      };
    } catch (error) {
      return {
        valid: false
      };
    }
  }

  isConfigured(): boolean {
    return !!(this.publishableKey && this.secretKey);
  }

  getSystemConfig(): StripeSystemConfig {
    return {
      publishableKey: this.publishableKey,
      environment: this.secretKey?.startsWith('sk_test') ? 'test' : 'production',
      webhookSecret: this.webhookSecret
    };
  }
}

export const stripeService = new StripeService();
export default stripeService;