import { describe, it, expect } from "vitest";
import { parseLocalDate, fmtDate, fmtSafe, fmtDataBR, localYmd } from "@/lib/dates";

describe("parseLocalDate", () => {
  it("interpreta YYYY-MM-DD no fuso LOCAL (sem cair um dia em UTC-3)", () => {
    const d = parseLocalDate("2026-07-03")!;
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6); // julho
    expect(d.getDate()).toBe(3);  // o bug clássico devolvia 2
    expect(d.getHours()).toBe(12);
  });
  it("parseia timestamps ISO completos", () => {
    const d = parseLocalDate("2026-08-03T14:00:00.000Z")!;
    expect(d.getTime()).toBe(new Date("2026-08-03T14:00:00.000Z").getTime());
  });
  it("retorna null para vazio e inválido — nunca lança", () => {
    expect(parseLocalDate(null)).toBeNull();
    expect(parseLocalDate(undefined)).toBeNull();
    expect(parseLocalDate("")).toBeNull();
    expect(parseLocalDate("   ")).toBeNull();
    expect(parseLocalDate("não-é-data")).toBeNull();
  });
});

describe("fmtDate / fmtSafe", () => {
  it("formata datas válidas", () => {
    expect(fmtDate("2026-07-03", "dd/MM/yyyy")).toBe("03/07/2026");
    expect(fmtSafe("2026-07-03", "dd/MM/yy")).toBe("03/07/26");
  });
  it("nunca lança com data inválida (o crash que esvaziava formulários)", () => {
    expect(() => fmtDate("data-podre", "dd/MM/yyyy")).not.toThrow();
    expect(fmtDate("data-podre", "dd/MM/yyyy")).toBe("");
    expect(fmtDate(null, "dd/MM/yyyy", { fallback: "—" })).toBe("—");
    expect(fmtSafe(undefined, "HH:mm", "--:--")).toBe("--:--");
  });
});

describe("fmtDataBR", () => {
  it("dd/mm/aaaa pt-BR", () => {
    expect(fmtDataBR("2026-01-05")).toBe("05/01/2026");
  });
  it("vazio para inválido", () => {
    expect(fmtDataBR("x")).toBe("");
    expect(fmtDataBR(null)).toBe("");
  });
});

describe("localYmd", () => {
  it("YYYY-MM-DD do ponto de vista local, com zero à esquerda", () => {
    expect(localYmd(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
    expect(localYmd(new Date(2026, 11, 31, 0, 1))).toBe("2026-12-31");
  });
  it("faz roundtrip com parseLocalDate", () => {
    expect(localYmd(parseLocalDate("2026-07-03")!)).toBe("2026-07-03");
  });
});
