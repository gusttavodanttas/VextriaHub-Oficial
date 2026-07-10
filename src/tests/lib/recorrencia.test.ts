// Testes do encadeamento de recorrência (atendimentos/tarefas): ao concluir uma
// ocorrência, a próxima é gerada na data certa. O caso que mais importa é
// "dias úteis": concluir na sexta gera a próxima na segunda, pulando o fim de
// semana — e continueOccurrences NÃO repete a data base (senão duplicaria).
import { describe, it, expect } from "vitest";
import {
  generateOccurrences, continueOccurrences, recorrenciaLabel,
} from "@/lib/recorrencia";

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);
const ymd = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
const list = (xs: Date[]) => xs.map(ymd);

// 05/01/2026 = segunda-feira · 09/01/2026 = sexta-feira · 31/01/2026 = sábado
describe("generateOccurrences — inclui a data base", () => {
  it("diária: n dias consecutivos", () => {
    expect(list(generateOccurrences(d(2026, 1, 5), "diaria", 3))).toEqual(["2026-01-05", "2026-01-06", "2026-01-07"]);
  });
  it("semanal: passos de 7 dias", () => {
    expect(list(generateOccurrences(d(2026, 1, 5), "semanal", 3))).toEqual(["2026-01-05", "2026-01-12", "2026-01-19"]);
  });
  it("quinzenal: passos de 14 dias", () => {
    expect(list(generateOccurrences(d(2026, 1, 5), "quinzenal", 3))).toEqual(["2026-01-05", "2026-01-19", "2026-02-02"]);
  });
  it("mensal: mês a mês, com clamp de fim de mês", () => {
    expect(list(generateOccurrences(d(2026, 1, 31), "mensal", 3))).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
  });
  it("diasUteis: pula sábado e domingo", () => {
    // começa na sexta 09/01 → sex, seg, ter, qua, qui
    expect(list(generateOccurrences(d(2026, 1, 9), "diasUteis", 5))).toEqual([
      "2026-01-09", "2026-01-12", "2026-01-13", "2026-01-14", "2026-01-15",
    ]);
  });
});

describe("continueOccurrences — encadeamento após concluir (exclui a base)", () => {
  it("NÃO repete a data base (evita duplicar a ocorrência concluída)", () => {
    const base = d(2026, 1, 5);
    const next = continueOccurrences(base, "semanal", 1);
    expect(ymd(next[0])).not.toBe(ymd(base));
    expect(ymd(next[0])).toBe("2026-01-12");
  });
  it("diária: começa no dia seguinte", () => {
    expect(list(continueOccurrences(d(2026, 1, 5), "diaria", 2))).toEqual(["2026-01-06", "2026-01-07"]);
  });
  it("dias úteis: concluir na SEXTA gera a próxima na SEGUNDA (pula o fds)", () => {
    expect(list(continueOccurrences(d(2026, 1, 9), "diasUteis", 1))).toEqual(["2026-01-12"]);
    expect(list(continueOccurrences(d(2026, 1, 9), "diasUteis", 3))).toEqual(["2026-01-12", "2026-01-13", "2026-01-14"]);
  });
  it("mensal: próxima ocorrência é o mês seguinte (com clamp)", () => {
    expect(list(continueOccurrences(d(2026, 1, 31), "mensal", 2))).toEqual(["2026-02-28", "2026-03-31"]);
  });
  it("quinzenal: +14 dias a cada passo", () => {
    expect(list(continueOccurrences(d(2026, 1, 5), "quinzenal", 2))).toEqual(["2026-01-19", "2026-02-02"]);
  });
  it("gera exatamente `count` ocorrências", () => {
    expect(continueOccurrences(d(2026, 1, 5), "diaria", 4)).toHaveLength(4);
  });
});

describe("recorrenciaLabel", () => {
  it("mapeia a regra para o rótulo em português", () => {
    expect(recorrenciaLabel("diasUteis")).toBe("Dias úteis (seg–sex)");
    expect(recorrenciaLabel("mensal")).toBe("Mensal");
    expect(recorrenciaLabel("nenhuma")).toBe("Não repetir");
  });
  it("valor desconhecido cai no rótulo padrão", () => {
    expect(recorrenciaLabel(undefined)).toBe("Recorrência");
    expect(recorrenciaLabel("xpto")).toBe("Recorrência");
  });
});
