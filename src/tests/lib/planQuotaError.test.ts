import { describe, it, expect } from "vitest";
import { planQuotaMessage } from "@/lib/planQuotaError";

describe("planQuotaMessage", () => {
  it("reconhece a mensagem do trigger enforce_plan_quota", () => {
    const err = new Error("Limite do plano atingido (30 de 30 processos). Faça upgrade para adicionar mais.");
    const r = planQuotaMessage(err);
    expect(r).not.toBeNull();
    expect(r!.title).toBe("Limite do plano atingido");
    expect(r!.description).toContain("30 processos");
    expect(r!.description).toContain("30 já cadastrados");
  });

  it("traduz cada chave pro rótulo em português", () => {
    for (const [chave, rotulo] of [
      ["clientes", "clientes"],
      ["tarefas", "tarefas"],
      ["prazos", "prazos"],
    ] as const) {
      const err = new Error(`Limite do plano atingido (5 de 5 ${chave}). Faça upgrade para adicionar mais.`);
      expect(planQuotaMessage(err)!.description).toContain(rotulo);
    }
  });

  it("devolve null para qualquer outro erro — o chamador cai no fallback genérico", () => {
    expect(planQuotaMessage(new Error("network error"))).toBeNull();
    expect(planQuotaMessage(new Error("duplicate key value"))).toBeNull();
    expect(planQuotaMessage(null)).toBeNull();
    expect(planQuotaMessage(undefined)).toBeNull();
  });

  it("aceita erro como string crua (ex.: e.message de um objeto não-Error)", () => {
    const r = planQuotaMessage("Limite do plano atingido (100 de 100 tarefas). Faça upgrade para adicionar mais.");
    expect(r).not.toBeNull();
  });
});
