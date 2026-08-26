import { supabase } from '@/integrations/supabase/client';

export type AdvisorPeriod = 'hoje' | 'semana' | 'mes' | 'ano';

export interface AdvisorInsights {
  resumo?: string;
  alertas?: string[];
  recomendacoes?: string[];
  produtividade?: string[];
  plano_acao?: string[];
}
export interface AdvisorSnapshot {
  processos_ativos: number;
  prazos_vencendo: number;
  prazos_vencidos: number;
  audiencias_proximas: number;
  publicacoes_nao_tratadas: number;
  tarefas_pendentes: number;
  tarefas_atrasadas: number;
  diligencias_a_pagar: number;
  valor_diligencias_a_pagar: number;
  movimentacoes_no_periodo: number;
}
export interface ResumoProcesso { resumo?: string; situacao_atual?: string; proximos_passos?: string[]; }
export interface ResumoPublicacao {
  resumo?: string;
  urgencia?: 'alta' | 'media' | 'baixa';
  prazo_sugerido?: { titulo?: string; dias?: number | null; tipo?: string; descricao?: string } | null;
}

export class AdvisorError extends Error {
  code: string;
  constructor(message: string, code: string) { super(message); this.code = code; }
}

// Extrai a mensagem/código reais do corpo da edge function (FunctionsHttpError esconde no context).
async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('ai-advisor', { body });
  if (error) {
    let msg = error.message || 'Falha ao chamar a IA.';
    let code = 'erro';
    try {
      const ctx = (error as unknown as { context?: Response }).context;
      const j = ctx && typeof ctx.json === 'function' ? await ctx.json() : null;
      if (j?.message) msg = j.message;
      else if (j?.error) msg = j.error;
      if (j?.error) code = j.error;
    } catch { /* mantém a mensagem genérica */ }
    throw new AdvisorError(msg, code);
  }
  return data as T;
}

export function useAiAdvisor() {
  return {
    insights: (period: AdvisorPeriod) =>
      invoke<{ ok: boolean; period: string; snapshot: AdvisorSnapshot; data: AdvisorInsights }>({ mode: 'insights', period }),
    resumoProcesso: (processoId: string) =>
      invoke<{ ok: boolean; data: ResumoProcesso }>({ mode: 'resumo_processo', processoId }),
    resumoPublicacao: (publicacaoId: string) =>
      invoke<{ ok: boolean; data: ResumoPublicacao }>({ mode: 'resumo_publicacao', publicacaoId }),
  };
}
