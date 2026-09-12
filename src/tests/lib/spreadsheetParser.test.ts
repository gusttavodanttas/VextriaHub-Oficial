import { describe, it, expect } from "vitest";
import { parseCsv, stripEmptyRows, combineSheets, type ParsedSheet } from "@/lib/spreadsheetParser";

describe("parseCsv", () => {
  it("separa linhas e colunas simples", () => {
    const csv = "data,descricao,valor\n2026-01-05,Honorários,1500\n2026-01-10,Aluguel,-800";
    expect(parseCsv(csv)).toEqual([
      ["data", "descricao", "valor"],
      ["2026-01-05", "Honorários", "1500"],
      ["2026-01-10", "Aluguel", "-800"],
    ]);
  });

  it("respeita campos entre aspas com vírgula interna", () => {
    const csv = 'a,b\n"Silva, João",100';
    expect(parseCsv(csv)).toEqual([
      ["a", "b"],
      ["Silva, João", "100"],
    ]);
  });

  it("decodifica aspas escapadas como duas aspas", () => {
    const csv = 'a\n"ele disse ""oi"""';
    expect(parseCsv(csv)).toEqual([["a"], ['ele disse "oi"']]);
  });

  it("ignora \\r antes de \\n (CRLF)", () => {
    const csv = "a,b\r\n1,2\r\n";
    expect(parseCsv(csv)).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("suporta campo entre aspas contendo quebra de linha", () => {
    const csv = 'a\n"linha1\nlinha2"';
    expect(parseCsv(csv)).toEqual([["a"], ["linha1\nlinha2"]]);
  });

  it("string vazia não produz linhas", () => {
    expect(parseCsv("")).toEqual([]);
  });
});

describe("stripEmptyRows", () => {
  it("remove linhas onde todas as células são vazias/espaço", () => {
    const rows = [
      ["a", "b"],
      ["", ""],
      ["  ", ""],
      ["1", "2"],
    ];
    expect(stripEmptyRows(rows)).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("mantém linha com pelo menos uma célula não-vazia", () => {
    expect(stripEmptyRows([["", "x", ""]])).toEqual([["", "x", ""]]);
  });
});

describe("combineSheets", () => {
  it("achata linhas de várias abas em ordem, marcando a aba de origem", () => {
    const sheets: ParsedSheet[] = [
      { aba: "Escritório", rows: [["Honorários", "1500"], ["Aluguel", "800"]] },
      { aba: "Pessoal", rows: [["Mercado", "300"]] },
    ];
    expect(combineSheets(sheets, 150)).toEqual([
      { aba: "Escritório", celulas: ["Honorários", "1500"] },
      { aba: "Escritório", celulas: ["Aluguel", "800"] },
      { aba: "Pessoal", celulas: ["Mercado", "300"] },
    ]);
  });

  it("corta no limite TOTAL combinado, mesmo no meio de uma aba", () => {
    const sheets: ParsedSheet[] = [
      { aba: "A", rows: [["1"], ["2"], ["3"]] },
      { aba: "B", rows: [["4"], ["5"]] },
    ];
    const result = combineSheets(sheets, 4);
    expect(result).toEqual([
      { aba: "A", celulas: ["1"] },
      { aba: "A", celulas: ["2"] },
      { aba: "A", celulas: ["3"] },
      { aba: "B", celulas: ["4"] },
    ]);
  });

  it("lista vazia de abas resulta em lista vazia", () => {
    expect(combineSheets([], 150)).toEqual([]);
  });
});
