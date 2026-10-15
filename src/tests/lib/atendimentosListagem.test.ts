// Regras puras da listagem de atendimentos (extraídas de pages/Atendimentos.tsx):
// stats com/sem contagem do servidor, pendentes de baixa, período e agrupamento.
import { describe, it, expect } from 'vitest';
import { addDays, format } from 'date-fns';
import { calcularStats, pendentesDeBaixa, matchPeriodo, agruparPorJanela } from '@/components/Atendimentos/listagem';
import type { Atendimento } from '@/components/Atendimentos/shared';

const em = (dias: number, hora = '10:00') => `${format(addDays(new Date(), dias), 'yyyy-MM-dd')}T${hora}:00`;
const at = (over: Partial<Atendimento>): Atendimento => ({
  id: 'a', tipo_atendimento: 'reuniao', data_atendimento: em(1), status: 'agendado', office_id: 'o1', user_id: 'u1', deletado: false, ...over,
}) as Atendimento;

describe('calcularStats', () => {
  it('usa a contagem do servidor para total/realizados/cancelados; agendados é sempre o carregado', () => {
    const items = [at({ id: '1' }), at({ id: '2', status: 'realizado' }), at({ id: '3', status: 'cancelado' })];
    expect(calcularStats(items, { total: 50, realizados: 30, cancelados: 7 })).toEqual({ total: 50, agendados: 1, realizados: 30, cancelados: 7 });
    expect(calcularStats(items, null)).toEqual({ total: 3, agendados: 1, realizados: 1, cancelados: 1 });
  });
});

describe('pendentesDeBaixa', () => {
  it('só passados ainda agendados/pendentes, do mais antigo pro mais novo', () => {
    const items = [
      at({ id: 'ontem', data_atendimento: em(-1) }),
      at({ id: 'semana', data_atendimento: em(-7), status: 'pendente' }),
      at({ id: 'feito', data_atendimento: em(-3), status: 'realizado' }),
      at({ id: 'futuro', data_atendimento: em(2) }),
    ];
    expect(pendentesDeBaixa(items).map((i) => i.id)).toEqual(['semana', 'ontem']);
  });
});

describe('matchPeriodo', () => {
  it('hoje / próximos 7 dias / futuros / passados / todos', () => {
    const hoje = at({ data_atendimento: em(0, '23:00') });
    const em5 = at({ data_atendimento: em(5) });
    const em20 = at({ data_atendimento: em(20) });
    const ontem = at({ data_atendimento: em(-1) });
    expect([hoje, em5, em20, ontem].map((i) => matchPeriodo(i, 'hoje'))).toEqual([true, false, false, false]);
    expect([hoje, em5, em20, ontem].map((i) => matchPeriodo(i, '7dias'))).toEqual([true, true, false, false]);
    expect([hoje, em5, em20, ontem].map((i) => matchPeriodo(i, 'futuros'))).toEqual([false, true, true, false]);
    expect([hoje, em5, em20, ontem].map((i) => matchPeriodo(i, 'passados'))).toEqual([false, false, false, true]);
    expect(matchPeriodo(ontem, 'todos')).toBe(true);
  });
});

describe('agruparPorJanela', () => {
  it('grupos na ordem fixa, sem vazios; passados do mais recente pro mais antigo', () => {
    const grupos = agruparPorJanela([
      at({ id: 'p1', data_atendimento: em(-10) }),
      at({ id: 'p2', data_atendimento: em(-2) }),
      at({ id: 'h2', data_atendimento: em(0, '15:00') }),
      at({ id: 'h1', data_atendimento: em(0, '09:00') }),
      at({ id: 'f1', data_atendimento: em(30) }),
    ]);
    expect(grupos.map((g) => g.key)).toEqual(['hoje', 'futuros', 'passados']);
    expect(grupos[0].items.map((i) => i.id)).toEqual(['h1', 'h2']);
    expect(grupos[2].items.map((i) => i.id)).toEqual(['p2', 'p1']);
  });
});
