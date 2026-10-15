// Cálculos puros da página Financeiro (extraídos de pages/Financeiro.tsx —
// código idêntico, só saiu de dentro dos useMemo/handlers para ser testável).
import { format, parseISO, isAfter, isBefore } from "date-fns";
import {
  fmt, statusConfig, escopoConfig, findPrioridadeGrupo, valorPago, saldoRestante,
  type FinanceiroItem, type PrioridadeGrupo,
} from "./shared";

export interface FinanceiroStatsValores { receitaMes: number; aReceber: number; aPagar: number; saldo: number }

const noMes = (data: string, mesStart: Date, mesEnd: Date) =>
  !isBefore(parseISO(data), mesStart) && !isAfter(parseISO(data), mesEnd);

const emAberto = (i: FinanceiroItem) => i.status === "pendente" || i.status === "vencido" || i.status === "parcial";

export function calcularStats(items: FinanceiroItem[], mesStart: Date, mesEnd: Date): FinanceiroStatsValores {
  const receitaMes = items
    .filter((i) => i.tipo === "receita" && i.status !== "cancelado" && noMes(i.data_vencimento, mesStart, mesEnd))
    .reduce((acc, i) => acc + i.valor, 0);

  // "A receber"/"A pagar" contam o saldo ainda em aberto DO MÊS em visualização
  // (não o total histórico) — para um lançamento "parcial" isso é o restante,
  // não o valor total original.
  const aReceber = items
    .filter((i) => i.tipo === "receita" && emAberto(i) && noMes(i.data_vencimento, mesStart, mesEnd))
    .reduce((acc, i) => acc + saldoRestante(i), 0);

  const aPagar = items
    .filter((i) => i.tipo === "despesa" && emAberto(i) && noMes(i.data_vencimento, mesStart, mesEnd))
    .reduce((acc, i) => acc + saldoRestante(i), 0);

  // Movimentação de caixa do mês: valor efetivamente pago/recebido (não o valor
  // total do lançamento) — pra "pago" isso já é o valor cheio.
  const saldo = items
    .filter((i) => (i.status === "pago" || i.status === "parcial") && i.data_pagamento && noMes(i.data_pagamento, mesStart, mesEnd))
    .reduce((acc, i) => acc + (i.tipo === "receita" ? valorPago(i) : -valorPago(i)), 0);

  return { receitaMes, aReceber, aPagar, saldo };
}

export interface Mixing { index: number; pf: number; total: number }

// Índice de mistura patrimonial: % das despesas (não canceladas) que são
// pessoais (PF) — sinal de risco fiscal quando o caixa do escritório está
// sendo usado pra pagar contas do titular (desconsideração da personalidade jurídica).
export function calcularMixing(items: FinanceiroItem[]): Mixing {
  const despesas = items.filter((i) => i.tipo === "despesa" && i.status !== "cancelado");
  const total = despesas.reduce((acc, i) => acc + i.valor, 0);
  const pf = despesas.filter((i) => i.escopo === "pf").reduce((acc, i) => acc + i.valor, 0);
  const index = total > 0 ? (pf / total) * 100 : 0;
  return { index, pf, total };
}

export function mixingStatusFor(index: number) {
  if (index === 0) return { label: "Excelente", className: "text-emerald-600 bg-emerald-500/10 border-emerald-500/30", barClass: "bg-emerald-500", text: "Nenhuma despesa pessoal registrada no caixa do escritório." };
  if (index < 10) return { label: "Sob Controle", className: "text-amber-600 bg-amber-500/10 border-amber-500/30", barClass: "bg-amber-400", text: "Baixo nível de mistura. Priorize pagar contas pessoais fora do caixa PJ." };
  if (index < 20) return { label: "Alerta", className: "text-orange-600 bg-orange-500/10 border-orange-500/30", barClass: "bg-orange-500", text: "Risco fiscal moderado — despesas pessoais estão poluindo o caixa do escritório." };
  return { label: "Risco Alto", className: "text-red-600 bg-red-500/10 border-red-500/30", barClass: "bg-red-500", text: "Confusão patrimonial relevante. Alto volume de despesas pessoais pagas pelo escritório." };
}

// Priorização: despesas ainda em aberto (pendente/vencida/parcial), agrupadas
// pelos grupos de prioridade configurados pelo escritório — ajuda a decidir o
// que pagar primeiro quando o caixa aperta.
export const SEM_CLASSIFICACAO = "sem_classificacao";

export function agruparPendentesPorGrupo(pendentes: FinanceiroItem[], grupos: PrioridadeGrupo[]) {
  const buckets: Record<string, FinanceiroItem[]> = { [SEM_CLASSIFICACAO]: [] };
  grupos.forEach((g) => { buckets[g.id] = []; });
  pendentes.forEach((i) => {
    const bucket = i.prioridade && buckets[i.prioridade] ? i.prioridade : SEM_CLASSIFICACAO;
    buckets[bucket].push(i);
  });
  return buckets;
}

// Soma o saldo em aberto (não o valor total) — relevante pra contas parciais.
export const somaGrupo = (arr: FinanceiroItem[]) => arr.reduce((acc, i) => acc + saldoRestante(i), 0);

// CSV dos lançamentos informados (a página passa os visíveis, respeitando os
// filtros ativos). `descricao` é obrigatório no schema — toda linha tem descrição.
export function gerarCsvFinanceiro(itens: FinanceiroItem[], grupos: PrioridadeGrupo[]): string {
  const header = ["Tipo", "Descrição", "Categoria", "Valor", "Valor Pago", "Saldo", "Vencimento", "Pagamento", "Status", "Escopo", "Prioridade", "Cliente"];
  const linhas = itens.map((i) => [
    i.tipo === "receita" ? "Receita" : "Despesa",
    i.descricao,
    i.categoria ?? "",
    fmt(i.valor),
    fmt(valorPago(i)),
    fmt(saldoRestante(i)),
    format(parseISO(i.data_vencimento), "dd/MM/yyyy"),
    i.data_pagamento ? format(parseISO(i.data_pagamento), "dd/MM/yyyy") : "",
    statusConfig[i.status].label,
    escopoConfig[i.escopo].label,
    findPrioridadeGrupo(grupos, i.prioridade)?.label ?? "",
    i.clientes?.nome ?? "",
  ]);
  return [header, ...linhas]
    .map((r) => r.map((f) => `"${String(f ?? "").replace(/"/g, '""')}"`).join(";"))
    .join("\n");
}

export function baixarCsvFinanceiro(itens: FinanceiroItem[], grupos: PrioridadeGrupo[]) {
  const csv = gerarCsvFinanceiro(itens, grupos);
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `financeiro_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
