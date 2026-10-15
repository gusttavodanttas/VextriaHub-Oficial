// KPIs do topo do CRM (extraídos de pages/Crm.tsx). Os convertidos vêm
// paginados: taxa de conversão e valor ganho usam o resumo do servidor (todos
// os convertidos), não só a página carregada.
import type { ClienteComProcessos } from "@/types/database";

export const TEMPERATURAS = [
  { v: "lead", label: "Novo" },
  { v: "frio", label: "Frio" },
  { v: "morno", label: "Morno" },
  { v: "quente", label: "Quente" },
  { v: "convertido", label: "Convertido" },
];

export interface ResumoConvertidos { total: number; valorGanho: number }

export function calcularKpisCrm(leads: ClienteComProcessos[], convertidos: ClienteComProcessos[], resumo: ResumoConvertidos | null) {
  const convertedClients = convertidos;
  const totalConvertidos = resumo?.total ?? convertedClients.length;
  const hotLeadsCount = leads.filter(l => l.status === "quente").length;
  const crmTotal = leads.length + totalConvertidos;
  const conversionRate = crmTotal > 0 ? Math.round((totalConvertidos / crmTotal) * 100) : 0;
  const val = (c: ClienteComProcessos) => Number(c.valor_estimado) || 0;
  const pipelineValue = leads.reduce((s, l) => s + val(l), 0);
  const valorGanho = resumo?.valorGanho ?? convertedClients.reduce((s, c) => s + val(c), 0);
  return { convertedClients, hotLeadsCount, conversionRate, pipelineValue, valorGanho, totalConvertidos };
}
