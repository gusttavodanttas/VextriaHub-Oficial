// Testes do cálculo de prazos processuais — a lógica de MAIOR risco jurídico
// (um prazo errado = perda de prazo). Cobre dias úteis, feriados nacionais,
// feriados móveis (Páscoa/Carnaval/Corpus), recesso forense, Juizado (corridos)
// e feriados do escritório. Datas testadas via getFullYear/Month/Date (locais e
// estáveis em qualquer fuso do CI) — não via toISO (que depende do TZ).
import { describe, it, expect } from "vitest";
import {
  easterSunday, movableFeriados, isRecesso, isFeriado, isUtil, isUtilWith,
  addDiasUteis, addDiasUteisWith, addDiasCorridos,
} from "@/lib/prazoCalc";

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);
const ymd = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
const EMPTY = new Set<string>();

describe("easterSunday (Meeus/Butcher)", () => {
  it("bate com as datas conhecidas da Páscoa", () => {
    expect(ymd(easterSunday(2024))).toBe("2024-03-31");
    expect(ymd(easterSunday(2025))).toBe("2025-04-20");
    expect(ymd(easterSunday(2026))).toBe("2026-04-05");
  });
});

describe("movableFeriados — derivados da Páscoa", () => {
  it("2026: carnaval 16-17/02, sexta santa 03/04, corpus christi 04/06", () => {
    const s = movableFeriados(2026);
    expect(s.has("02-16")).toBe(true); // Carnaval segunda
    expect(s.has("02-17")).toBe(true); // Carnaval terça
    expect(s.has("04-03")).toBe(true); // Sexta-feira Santa
    expect(s.has("06-04")).toBe(true); // Corpus Christi
    expect(s.has("01-01")).toBe(false); // fixo, não entra aqui
  });
});

describe("isFeriado — fixos + móveis", () => {
  it("reconhece feriados nacionais fixos", () => {
    for (const [m, day] of [[1, 1], [4, 21], [5, 1], [9, 7], [10, 12], [11, 2], [11, 15], [12, 25]] as const) {
      expect(isFeriado(d(2026, m, day))).toBe(true);
    }
  });
  it("reconhece feriado móvel (Corpus Christi 2026)", () => {
    expect(isFeriado(d(2026, 6, 4))).toBe(true);
  });
  it("dia comum não é feriado", () => {
    expect(isFeriado(d(2026, 3, 10))).toBe(false);
  });
});

describe("isRecesso — 20/12 a 20/01 (CPC 220)", () => {
  it("inclui as bordas e exclui fora", () => {
    expect(isRecesso(d(2026, 12, 20))).toBe(true);
    expect(isRecesso(d(2026, 12, 31))).toBe(true);
    expect(isRecesso(d(2027, 1, 1))).toBe(true);
    expect(isRecesso(d(2027, 1, 20))).toBe(true);
    expect(isRecesso(d(2026, 12, 19))).toBe(false);
    expect(isRecesso(d(2027, 1, 21))).toBe(false);
  });
});

describe("isUtil — exclui fim de semana, feriado e recesso", () => {
  it("terça comum é útil", () => {
    expect(isUtil(d(2026, 3, 10))).toBe(true); // 10/03/2026 = terça
  });
  it("sábado e domingo não são úteis", () => {
    expect(isUtil(d(2026, 3, 7))).toBe(false);  // sábado
    expect(isUtil(d(2026, 3, 8))).toBe(false);  // domingo
  });
  it("feriado e dia de recesso não são úteis", () => {
    expect(isUtil(d(2026, 9, 7))).toBe(false);  // Independência
    expect(isUtil(d(2026, 12, 28))).toBe(false); // recesso
  });
});

describe("addDiasUteis — contagem de prazo (CPC 219)", () => {
  it("pula o fim de semana: seg + 5 úteis = próxima seg", () => {
    // 02/03/2026 é segunda-feira
    expect(ymd(addDiasUteis(d(2026, 3, 2), 5))).toBe("2026-03-09");
  });
  it("prazo que cruza um feriado nacional ganha 1 dia", () => {
    // 20/04/2026 (seg) + 3 úteis; 21/04 (Tiradentes) é pulado → cai em 24/04
    expect(ymd(addDiasUteis(d(2026, 4, 20), 3))).toBe("2026-04-24");
  });
  it("começando na sexta, o 1º dia útil é a segunda", () => {
    // 06/03/2026 é sexta → +1 útil = segunda 09/03
    expect(ymd(addDiasUteis(d(2026, 3, 6), 1))).toBe("2026-03-09");
  });
});

describe("addDiasCorridos — Juizado (Lei 9.099/95)", () => {
  it("conta dias corridos, inclusive fim de semana", () => {
    expect(ymd(addDiasCorridos(d(2026, 3, 6), 3))).toBe("2026-03-09"); // sex + 3 corridos
    expect(ymd(addDiasCorridos(d(2026, 3, 2), 10))).toBe("2026-03-12");
  });
});

describe("addDiasUteisWith — feriados do escritório", () => {
  it("um feriado anual do escritório (MM-DD) empurra o prazo", () => {
    const anual = new Set(["03-04"]); // 04/03/2026 é quarta
    // 02/03 (seg) + 3 úteis: sem extra = 05/03; com 04/03 bloqueado = 06/03
    expect(ymd(addDiasUteisWith(d(2026, 3, 2), 3, EMPTY, EMPTY))).toBe("2026-03-05");
    expect(ymd(addDiasUteisWith(d(2026, 3, 2), 3, anual, EMPTY))).toBe("2026-03-06");
  });
  it("um feriado específico do escritório (YYYY-MM-DD) empurra o prazo", () => {
    const data = new Set(["2026-03-04"]);
    expect(ymd(addDiasUteisWith(d(2026, 3, 2), 3, EMPTY, data))).toBe("2026-03-06");
  });
  it("sem feriados extras, é igual ao addDiasUteis padrão", () => {
    expect(ymd(addDiasUteisWith(d(2026, 4, 20), 3, EMPTY, EMPTY)))
      .toBe(ymd(addDiasUteis(d(2026, 4, 20), 3)));
  });
});

describe("cenário real — intimação + prazo em dobro (CPC 229)", () => {
  it("15 dias úteis dobram para 30 (Fazenda/litisconsortes)", () => {
    // Publicação numa segunda comum; intimação = +1 útil; fatal = +15 vs +30
    const pub = d(2026, 3, 2);
    const intimacao = addDiasUteisWith(pub, 1, EMPTY, EMPTY);
    const simples = addDiasUteisWith(intimacao, 15, EMPTY, EMPTY);
    const dobro = addDiasUteisWith(intimacao, 30, EMPTY, EMPTY);
    // o dobro tem que cair estritamente depois do simples
    expect(dobro.getTime()).toBeGreaterThan(simples.getTime());
    // e ambos precisam ser dias úteis
    expect(isUtil(simples)).toBe(true);
    expect(isUtil(dobro)).toBe(true);
  });
});
