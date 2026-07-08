import { describe, it, expect } from "vitest";
import {
  normalizeAudienciaStatus,
  normalizeAtendimentoStatus,
  AUDIENCIA_STATUS,
  ATENDIMENTO_STATUS,
} from "@/lib/status";

describe("normalizeAudienciaStatus (padrão feminino)", () => {
  it("mantém valores canônicos", () => {
    for (const s of AUDIENCIA_STATUS) expect(normalizeAudienciaStatus(s)).toBe(s);
  });
  it("converte variações masculinas antigas", () => {
    expect(normalizeAudienciaStatus("agendado")).toBe("agendada");
    expect(normalizeAudienciaStatus("confirmado")).toBe("confirmada");
    expect(normalizeAudienciaStatus("realizado")).toBe("realizada");
    expect(normalizeAudienciaStatus("cancelado")).toBe("cancelada");
  });
  it("tolera caixa e espaços", () => {
    expect(normalizeAudienciaStatus("  AGENDADO ")).toBe("agendada");
    expect(normalizeAudienciaStatus("Realizada")).toBe("realizada");
  });
  it("cai no padrão para vazio/desconhecido", () => {
    expect(normalizeAudienciaStatus(null)).toBe("agendada");
    expect(normalizeAudienciaStatus(undefined)).toBe("agendada");
    expect(normalizeAudienciaStatus("qualquer-coisa")).toBe("agendada");
  });
});

describe("normalizeAtendimentoStatus (padrão masculino)", () => {
  it("mantém valores canônicos", () => {
    for (const s of ATENDIMENTO_STATUS) expect(normalizeAtendimentoStatus(s)).toBe(s);
  });
  it("converte variações femininas antigas", () => {
    expect(normalizeAtendimentoStatus("agendada")).toBe("agendado");
    expect(normalizeAtendimentoStatus("realizada")).toBe("realizado");
    expect(normalizeAtendimentoStatus("cancelada")).toBe("cancelado");
  });
  it("mapeia 'confirmado(a)' (sem equivalente) para agendado", () => {
    expect(normalizeAtendimentoStatus("confirmado")).toBe("agendado");
    expect(normalizeAtendimentoStatus("confirmada")).toBe("agendado");
  });
  it("cai no padrão para vazio/desconhecido", () => {
    expect(normalizeAtendimentoStatus("")).toBe("agendado");
    expect(normalizeAtendimentoStatus("x")).toBe("agendado");
  });
});
