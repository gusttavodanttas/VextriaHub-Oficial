import { describe, it, expect } from "vitest";
import { parseCsv, stripEmptyRows } from "@/lib/spreadsheetParser";

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
