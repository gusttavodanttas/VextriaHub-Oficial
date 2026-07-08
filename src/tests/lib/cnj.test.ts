import { describe, it, expect } from "vitest";
import { formatCNJ, cleanCNJ, extractYearFromCNJ } from "@/utils/formatCNJ";

describe("formatCNJ", () => {
  it("formata 20 dígitos no padrão CNJ", () => {
    expect(formatCNJ("07070581820268070006")).toBe("0707058-18.2026.8.07.0006");
  });
  it("reformata um número já formatado (idempotente)", () => {
    expect(formatCNJ("0707058-18.2026.8.07.0006")).toBe("0707058-18.2026.8.07.0006");
  });
  it("devolve como veio quando não tem 20 dígitos", () => {
    expect(formatCNJ("12345")).toBe("12345");
  });
  it("vazio/nulo vira string vazia", () => {
    expect(formatCNJ("")).toBe("");
    expect(formatCNJ(null)).toBe("");
    expect(formatCNJ(undefined)).toBe("");
  });
});

describe("cleanCNJ", () => {
  it("mantém apenas dígitos", () => {
    expect(cleanCNJ("0707058-18.2026.8.07.0006")).toBe("07070581820268070006");
  });
  it("vazio/nulo vira string vazia", () => {
    expect(cleanCNJ(null)).toBe("");
  });
});

describe("extractYearFromCNJ", () => {
  it("extrai o ano de distribuição", () => {
    expect(extractYearFromCNJ("0707058-18.2026.8.07.0006")).toBe("2026");
  });
  it("null quando o número é incompleto", () => {
    expect(extractYearFromCNJ("123")).toBeNull();
  });
});
