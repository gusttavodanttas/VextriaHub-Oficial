import { describe, expect, it, vi } from 'vitest';

// as regras são puras; o client só precisa existir para o módulo carregar
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
import { camposPendentes, cardAtrasadoNaFase, diasNaFase, diasUteisEntre } from '@/hooks/useEsteiras';

describe('esteiras — regras do card', () => {
  it('conta dias úteis pulando o fim de semana', () => {
    // sexta 30/10/2026 → segunda 02/11/2026 = 1 dia útil
    expect(diasUteisEntre(new Date(2026, 9, 30), new Date(2026, 10, 2))).toBe(1);
    // segunda → sexta da mesma semana = 4
    expect(diasUteisEntre(new Date(2026, 10, 2), new Date(2026, 10, 6))).toBe(4);
  });

  it('dias na fase nunca fica negativo', () => {
    const futuro = new Date(Date.now() + 86_400_000).toISOString();
    expect(diasNaFase({ entrou_fase_em: futuro })).toBe(0);
  });

  it('marca atraso só quando passa do prazo interno e a fase não é de finalização', () => {
    const entrou = new Date(2026, 9, 26, 9).toISOString(); // segunda 26/10
    const agora = new Date(2026, 9, 30, 9);                // sexta 30/10 → 4 dias úteis
    expect(cardAtrasadoNaFase({ entrou_fase_em: entrou }, { sla_dias: 3, finalizacao: false }, agora)).toBe(true);
    expect(cardAtrasadoNaFase({ entrou_fase_em: entrou }, { sla_dias: 5, finalizacao: false }, agora)).toBe(false);
    expect(cardAtrasadoNaFase({ entrou_fase_em: entrou }, { sla_dias: 1, finalizacao: true }, agora)).toBe(false);
    expect(cardAtrasadoNaFase({ entrou_fase_em: entrou }, { sla_dias: null, finalizacao: false }, agora)).toBe(false);
  });

  it('lista só os campos obrigatórios vazios', () => {
    const fase = {
      campos: [
        { id: 'a', label: 'Valor', tipo: 'moeda' as const, obrigatorio: true },
        { id: 'b', label: 'Link', tipo: 'url' as const, obrigatorio: true },
        { id: 'c', label: 'Obs', tipo: 'texto' as const },
      ],
    };
    expect(camposPendentes({ dados: { a: 1500 } }, fase).map(c => c.id)).toEqual(['b']);
    expect(camposPendentes({ dados: { a: 0, b: 'https://x' } }, fase)).toEqual([]);
    expect(camposPendentes({ dados: { b: '' } }, fase).map(c => c.id)).toEqual(['a', 'b']);
  });
});
