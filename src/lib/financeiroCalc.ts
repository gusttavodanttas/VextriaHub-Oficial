// Geração das linhas de lançamento parcelado/recorrente do Financeiro —
// lógica pura extraída do FinanceiroFormDialog para poder ser testada.
// É dinheiro do cliente: a regra-chave é que a soma das parcelas fecha
// EXATAMENTE com o valor total (a última parcela absorve o arredondamento).
import { addMonths, addWeeks, format, parseISO } from "date-fns";

export interface ParcelaRow {
  valor: number;
  data_vencimento: string;
  parcela_numero: number;
  parcela_total: number;
}

/** Divide `valorTotal` em `n` parcelas mensais a partir de `dataBaseISO`.
 *  Cada parcela = total/n arredondado a 2 casas; a ÚLTIMA recebe o resto,
 *  garantindo que a soma bate com o total (sem centavo perdido). */
export function parcelasRows(valorTotal: number, n: number, dataBaseISO: string): ParcelaRow[] {
  const dataBase = parseISO(dataBaseISO);
  const valorParcela = Math.round((valorTotal / n) * 100) / 100;
  return Array.from({ length: n }, (_, i) => ({
    valor: i === n - 1 ? Math.round((valorTotal - valorParcela * (n - 1)) * 100) / 100 : valorParcela,
    data_vencimento: format(addMonths(dataBase, i), "yyyy-MM-dd"),
    parcela_numero: i + 1,
    parcela_total: n,
  }));
}

export type RecorrenciaFreq = "semanal" | "quinzenal" | "mensal";

export interface RecorrenciaRow {
  valor: number;
  data_vencimento: string;
}

/** Gera `count` lançamentos recorrentes de mesmo valor, espaçados pela
 *  frequência (semanal / quinzenal / mensal) a partir de `dataBaseISO`. */
export function recorrenciaRows(
  valorTotal: number, count: number, dataBaseISO: string, freq: RecorrenciaFreq,
): RecorrenciaRow[] {
  const dataBase = parseISO(dataBaseISO);
  return Array.from({ length: count }, (_, i) => {
    const data = freq === "semanal"
      ? addWeeks(dataBase, i)
      : freq === "quinzenal"
      ? addWeeks(dataBase, i * 2)
      : addMonths(dataBase, i);
    return { valor: valorTotal, data_vencimento: format(data, "yyyy-MM-dd") };
  });
}
