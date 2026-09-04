import { describe, it, expect } from "vitest";
import { estaAtrasado, diasDeAtraso, atrasoLabel, dataFatalDoItem } from "@/lib/atraso";

// Referência fixa: 10/09/2026, meio-dia local (não 00:00 — evita que o teste
// dependa do fuso da máquina que roda a CI).
const HOJE = new Date("2026-09-10T12:00:00");

describe("estaAtrasado", () => {
  it("data de ontem está atrasada", () => {
    expect(estaAtrasado("2026-09-09", HOJE)).toBe(true);
  });

  it("hoje NÃO está atrasado — ainda dá tempo de cumprir", () => {
    expect(estaAtrasado("2026-09-10", HOJE)).toBe(false);
  });

  it("data futura não está atrasada", () => {
    expect(estaAtrasado("2026-09-11", HOJE)).toBe(false);
  });

  it("timestamp completo de ontem está atrasado", () => {
    expect(estaAtrasado("2026-09-09T15:30:00-03:00", HOJE)).toBe(true);
  });

  it("vazio, nulo e lixo nunca contam como atraso", () => {
    expect(estaAtrasado(undefined, HOJE)).toBe(false);
    expect(estaAtrasado(null, HOJE)).toBe(false);
    expect(estaAtrasado("", HOJE)).toBe(false);
    expect(estaAtrasado("não é data", HOJE)).toBe(false);
  });

  // As colunas de data do sistema (data_vencimento, data_fim_prazo, prazo) são
  // DATE — "YYYY-MM-DD" sem hora. Ancoradas ao meio-dia LOCAL elas não escorregam
  // de dia em nenhum fuso; era esse o bug do -1 dia. Este teste roda igual em
  // qualquer máquina, ao contrário de uma asserção com offset fixo.
  it("data-only não escorrega de dia, qualquer que seja o fuso da máquina", () => {
    const meiaNoite = new Date("2026-09-10T00:00:00");
    const quaseMeiaNoite = new Date("2026-09-10T23:59:00");
    for (const agora of [meiaNoite, quaseMeiaNoite]) {
      expect(estaAtrasado("2026-09-09", agora)).toBe(true);
      expect(estaAtrasado("2026-09-10", agora)).toBe(false);
      expect(estaAtrasado("2026-09-11", agora)).toBe(false);
    }
  });
});

describe("diasDeAtraso", () => {
  it("conta os dias de calendário desde o vencimento", () => {
    expect(diasDeAtraso("2026-09-09", HOJE)).toBe(1);
    expect(diasDeAtraso("2026-09-05", HOJE)).toBe(5);
    expect(diasDeAtraso("2026-08-11", HOJE)).toBe(30);
  });

  it("devolve 0 para item em dia", () => {
    expect(diasDeAtraso("2026-09-10", HOJE)).toBe(0);
    expect(diasDeAtraso("2026-12-01", HOJE)).toBe(0);
    expect(diasDeAtraso(null, HOJE)).toBe(0);
  });
});

describe("atrasoLabel", () => {
  it("usa singular para um dia", () => {
    expect(atrasoLabel("2026-09-09", HOJE)).toBe("venceu ontem");
  });

  it("usa plural a partir de dois dias", () => {
    expect(atrasoLabel("2026-09-08", HOJE)).toBe("venceu há 2 dias");
    expect(atrasoLabel("2026-08-11", HOJE)).toBe("venceu há 30 dias");
  });

  it("fica vazio quando o item está em dia", () => {
    expect(atrasoLabel("2026-09-10", HOJE)).toBe("");
    expect(atrasoLabel("2026-09-30", HOJE)).toBe("");
  });
});

describe("dataFatalDoItem", () => {
  it("prefere data_fim_prazo à data_vencimento", () => {
    expect(dataFatalDoItem({ data_fim_prazo: "2026-09-20", data_vencimento: "2026-09-15" })).toBe("2026-09-20");
  });

  it("cai na data_vencimento do prazo legado", () => {
    expect(dataFatalDoItem({ data_fim_prazo: null, data_vencimento: "2026-09-15" })).toBe("2026-09-15");
  });

  it("resolve audiência, atendimento e consultivo", () => {
    expect(dataFatalDoItem({ data_audiencia: "2026-09-15T14:00:00Z" })).toBe("2026-09-15T14:00:00Z");
    expect(dataFatalDoItem({ data_atendimento: "2026-09-15T14:00:00Z" })).toBe("2026-09-15T14:00:00Z");
    expect(dataFatalDoItem({ prazo: "2026-09-15" })).toBe("2026-09-15");
  });

  it("devolve null quando o item não tem data nenhuma", () => {
    expect(dataFatalDoItem({})).toBe(null);
  });
});
