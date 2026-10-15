// useAiAdvisor: cada método chama a edge function com o mode certo; erro HTTP
// extrai mensagem/código do corpo (FunctionsHttpError esconde em context).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockSupabase } from '../helpers/supabaseMock';

vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabase } = await import('../helpers/supabaseMock');
  return { supabase: mockSupabase };
});
const captureError = vi.fn();
vi.mock('@/lib/monitoring', () => ({ captureError: (...a: unknown[]) => captureError(...a) }));

import { useAiAdvisor, AdvisorError } from '@/hooks/useAiAdvisor';

describe('useAiAdvisor', () => {
  beforeEach(() => { mockSupabase.functions.invoke.mockReset(); captureError.mockClear(); });

  it('monta o body por modo e devolve o data', async () => {
    const api = useAiAdvisor();
    mockSupabase.functions.invoke.mockResolvedValue({ data: { ok: true }, error: null });
    await api.chat([{ role: 'user', content: 'oi' }]);
    await api.insights('semana');
    await api.resumoProcesso('p1');
    await api.resumoPublicacao('pub1');
    await api.fundamentacao('tema', 'ctx');
    await api.importarFinanceiro([], ['Honorários'], ['Aluguel']);
    const r = await api.tts('texto', 'nova');
    expect(r).toEqual({ ok: true });
    const calls = mockSupabase.functions.invoke.mock.calls as unknown as Array<[string, { body: Record<string, unknown> }]>;
    expect(calls.map(([fn, { body }]) => [fn, body.mode ?? body.text])).toEqual([
      ['ai-advisor', 'chat'], ['ai-advisor', 'insights'], ['ai-advisor', 'resumo_processo'], ['ai-advisor', 'resumo_publicacao'],
      ['ai-advisor', 'fundamentacao'], ['ai-advisor', 'importar_financeiro'], ['ai-voice', 'texto'],
    ]);
    expect(calls[1][1].body).toEqual({ mode: 'insights', period: 'semana' });
    expect(calls[5][1].body).toEqual({ mode: 'importar_financeiro', rows: [], categoriasReceita: ['Honorários'], categoriasDespesa: ['Aluguel'] });
    expect(calls[6][1].body).toEqual({ text: 'texto', voice: 'nova' });
  });

  it('erro com corpo JSON vira AdvisorError com mensagem e código do servidor', async () => {
    const api = useAiAdvisor();
    mockSupabase.functions.invoke.mockResolvedValueOnce({ data: null, error: {
      message: 'Edge Function returned a non-2xx status code',
      context: { json: async () => ({ error: 'limite_mensal', message: 'Cota de IA do escritório esgotada' }) },
    } });
    const err = await api.chat([]).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AdvisorError);
    expect(err).toMatchObject({ message: 'Cota de IA do escritório esgotada', code: 'limite_mensal' });

    // corpo só com `error`
    mockSupabase.functions.invoke.mockResolvedValueOnce({ data: null, error: { message: 'x', context: { json: async () => ({ error: 'sem_creditos' }) } } });
    const e2 = await api.insights('hoje').catch((e: unknown) => e);
    expect(e2).toMatchObject({ message: 'sem_creditos', code: 'sem_creditos' });
  });

  it('erro sem contexto ou com corpo ilegível mantém a mensagem original e reporta o parse', async () => {
    const api = useAiAdvisor();
    mockSupabase.functions.invoke.mockResolvedValueOnce({ data: null, error: { message: 'Failed to fetch' } });
    await expect(api.tts('a')).rejects.toMatchObject({ message: 'Failed to fetch', code: 'erro' });
    expect(captureError).not.toHaveBeenCalled();

    mockSupabase.functions.invoke.mockResolvedValueOnce({ data: null, error: { message: 'HTTP 500', context: { json: async () => { throw new Error('not json'); } } } });
    await expect(api.tts('a')).rejects.toMatchObject({ message: 'HTTP 500', code: 'erro' });
    expect(captureError).toHaveBeenCalledTimes(1);

    mockSupabase.functions.invoke.mockResolvedValueOnce({ data: null, error: {} });
    await expect(api.tts('a')).rejects.toMatchObject({ message: 'Falha ao chamar a IA.' });
  });
});
