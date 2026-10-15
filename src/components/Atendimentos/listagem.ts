// Regras puras da listagem de atendimentos (extraídas de pages/Atendimentos.tsx):
// stats, pendentes de baixa, filtro de período e agrupamento por janela temporal.
import { parseISO } from "date-fns";
import { ORDEM_GRUPOS, LABEL_GRUPOS, grupoDe, diasAteData, type Atendimento, type GrupoKey } from "./shared";

export interface ContagensServidor { total: number; realizados: number; cancelados: number }

// Stats: total/realizados/cancelados vêm do servidor (o histórico é paginado,
// contar só o carregado subestimaria); agendados é o conjunto ativo, inteiro.
// Até a contagem chegar (ou se ela falhar), cai no que está em memória.
export function calcularStats(items: Atendimento[], contagens: ContagensServidor | null | undefined) {
  return {
    total: contagens?.total ?? items.length,
    agendados: items.filter((i) => i.status === "agendado").length,
    realizados: contagens?.realizados ?? items.filter((i) => i.status === "realizado").length,
    cancelados: contagens?.cancelados ?? items.filter((i) => i.status === "cancelado").length,
  };
}

// Atendimentos passados ainda agendados/pendentes → precisam de baixa
export function pendentesDeBaixa(items: Atendimento[], agora = Date.now()) {
  return items
    .filter((i) => (i.status === "agendado" || i.status === "pendente") && parseISO(i.data_atendimento).getTime() < agora)
    .sort((a, b) => parseISO(a.data_atendimento).getTime() - parseISO(b.data_atendimento).getTime());
}

// Período só se aplica à lista (a visão semanal navega pelas datas)
export function matchPeriodo(item: Atendimento, filtroPeriodo: string) {
  if (filtroPeriodo === "todos") return true;
  const d = diasAteData(parseISO(item.data_atendimento));
  if (filtroPeriodo === "hoje") return d === 0;
  if (filtroPeriodo === "7dias") return d >= 0 && d <= 7;
  if (filtroPeriodo === "futuros") return d > 0;
  if (filtroPeriodo === "passados") return d < 0;
  if (filtroPeriodo === "mes") {
    const dt = parseISO(item.data_atendimento); const n = new Date();
    return dt.getMonth() === n.getMonth() && dt.getFullYear() === n.getFullYear();
  }
  return true;
}

// Agrupa os cards por janela temporal (Hoje · Esta semana · Próximos · Passados)
export function agruparPorJanela(filtered: Atendimento[]) {
  const map: Record<GrupoKey, Atendimento[]> = { hoje: [], semana: [], futuros: [], passados: [] };
  filtered.forEach((it) => map[grupoDe(it)].push(it));
  const ts = (i: Atendimento) => parseISO(i.data_atendimento).getTime();
  map.hoje.sort((a, b) => ts(a) - ts(b));
  map.semana.sort((a, b) => ts(a) - ts(b));
  map.futuros.sort((a, b) => ts(a) - ts(b));
  map.passados.sort((a, b) => ts(b) - ts(a));
  return ORDEM_GRUPOS.map((k) => ({ key: k, label: LABEL_GRUPOS[k], items: map[k] })).filter((g) => g.items.length);
}
