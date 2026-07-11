// Testes do getErrorMessage — o extrator usado em todos os blocos catch para
// trocar `any` por `unknown` sem perder a mensagem que vai pro toast do usuário.
import { describe, it, expect } from "vitest";
import { getErrorMessage } from "@/lib/errors";

describe("getErrorMessage", () => {
  it("usa a mensagem de um Error", () => {
    expect(getErrorMessage(new Error("Falha na rede"))).toBe("Falha na rede");
  });

  it("usa a mensagem de um erro do Supabase ({ message })", () => {
    expect(getErrorMessage({ message: "duplicate key value", code: "23505" })).toBe("duplicate key value");
  });

  it("aceita string crua", () => {
    expect(getErrorMessage("deu ruim")).toBe("deu ruim");
  });

  it("cai no fallback quando não há mensagem aproveitável", () => {
    expect(getErrorMessage(null)).toBe("Ocorreu um erro inesperado.");
    expect(getErrorMessage(undefined)).toBe("Ocorreu um erro inesperado.");
    expect(getErrorMessage(42)).toBe("Ocorreu um erro inesperado.");
    expect(getErrorMessage({ code: "500" })).toBe("Ocorreu um erro inesperado.");
    expect(getErrorMessage({ message: 123 })).toBe("Ocorreu um erro inesperado.");
  });

  it("respeita o fallback customizado", () => {
    expect(getErrorMessage(null, "Falha ao salvar.")).toBe("Falha ao salvar.");
    expect(getErrorMessage(new Error("   "), "Falha ao salvar.")).toBe("Falha ao salvar.");
    expect(getErrorMessage("", "Falha ao salvar.")).toBe("Falha ao salvar.");
  });

  it("não confunde string vazia/espaços com mensagem válida", () => {
    expect(getErrorMessage("   ")).toBe("Ocorreu um erro inesperado.");
    expect(getErrorMessage({ message: "  " })).toBe("Ocorreu um erro inesperado.");
  });
});
