// Parser de planilha (Excel/CSV) pra importação de lançamentos financeiros.
// XLSX via `read-excel-file/universal` (biblioteca focada em leitura, sem as
// vulnerabilidades de prototype-pollution/ReDoS do pacote `xlsx` no npm).
// CSV via parser próprio — formato simples o bastante pra não precisar de
// dependência, e evita puxar mais uma lib só pra isso.
//
// O export default do read-excel-file lê TODAS as abas do arquivo (cada uma
// com seu nome) — usamos isso pra deixar a IA analisar o arquivo inteiro, não
// só a primeira aba, o que importa muito pra planilhas com abas separadas
// tipo "Escritório" / "Pessoal".
import readXlsxFile from "read-excel-file/universal";

// Parser CSV com suporte a campos entre aspas (vírgula/quebra de linha dentro
// do campo, aspas escapadas como "").
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c === "\r") {
      // ignora — o \n seguinte fecha a linha
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function cellToString(cell: unknown): string {
  if (cell === null || cell === undefined) return "";
  if (cell instanceof Date) return cell.toISOString().slice(0, 10);
  return String(cell);
}

export interface ParsedSheet {
  aba: string;
  rows: string[][];
}

// Lê um arquivo .csv, .xlsx ou .xls e devolve TODAS as abas como strings
// (sem interpretar significado — a classificação por IA acontece depois).
// CSV não tem conceito de aba, então volta como uma aba única.
export async function parseSpreadsheetFile(file: File): Promise<ParsedSheet[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) {
    const text = await file.text();
    return [{ aba: file.name.replace(/\.csv$/i, "") || "Planilha", rows: parseCsv(text) }];
  }
  const sheets = await readXlsxFile(file);
  return sheets.map((s) => ({ aba: s.sheet, rows: s.data.map((row) => row.map(cellToString)) }));
}

// Remove linhas totalmente vazias (comuns no fim de planilhas exportadas).
export function stripEmptyRows(rows: string[][]): string[][] {
  return rows.filter((row) => row.some((cell) => cell.trim() !== ""));
}

export interface AbaCelulas {
  aba: string;
  celulas: string[];
}

// Achata as linhas de várias abas em uma lista única pra classificação por IA,
// carregando junto de qual aba cada linha veio — o nome da aba (ex.: "Pessoal"
// vs "Escritório") é um sinal forte pra IA diferenciar escopo PF/PJ. Corta no
// limite TOTAL combinado (não por aba), pois todas as linhas vão numa única
// chamada de IA.
export function combineSheets(sheets: ParsedSheet[], max: number): AbaCelulas[] {
  const combined: AbaCelulas[] = [];
  for (const sheet of sheets) {
    for (const row of sheet.rows) {
      if (combined.length >= max) return combined;
      combined.push({ aba: sheet.aba, celulas: row });
    }
  }
  return combined;
}
