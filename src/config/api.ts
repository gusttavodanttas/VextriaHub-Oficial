// Configurações de API
import { supabase } from "@/integrations/supabase/client";

export const API_CONFIG = {
  // Base URLs das APIs
  PROCESSO_API_BASE_URL: 'https://api-publica.datajud.cnj.jus.br',
  
  // Configurações Stripe (APENAS CHAVE PÚBLICA NO FRONTEND)
  STRIPE: {
    PUBLISHABLE_KEY: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '',
    WEBHOOK_URL: 'https://rceixowecqpiotophyku.supabase.co/functions/v1/stripe-webhook',
  },
  
  // Headers padrão
  DEFAULT_HEADERS: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
};

// Função para verificar se Stripe está configurado minimamente
export const isStripeConfigured = () => {
  return !!import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
};

// Função para fazer requisições de processo via Edge Function (Seguro)
export const fetchProcessoInfo = async (numeroProcesso: string, tribunal?: string) => {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    if (!token) {
      throw new Error("Usuário não autenticado");
    }

    const { data, error } = await supabase.functions.invoke('fetch-processo', {
      body: { numeroProcesso, tribunal },
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (error) throw error;
    return data;
  } catch (error: any) {
    console.error('❌ Erro ao buscar processo via Edge Function:', error);
    throw error;
  }
};

// Função genérica para requisições legadas (mantida por compatibilidade, mas agora desincentivada para processos)
export const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
  console.warn("⚠️ Chamada direta para API legada detectada. Use fetchProcessoInfo para buscas seguras.");
  const url = `${API_CONFIG.PROCESSO_API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      ...API_CONFIG.DEFAULT_HEADERS,
      ...options.headers
    }
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} - ${response.statusText}`);
  }

  return response.json();
};