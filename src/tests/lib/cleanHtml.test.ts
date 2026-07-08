import { describe, it, expect } from "vitest";
import { deepCleanHTML } from "@/lib/cleanHtml";

describe("deepCleanHTML (teor de publicações/prazos)", () => {
  it("remove tags e preserva o texto", () => {
    expect(deepCleanHTML("<b>Intimação</b> do <i>réu</i>")).toBe("Intimação do réu");
  });
  it("converte <br> e blocos em quebras de linha", () => {
    expect(deepCleanHTML("linha1<br>linha2")).toBe("linha1\nlinha2");
    expect(deepCleanHTML("<p>a</p><p>b</p>")).toBe("a\nb");
  });
  it("decodifica entidades comuns do diário oficial", () => {
    expect(deepCleanHTML("5&ordm; dia &uacute;til, cita&ccedil;&atilde;o &amp; prazo")).toBe("5º dia útil, citação & prazo");
    expect(deepCleanHTML("a&nbsp;b &lt;x&gt;")).toBe("a b <x>");
  });
  it("descarta script/style inteiros", () => {
    expect(deepCleanHTML("antes<script>alert(1)</script>depois")).toBe("antesdepois");
    expect(deepCleanHTML("a<style>.x{color:red}</style>b")).toBe("ab");
  });
  it("colapsa linhas vazias em excesso e apara espaços", () => {
    expect(deepCleanHTML("  a  <br><br><br><br>  b  ")).toBe("a\n\nb");
  });
  it("entrada vazia/nula vira string vazia", () => {
    expect(deepCleanHTML("")).toBe("");
    // @ts-expect-error — comportamento defensivo com null
    expect(deepCleanHTML(null)).toBe("");
  });
});
