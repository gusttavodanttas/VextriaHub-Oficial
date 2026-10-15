// Gamificação de tarefas (função pura extraída de pages/Tarefas.tsx): pontos, nível,
// meta semanal e sequência de dias consecutivos.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { calcularGame } from '@/lib/tarefasGame';

const iso = (d: Date) => d.toISOString();
const dias = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };

describe('calcularGame', () => {
  afterEach(() => vi.useRealTimers());

  it('sem tarefas: nível 1, zero pontos, sem sequência', () => {
    expect(calcularGame([])).toEqual({ concluidasSemana: 0, pontos: 0, nivel: 1, streak: 0, metaSemanal: 10, progresso: 0 });
  });

  it('10 pontos por concluída; nível sobe a cada 100; progresso limitado a 100%', () => {
    const tarefas = Array.from({ length: 12 }, () => ({ concluida: true, concluida_em: iso(new Date()) }));
    const g = calcularGame(tarefas);
    expect(g.pontos).toBe(120);
    expect(g.nivel).toBe(2);
    expect(g.concluidasSemana).toBe(12);
    expect(g.progresso).toBe(100);
  });

  it('sequência conta dias consecutivos e aceita que hoje ainda não tenha conclusão', () => {
    // ontem, anteontem e 3 dias atrás → streak 3 (hoje sem conclusão não quebra)
    const g = calcularGame([1, 2, 3].map((n) => ({ concluida: true, concluida_em: iso(dias(n)) })));
    expect(g.streak).toBe(3);
    // buraco em 2 dias atrás → só ontem conta
    const g2 = calcularGame([1, 3].map((n) => ({ concluida: true, concluida_em: iso(dias(n)) })));
    expect(g2.streak).toBe(1);
  });

  it('tarefa antiga sem concluida_em usa updated_at; pendente não pontua', () => {
    const g = calcularGame([
      { concluida: true, concluida_em: null, updated_at: iso(new Date()) },
      { concluida: false, concluida_em: null, updated_at: iso(new Date()) },
    ]);
    expect(g.pontos).toBe(10);
    expect(g.concluidasSemana).toBe(1);
  });
});
