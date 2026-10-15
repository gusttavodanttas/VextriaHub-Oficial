// Cálculos puros extraídos de pages/Financeiro.tsx: resumo do mês, índice de
// mistura PJ/PF, agrupamento por prioridade e CSV.
import { describe, it, expect } from 'vitest';
import {
  calcularStats, calcularMixing, mixingStatusFor, agruparPendentesPorGrupo, somaGrupo, gerarCsvFinanceiro, SEM_CLASSIFICACAO,
} from '@/components/Financeiro/calculos';
import type { FinanceiroItem } from '@/components/Financeiro/shared';

const item = (over: Partial<FinanceiroItem>): FinanceiroItem => ({
  id: 'x', tipo: 'receita', descricao: 'Honorários', valor: 100, data_vencimento: '2026-03-10', data_pagamento: null,
  status: 'pendente', categoria: null, cliente_id: null, processo_id: null, user_id: 'u1', office_id: 'o1', deletado: false,
  escopo: 'pj', ...over,
});
const mesStart = new Date(2026, 2, 1);
const mesEnd = new Date(2026, 2, 31, 23, 59, 59, 999);

describe('calcularStats', () => {
  it('conta só o mês em visualização; a receber/a pagar usam o saldo em aberto; saldo usa o valor pago', () => {
    const items = [
      item({ id: '1', valor: 100 }),                                                   // receita pendente do mês
      item({ id: '2', valor: 200, status: 'parcial', valor_pago: 50, data_pagamento: '2026-03-05' }), // 150 a receber, 50 no caixa
      item({ id: '3', valor: 300, status: 'cancelado' }),                              // fora
      item({ id: '4', valor: 400, data_vencimento: '2026-04-01' }),                    // mês seguinte
      item({ id: '5', tipo: 'despesa', valor: 80, status: 'vencido' }),                // 80 a pagar
      item({ id: '6', tipo: 'despesa', valor: 30, status: 'pago', data_pagamento: '2026-03-20' }), // -30 no caixa
    ];
    expect(calcularStats(items, mesStart, mesEnd)).toEqual({ receitaMes: 300, aReceber: 250, aPagar: 80, saldo: 20 });
  });
});

describe('calcularMixing / mixingStatusFor', () => {
  it('percentual das despesas (não canceladas) que são PF', () => {
    const items = [
      item({ id: '1', tipo: 'despesa', valor: 90 }),
      item({ id: '2', tipo: 'despesa', valor: 10, escopo: 'pf' }),
      item({ id: '3', tipo: 'despesa', valor: 500, escopo: 'pf', status: 'cancelado' }),
      item({ id: '4', tipo: 'receita', valor: 1000, escopo: 'pf' }),
    ];
    expect(calcularMixing(items)).toEqual({ index: 10, pf: 10, total: 100 });
    expect(calcularMixing([])).toEqual({ index: 0, pf: 0, total: 0 });
  });

  it('faixas: 0 excelente, <10 sob controle, <20 alerta, senão risco alto', () => {
    expect(mixingStatusFor(0).label).toBe('Excelente');
    expect(mixingStatusFor(9.9).label).toBe('Sob Controle');
    expect(mixingStatusFor(10).label).toBe('Alerta');
    expect(mixingStatusFor(20).label).toBe('Risco Alto');
  });
});

describe('agruparPendentesPorGrupo', () => {
  it('cria um balde por grupo configurado; prioridade desconhecida cai em "sem classificação"', () => {
    const grupos = [{ id: 'g1', label: 'G1' }, { id: 'g2', label: 'G2' }];
    const pendentes = [
      item({ id: '1', tipo: 'despesa', prioridade: 'g1', valor: 50 }),
      item({ id: '2', tipo: 'despesa', prioridade: 'antigo', valor: 70, status: 'parcial', valor_pago: 20 }),
      item({ id: '3', tipo: 'despesa', prioridade: null }),
    ];
    const b = agruparPendentesPorGrupo(pendentes, grupos);
    expect(Object.keys(b).sort()).toEqual([SEM_CLASSIFICACAO, 'g1', 'g2'].sort());
    expect(b.g1.map((i) => i.id)).toEqual(['1']);
    expect(b.g2).toEqual([]);
    expect(b[SEM_CLASSIFICACAO].map((i) => i.id)).toEqual(['2', '3']);
    expect(somaGrupo(b[SEM_CLASSIFICACAO])).toBe(50 + 100);
  });
});

describe('gerarCsvFinanceiro', () => {
  it('cabeçalho + uma linha por item, separador ";", aspas escapadas', () => {
    const csv = gerarCsvFinanceiro([
      item({ id: '1', descricao: 'Conta "luz"', categoria: 'Custas', tipo: 'despesa', status: 'pago', valor: 10, data_pagamento: '2026-03-12', prioridade: 'g1', clientes: { nome: 'Ana' } }),
    ], [{ id: 'g1', label: 'G1 · Essencial' }]);
    const linhas = csv.split('\n');
    expect(linhas).toHaveLength(2);
    expect(linhas[0].startsWith('"Tipo";"Descrição";"Categoria"')).toBe(true);
    expect(linhas[1]).toContain('"Despesa";"Conta ""luz""";"Custas"');
    expect(linhas[1]).toContain('"10/03/2026";"12/03/2026";"Pago";"Escritório";"G1 · Essencial";"Ana"');
  });
});
