import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStripe } from '../../hooks/useStripe';

// Mocks
const mockGetSession = vi.fn();
const mockInvoke = vi.fn();

vi.mock('../../integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
    },
    functions: {
      invoke: (funcName: string, options: any) => mockInvoke(funcName, options),
    },
  },
}));

describe('useStripe Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createCheckoutSession', () => {
    it('should throw an error if user is not authenticated', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null } });

      const { result } = renderHook(() => useStripe());

      await act(async () => {
        await expect(result.current.createCheckoutSession('Básico', 99)).rejects.toThrow('Usuário não autenticado');
      });

      expect(result.current.error).toBe('Usuário não autenticado');
      expect(result.current.loading).toBe(false);
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('should invoke create-checkout edge function on success', async () => {
      mockGetSession.mockResolvedValue({ data: { session: { access_token: 'valid-token' } } });
      const mockCheckoutResponse = { url: 'https://checkout.stripe.com/...' };
      mockInvoke.mockResolvedValue({ data: mockCheckoutResponse, error: null });

      const { result } = renderHook(() => useStripe());

      let response;
      await act(async () => {
        response = await result.current.createCheckoutSession('Avançado', 299);
      });

      expect(mockInvoke).toHaveBeenCalledWith('create-checkout', {
        headers: { Authorization: 'Bearer valid-token' },
        body: { planName: 'Avançado', planPrice: 299 },
      });
      expect(response).toEqual(mockCheckoutResponse);
      expect(result.current.error).toBe(null);
      expect(result.current.loading).toBe(false);
    });

    it('should throw an error if edge function returns an error', async () => {
      mockGetSession.mockResolvedValue({ data: { session: { access_token: 'valid-token' } } });
      const backendError = new Error('Erro interno no servidor Stripe');
      mockInvoke.mockResolvedValue({ data: null, error: backendError });

      const { result } = renderHook(() => useStripe());

      await act(async () => {
        await expect(result.current.createCheckoutSession('Básico', 99)).rejects.toThrow('Erro interno no servidor Stripe');
      });

      expect(result.current.error).toBe('Erro interno no servidor Stripe');
    });
  });

  describe('checkSubscription', () => {
    it('should return default un-subscribed info if user is not authenticated', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null } });

      const { result } = renderHook(() => useStripe());

      let response;
      await act(async () => {
        response = await result.current.checkSubscription();
      });

      expect(response).toEqual({ subscribed: false });
      expect(result.current.error).toBe('Usuário não autenticado');
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('should return subscription data on success', async () => {
      mockGetSession.mockResolvedValue({ data: { session: { access_token: 'valid-token' } } });
      const mockSubData = { subscribed: true, subscription_tier: 'premium' };
      mockInvoke.mockResolvedValue({ data: mockSubData, error: null });

      const { result } = renderHook(() => useStripe());

      let response;
      await act(async () => {
        response = await result.current.checkSubscription();
      });

      expect(mockInvoke).toHaveBeenCalledWith('check-subscription', {
        headers: { Authorization: 'Bearer valid-token' },
      });
      expect(response).toEqual(mockSubData);
    });

    it('should fallback to subscribed false if edge function fails', async () => {
      mockGetSession.mockResolvedValue({ data: { session: { access_token: 'valid-token' } } });
      const backendError = new Error('Falha de rede');
      mockInvoke.mockResolvedValue({ data: null, error: backendError });

      const { result } = renderHook(() => useStripe());

      let response;
      await act(async () => {
        response = await result.current.checkSubscription();
      });

      expect(response).toEqual({ subscribed: false });
      expect(result.current.error).toBe('Falha de rede');
    });
  });

  describe('openCustomerPortal', () => {
    // Para simplificar o teste deste método que acessa window.open, 
    // fazemos um pequeno mock global do window
    const originalWindowOpen = window.open;
    
    beforeEach(() => {
      window.open = vi.fn();
    });

    afterEach(() => {
      window.open = originalWindowOpen;
    });

    it('should invoke customer-portal and open new tab', async () => {
      mockGetSession.mockResolvedValue({ data: { session: { access_token: 'valid-token' } } });
      const mockPortalResponse = { url: 'https://billing.stripe.com/portal/...' };
      mockInvoke.mockResolvedValue({ data: mockPortalResponse, error: null });

      const { result } = renderHook(() => useStripe());

      await act(async () => {
        await result.current.openCustomerPortal();
      });

      expect(mockInvoke).toHaveBeenCalledWith('customer-portal', {
        headers: { Authorization: 'Bearer valid-token' },
      });
      expect(window.open).toHaveBeenCalledWith(mockPortalResponse.url, '_blank');
    });
  });
});
