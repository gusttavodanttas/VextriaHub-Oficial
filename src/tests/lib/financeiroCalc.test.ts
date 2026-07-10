// Testes da geração de parcelas/recorrência do Financeiro — é dinheiro do
// cliente, então a regra inegociável é: a SOMA das parcelas fecha exatamente
// com o valor total, sem centavo perdido nem criado.
import { describe, it, expect } from "vitest";
import { parcelasRows, recorrenciaRows } from "@/lib/financeiroCalc";

const soma = (rows: { valor: number }[]) =>
  Math.round(rows.reduce((s, r) => s + r.valor, 0) * 100) / 100;

describe("parcelasRows — divisão exata em centavos", () => {
  it("valor divisível: 3× R$100 de R$300", () => {
    const rows = parcelasRows(300, 3, "2026-01-10");
    expect(rows.map((r) => r.valor)).toEqual([100, 100, 100]);
    expect(soma(rows)).toBe(300);
  });

  it("dízima (R$100 / 3): a última parcela absorve o centavo", () => {
    const rows = parcelasRows(100, 3, "2026-01-10");
    expect(rows.map((r) => r.valor)).toEqual([33.33, 33.33, 33.34]);
    expect(soma(rows)).toBe(100); // fecha exatamente, sem perder centavo
  });

  it("R$1.000 em 7 parcelas soma exatamente 1000", () => {
    const rows = parcelasRows(1000, 7, "2026-01-10");
    expect(rows).toHaveLength(7);
    expect(soma(rows)).toBe(1000);
    // todas iguais menos a última, que compensa o resto
    const primeiras = rows.slice(0, 6).map((r) => r.valor);
    expect(new Set(primeiras).size).toBe(1);
  });

  it("numera as parcelas 1..n e marca o total em cada uma", () => {
    const rows = parcelasRows(500, 4, "2026-01-10");
    expect(rows.map((r) => r.parcela_numero)).toEqual([1, 2, 3, 4]);
    expect(rows.every((r) => r.parcela_total === 4)).toBe(true);
  });

  it("as parcelas vencem mês a mês a partir da data base", () => {
    const rows = parcelasRows(300, 3, "2026-01-31");
    expect(rows.map((r) => r.data_vencimento)).toEqual([
      "2026-01-31", "2026-02-28", "2026-03-31", // fev sem dia 31 → 28 (comportamento do date-fns)
    ]);
  });

  it("centavos com valores quebrados (R$99,99 em 4) fecham a conta", () => {
    const rows = parcelasRows(99.99, 4, "2026-01-10");
    expect(soma(rows)).toBe(99.99);
  });
});

describe("recorrenciaRows — mesmo valor, datas por frequência", () => {
  it("mensal: 3 lançamentos, mês a mês, valor cheio", () => {
    const rows = recorrenciaRows(250, 3, "2026-01-15", "mensal");
    expect(rows.map((r) => r.valor)).toEqual([250, 250, 250]);
    expect(rows.map((r) => r.data_vencimento)).toEqual(["2026-01-15", "2026-02-15", "2026-03-15"]);
  });

  it("semanal: passos de 7 dias", () => {
    const rows = recorrenciaRows(80, 3, "2026-01-01", "semanal");
    expect(rows.map((r) => r.data_vencimento)).toEqual(["2026-01-01", "2026-01-08", "2026-01-15"]);
  });

  it("quinzenal: passos de 14 dias", () => {
    const rows = recorrenciaRows(80, 3, "2026-01-01", "quinzenal");
    expect(rows.map((r) => r.data_vencimento)).toEqual(["2026-01-01", "2026-01-15", "2026-01-29"]);
  });

  it("gera exatamente `count` lançamentos", () => {
    expect(recorrenciaRows(100, 12, "2026-01-10", "mensal")).toHaveLength(12);
  });
});
