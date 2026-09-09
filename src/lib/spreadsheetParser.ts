// Parser de planilha (Excel/CSV) pra importação de lançamentos financeiros.
// XLSX via `read-excel-file/universal` (biblioteca focada em leitura, sem as
// vulnerabilidades de prototype-pollution/ReDoS do pacote `xlsx` no npm).
// CSV via parser próprio — formato simples o bastante pra não precisar de
// dependência, e evita puxar mais uma lib só pra isso.
import { readSheet } from "read-excel-file/universal";

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

// Lê um arquivo .csv, .xlsx ou .xls e devolve as linhas como strings
// (sem interpretar significado — a classificação por IA acontece depois).
export async function parseSpreadsheetFile(file: File): Promise<string[][]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) {
    const text = await file.text();
    return parseCsv(text);
  }
  const data = await readSheet(file);
  return data.map((row) => row.map(cellToString));
}

// Remove linhas totalmente vazias (comuns no fim de planilhas exportadas).
export function stripEmptyRows(rows: string[][]): string[][] {
  return rows.filter((row) => row.some((cell) => cell.trim() !== ""));
}
