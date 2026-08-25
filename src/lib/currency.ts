// Fonte ÚNICA de formatação de dinheiro (BRL). Antes cada arquivo tinha o seu
// `brl`/`formatBRL` com Intl próprio — 3 semânticas divergentes conviviam
// (2 casas, 0 casas, e ÷100 pra centavos) e um valor no helper errado errava
// por 100×. Centralizado + testado em src/tests/lib/currency.test.ts.
//
// REGRA DE UNIDADE (importante):
//   - formatBRL recebe REAIS (ex.: financeiro.valor, valor_estimado, valor_causa).
//   - centsToBRL recebe CENTAVOS (ex.: plan_configs.price_cents).
// Passar centavos no formatBRL (ou reais no centsToBRL) erra por 100×.

const nf = (min: number, max: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: min, maximumFractionDigits: max });

// Instâncias reusadas (criar Intl.NumberFormat por chamada é caro).
const F2 = nf(2, 2); // "R$ 1.234,56" — valores financeiros
const F0 = nf(0, 0); // "R$ 1.234"    — resumos/KPIs (sem centavos)

/**
 * Formata um valor em REAIS como BRL. `decimals: 0` para KPIs/resumos
 * (sem centavos); padrão 2 casas. null/undefined/NaN → R$ 0,00 (ou R$ 0).
 */
export function formatBRL(reais: number | null | undefined, opts?: { decimals?: 0 | 2 }): string {
  const v = Number(reais) || 0;
  return (opts?.decimals === 0 ? F0 : F2).format(v);
}

/**
 * Formata CENTAVOS (inteiro, ex.: plan_configs.price_cents) como BRL, 2 casas.
 * = formatBRL(cents / 100).
 */
export function centsToBRL(cents: number | null | undefined): string {
  return F2.format((Number(cents) || 0) / 100);
}
