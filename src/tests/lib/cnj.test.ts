import { describe, it, expect } from "vitest";
import { formatCNJ, cleanCNJ, extractYearFromCNJ, maskCNJ } from "@/utils/formatCNJ";

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

describe("maskCNJ", () => {
  it("formata parcialmente enquanto digita", () => {
    expect(maskCNJ("0707058")).toBe("0707058");
    expect(maskCNJ("070705818")).toBe("0707058-18");
    expect(maskCNJ("0707058182026")).toBe("0707058-18.2026");
  });
  it("formata os 20 dígitos completos no padrão CNJ", () => {
    expect(maskCNJ("07070581820268070006")).toBe("0707058-18.2026.8.07.0006");
  });
  it("ignora não-dígitos e limita a 20 dígitos", () => {
    expect(maskCNJ("abc07070581820268070006999")).toBe("0707058-18.2026.8.07.0006");
  });
  it("vazio vira string vazia", () => {
    expect(maskCNJ("")).toBe("");
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
