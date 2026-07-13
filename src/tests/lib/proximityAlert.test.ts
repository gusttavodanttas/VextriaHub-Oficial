// Testes do aviso de proximidade — a lógica que garante que o advogado seja
// avisado ANTES do prazo vencer. Um erro aqui = prazo perdido em silêncio.
// "hoje" é fixado via um segundo argumento para os testes não dependerem da data real.
import { describe, it, expect } from "vitest";
import { diasAte, proxLabel, marcosDe, deveAvisar, dataFatalPrazo } from "@/lib/proximityAlert";

const HOJE = new Date(2026, 5, 10); // 10/06/2026, meio do mês (sem borda de fuso)

describe("diasAte", () => {
  it("conta dias de calendário, com data-only sem erro de fuso", () => {
    expect(diasAte("2026-06-10", HOJE)).toBe(0);   // hoje
    expect(diasAte("2026-06-11", HOJE)).toBe(1);   // amanhã
    expect(diasAte("2026-06-17", HOJE)).toBe(7);
    expect(diasAte("2026-06-09", HOJE)).toBe(-1);  // ontem (passado)
  });
  it("aceita datetime ISO", () => {
    expect(diasAte("2026-06-13T09:30:00", HOJE)).toBe(3);
  });
});

describe("proxLabel", () => {
  it("hoje / amanhã / em N dias", () => {
    expect(proxLabel("2026-06-10", HOJE)).toBe("hoje");
    expect(proxLabel("2026-06-11", HOJE)).toBe("amanhã");
    expect(proxLabel("2026-06-15", HOJE)).toBe("em 5 dias");
  });
  it("prazo já vencido também cai em 'hoje' (diff <= 0)", () => {
    expect(proxLabel("2026-06-08", HOJE)).toBe("hoje");
  });
});

describe("marcosDe — antecedência por item", () => {
  it("usa o array avisos_dias, filtrando os <= 0", () => {
    expect(marcosDe({ avisos_dias: [1, 3, 7] }, 3)).toEqual([1, 3, 7]);
    expect(marcosDe({ avisos_dias: [0, 5] }, 3)).toEqual([5]);
  });
  it("array vazio = não avisar (usuário optou por silenciar)", () => {
    expect(marcosDe({ avisos_dias: [] }, 3)).toEqual([]);
  });
  it("cai no legado aviso_dias quando não há array", () => {
    expect(marcosDe({ aviso_dias: 5 }, 3)).toEqual([5]);
    expect(marcosDe({ aviso_dias: 0 }, 3)).toEqual([]); // 0 = não avisar
  });
  it("sem nada configurado, usa o padrão global", () => {
    expect(marcosDe({}, 3)).toEqual([3]);
    expect(marcosDe({ avisos_dias: null, aviso_dias: null }, 7)).toEqual([7]);
  });
});

describe("deveAvisar — janela de disparo", () => {
  it("dispara de hoje (0) até o marco, inclusive", () => {
    expect(deveAvisar(0, 3)).toBe(true);  // vence hoje
    expect(deveAvisar(3, 3)).toBe(true);  // entrou na antecedência
    expect(deveAvisar(2, 3)).toBe(true);
  });
  it("não dispara antes de entrar na janela nem depois de vencer", () => {
    expect(deveAvisar(4, 3)).toBe(false); // ainda longe
    expect(deveAvisar(-1, 3)).toBe(false); // já venceu
  });
});

describe("dataFatalPrazo — o bug do prazo legado", () => {
  it("prefere data_fim_prazo (padrão atual)", () => {
    expect(dataFatalPrazo({ data_fim_prazo: "2026-06-20", data_vencimento: "2026-06-15" })).toBe("2026-06-20");
  });
  it("cai no data_vencimento quando o novo está vazio (prazo legado)", () => {
    expect(dataFatalPrazo({ data_fim_prazo: null, data_vencimento: "2026-06-15" })).toBe("2026-06-15");
    expect(dataFatalPrazo({ data_vencimento: "2026-06-15" })).toBe("2026-06-15");
  });
  it("sem nenhuma data, retorna null (não gera aviso quebrado)", () => {
    expect(dataFatalPrazo({ data_fim_prazo: null, data_vencimento: null })).toBeNull();
    expect(dataFatalPrazo({})).toBeNull();
  });
});
