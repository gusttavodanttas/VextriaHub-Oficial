import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type ChartsPeriod = 6 | 12;

interface MonthBucket { key: string; label: string; }

function lastMonths(n: number): MonthBucket[] {
  const out: MonthBucket[] = [];
  const now = new Date();
  const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: meses[d.getMonth()] });
  }
  return out;
}

const monthKey = (iso: string | null | undefined) => (iso ? iso.slice(0, 7) : "");

export interface ChartsData {
  loading: boolean;
  totals: { processos: number; clientes: number; atendimentos: number; receita: number; despesa: number };
  processosPorMes: { mes: string; novos: number; encerrados: number }[];
  statusProcessos: { name: string; value: number; fill: string }[];
  clientesPorTipo: { name: string; value: number; fill: string }[];
  novosClientesPorMes: { mes: string; novos: number }[];
  atendimentosPorMes: { mes: string; total: number }[];
  financeiroPorMes: { mes: string; receita: number; despesa: number }[];
  honorariosPorCategoria: { name: string; value: number; fill: string }[];
  isEmpty: boolean;
}

const PALETTE = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#8b5cf6", "#f97316"];
const STATUS_LABEL: Record<string, string> = {
  ativo: "Em andamento", encerrado: "Encerrados", suspenso: "Suspensos",
  arquivado: "Arquivados", pendente: "Pendentes",
};

export function useChartsData(period: ChartsPeriod = 6): ChartsData {
  const { user } = useAuth();
  const [data, setData] = useState<ChartsData>({
    loading: true,
    totals: { processos: 0, clientes: 0, atendimentos: 0, receita: 0, despesa: 0 },
    processosPorMes: [], statusProcessos: [], clientesPorTipo: [],
    novosClientesPorMes: [], atendimentosPorMes: [], financeiroPorMes: [],
    honorariosPorCategoria: [], isEmpty: true,
  });

  useEffect(() => {
    if (!user?.office_id) return;
    let cancel = false;
    (async () => {
      const officeId = user.office_id;
      const months = lastMonths(period);
      const since = `${months[0].key}-01T00:00:00`;

      const [proc, cli, at, fin] = await Promise.all([
        supabase.from("processos").select("status, tipo_processo, created_at, updated_at")
          .eq("office_id", officeId).eq("deletado", false),
        supabase.from("clientes").select("tipo_pessoa, status, created_at")
          .eq("office_id", officeId).eq("deletado", false).eq("deletado_pendente", false),
        supabase.from("atendimentos").select("created_at")
          .eq("office_id", officeId).eq("deletado", false).gte("created_at", since),
        supabase.from("financeiro").select("tipo, valor, categoria, created_at")
          .eq("office_id", officeId).eq("deletado", false).gte("created_at", since),
      ]);

      if (cancel) return;

      const procRows = proc.data || [];
      const cliRows = cli.data || [];
      const atRows = at.data || [];
      const finRows = fin.data || [];

      // Processos por mês (novos x encerrados)
      const novosMap: Record<string, number> = {};
      const encMap: Record<string, number> = {};
      procRows.forEach((p: any) => {
        const mk = monthKey(p.created_at);
        novosMap[mk] = (novosMap[mk] || 0) + 1;
        if (p.status === "encerrado") {
          const ek = monthKey(p.updated_at || p.created_at);
          encMap[ek] = (encMap[ek] || 0) + 1;
        }
      });
      const processosPorMes = months.map(m => ({ mes: m.label, novos: novosMap[m.key] || 0, encerrados: encMap[m.key] || 0 }));

      // Status dos processos
      const statusCount: Record<string, number> = {};
      procRows.forEach((p: any) => { const s = p.status || "ativo"; statusCount[s] = (statusCount[s] || 0) + 1; });
      const statusProcessos = Object.entries(statusCount).map(([k, v], i) => ({
        name: STATUS_LABEL[k] || k, value: v, fill: PALETTE[i % PALETTE.length],
      }));

      // Clientes por tipo
      const tipoCount: Record<string, number> = {};
      cliRows.forEach((c: any) => { const t = c.tipo_pessoa || "fisica"; tipoCount[t] = (tipoCount[t] || 0) + 1; });
      const clientesPorTipo = [
        { name: "Pessoa Física", value: tipoCount["fisica"] || 0, fill: PALETTE[0] },
        { name: "Pessoa Jurídica", value: tipoCount["juridica"] || 0, fill: PALETTE[1] },
      ].filter(x => x.value > 0);

      // Novos clientes por mês
      const cliMap: Record<string, number> = {};
      cliRows.forEach((c: any) => { const mk = monthKey(c.created_at); cliMap[mk] = (cliMap[mk] || 0) + 1; });
      const novosClientesPorMes = months.map(m => ({ mes: m.label, novos: cliMap[m.key] || 0 }));

      // Atendimentos por mês
      const atMap: Record<string, number> = {};
      atRows.forEach((a: any) => { const mk = monthKey(a.created_at); atMap[mk] = (atMap[mk] || 0) + 1; });
      const atendimentosPorMes = months.map(m => ({ mes: m.label, total: atMap[m.key] || 0 }));

      // Financeiro por mês
      const recMap: Record<string, number> = {};
      const desMap: Record<string, number> = {};
      const catMap: Record<string, number> = {};
      let totReceita = 0, totDespesa = 0;
      finRows.forEach((f: any) => {
        const mk = monthKey(f.created_at);
        const v = Number(f.valor) || 0;
        if (f.tipo === "receita") {
          recMap[mk] = (recMap[mk] || 0) + v; totReceita += v;
          const cat = f.categoria || "Outros";
          catMap[cat] = (catMap[cat] || 0) + v;
        } else {
          desMap[mk] = (desMap[mk] || 0) + v; totDespesa += v;
        }
      });
      const financeiroPorMes = months.map(m => ({ mes: m.label, receita: recMap[m.key] || 0, despesa: desMap[m.key] || 0 }));
      const honorariosPorCategoria = Object.entries(catMap)
        .sort((a, b) => b[1] - a[1]).slice(0, 6)
        .map(([k, v], i) => ({ name: k, value: v, fill: PALETTE[i % PALETTE.length] }));

      const totals = {
        processos: procRows.filter((p: any) => p.status !== "encerrado").length,
        clientes: cliRows.filter((c: any) => ["ativo", "convertido"].includes(c.status)).length,
        atendimentos: atRows.length,
        receita: totReceita,
        despesa: totDespesa,
      };

      setData({
        loading: false, totals, processosPorMes, statusProcessos, clientesPorTipo,
        novosClientesPorMes, atendimentosPorMes, financeiroPorMes, honorariosPorCategoria,
        isEmpty: procRows.length === 0 && cliRows.length === 0 && atRows.length === 0 && finRows.length === 0,
      });
    })();
    return () => { cancel = true; };
  }, [user?.office_id, period]);

  return data;
}
