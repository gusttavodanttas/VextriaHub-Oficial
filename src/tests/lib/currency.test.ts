import { describe, it, expect } from "vitest";
import { formatBRL, centsToBRL } from "@/lib/currency";

// Normaliza espaços (o Intl BRL usa espaço não-quebrável U+00A0 entre "R$" e o
// número, e a versão do ICU varia entre ambientes) → compara sem depender disso.
const norm = (s: string) => s.replace(/\s/g, " ");

describe("formatBRL — reais", () => {
  it("2 casas por padrão", () => {
    expect(norm(formatBRL(1234.56))).toBe("R$ 1.234,56");
    expect(norm(formatBRL(97))).toBe("R$ 97,00");
    expect(norm(formatBRL(0))).toBe("R$ 0,00");
  });

  it("decimals:0 remove os centavos (KPIs/resumos)", () => {
    expect(norm(formatBRL(1234, { decimals: 0 }))).toBe("R$ 1.234");
    expect(norm(formatBRL(1000000, { decimals: 0 }))).toBe("R$ 1.000.000");
  });

  it("null/undefined/NaN → zero (nunca quebra o render)", () => {
    expect(norm(formatBRL(null))).toBe("R$ 0,00");
    expect(norm(formatBRL(undefined))).toBe("R$ 0,00");
    expect(norm(formatBRL(NaN))).toBe("R$ 0,00");
    expect(norm(formatBRL(null, { decimals: 0 }))).toBe("R$ 0");
  });

  it("negativos (saldo no vermelho)", () => {
    expect(norm(formatBRL(-500.5))).toBe("-R$ 500,50");
  });
});

describe("centsToBRL — centavos (price_cents)", () => {
  it("divide por 100 e mostra 2 casas", () => {
    expect(norm(centsToBRL(9700))).toBe("R$ 97,00");
    expect(norm(centsToBRL(199900))).toBe("R$ 1.999,00");
    expect(norm(centsToBRL(0))).toBe("R$ 0,00");
  });

  it("null/undefined → R$ 0,00", () => {
    expect(norm(centsToBRL(null))).toBe("R$ 0,00");
    expect(norm(centsToBRL(undefined))).toBe("R$ 0,00");
  });

  it("é equivalente a formatBRL(cents/100) — trava o ÷100", () => {
    for (const c of [0, 4700, 9700, 19700, 39700, 697000]) {
      expect(centsToBRL(c)).toBe(formatBRL(c / 100));
    }
  });
});
