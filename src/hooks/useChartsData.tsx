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

export interface MemberBreakdown { name: string; processos: number; prazos: number; tarefas: number; audiencias: number; }

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
  porMembro: MemberBreakdown[];
  isEmpty: boolean;
}

const PALETTE = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#8b5cf6", "#f97316"];
const STATUS_LABEL: Record<string, string> = {
  ativo: "Em andamento", encerrado: "Encerrados", suspenso: "Suspensos",
  arquivado: "Arquivados", pendente: "Pendentes",
};

export function useChartsData(period: ChartsPeriod = 6, teamId: string | null = null): ChartsData {
  const { user } = useAuth();
  const [data, setData] = useState<ChartsData>({
    loading: true,
    totals: { processos: 0, clientes: 0, atendimentos: 0, receita: 0, despesa: 0 },
    processosPorMes: [], statusProcessos: [], clientesPorTipo: [],
    novosClientesPorMes: [], atendimentosPorMes: [], financeiroPorMes: [],
    honorariosPorCategoria: [], porMembro: [], isEmpty: true,
  });

  useEffect(() => {
    if (!user?.office_id) return;
    let cancel = false;
    (async () => {
      const officeId = user.office_id;
      const months = lastMonths(period);
      const since = `${months[0].key}-01T00:00:00`;

      // Se uma equipe foi selecionada, restringe aos membros dela
      let teamMemberIds: string[] | null = null;
      if (teamId) {
        const { data: tm } = await supabase.from("office_team_members").select("user_id").eq("team_id", teamId);
        teamMemberIds = (tm || []).map((m: any) => m.user_id);
        if (!teamMemberIds.length) teamMemberIds = ["00000000-0000-0000-0000-000000000000"];
      }
      const inMembers = (q: any, col: string) => (teamMemberIds ? q.in(col, teamMemberIds) : q);

      const [proc, prz, cli, at, fin] = await Promise.all([
        teamMemberIds
          ? supabase.from("processos").select("status, tipo_processo, created_at, updated_at, responsavel_id, user_id")
              .eq("office_id", officeId).eq("deletado", false).in("responsavel_id", teamMemberIds)
          : supabase.from("processos").select("status, tipo_processo, created_at, updated_at, responsavel_id, user_id")
              .eq("office_id", officeId).eq("deletado", false),
        inMembers(supabase.from("prazos").select("responsavel_id, data_fim_prazo, created_at")
          .eq("office_id", officeId), "responsavel_id"),
        supabase.from("clientes").select("tipo_pessoa, status, created_at")
          .eq("office_id", officeId).eq("deletado", false).eq("deletado_pendente", false),
        inMembers(supabase.from("atendimentos").select("created_at, responsavel_id, user_id")
          .eq("office_id", officeId).eq("deletado", false).gte("created_at", since), "responsavel_id"),
        inMembers(supabase.from("financeiro").select("tipo, valor, categoria, created_at, user_id")
          .eq("office_id", officeId).eq("deletado", false).gte("created_at", since), "user_id"),
      ]);

      if (cancel) return;

      const procRows = proc.data || [];
      const przRows = prz.data || [];
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

      // Quebra por membro (processos, prazos, tarefas, audiências)
      const bump = (map: Record<string, MemberBreakdown>, uid: string | null, field: keyof Omit<MemberBreakdown, "name">) => {
        if (!uid) return;
        if (!map[uid]) map[uid] = { name: uid, processos: 0, prazos: 0, tarefas: 0, audiencias: 0 };
        map[uid][field] += 1;
      };
      const memberMap: Record<string, MemberBreakdown> = {};
      procRows.forEach((p: any) => bump(memberMap, p.responsavel_id || p.user_id, "processos"));
      przRows.forEach((p: any) => bump(memberMap, p.responsavel_id, "prazos"));
      // tarefas e audiências (todo o histórico, não só o período)
      const [tarRes, audRes] = await Promise.all([
        teamMemberIds
          ? supabase.from("tarefas").select("responsavel_id, user_id").eq("office_id", officeId).eq("deletado", false).in("responsavel_id", teamMemberIds)
          : supabase.from("tarefas").select("responsavel_id, user_id").eq("office_id", officeId).eq("deletado", false),
        teamMemberIds
          ? supabase.from("audiencias").select("responsavel_id, user_id").eq("office_id", officeId).eq("deletado", false).in("responsavel_id", teamMemberIds)
          : supabase.from("audiencias").select("responsavel_id, user_id").eq("office_id", officeId).eq("deletado", false),
      ]);
      if (cancel) return;
      (tarRes.data || []).forEach((t: any) => bump(memberMap, t.responsavel_id || t.user_id, "tarefas"));
      (audRes.data || []).forEach((a: any) => bump(memberMap, a.responsavel_id || a.user_id, "audiencias"));

      // Resolve nomes
      const ids = Object.keys(memberMap);
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("user_id, full_name, email").in("user_id", ids);
        const nameMap: Record<string, string> = {};
        (profs || []).forEach((p: any) => { nameMap[p.user_id] = p.full_name || p.email || "Membro"; });
        ids.forEach(id => { memberMap[id].name = nameMap[id] || "Membro"; });
      }
      const porMembro = Object.values(memberMap)
        .sort((a, b) => (b.processos + b.prazos + b.tarefas + b.audiencias) - (a.processos + a.prazos + a.tarefas + a.audiencias))
        .slice(0, 12);

      const totals = {
        processos: procRows.filter((p: any) => p.status !== "encerrado").length,
        clientes: cliRows.filter((c: any) => ["ativo", "convertido"].includes(c.status)).length,
        atendimentos: atRows.length,
        receita: totReceita,
        despesa: totDespesa,
      };

      if (cancel) return;
      setData({
        loading: false, totals, processosPorMes, statusProcessos, clientesPorTipo,
        novosClientesPorMes, atendimentosPorMes, financeiroPorMes, honorariosPorCategoria, porMembro,
        isEmpty: procRows.length === 0 && cliRows.length === 0 && atRows.length === 0 && finRows.length === 0,
      });
    })();
    return () => { cancel = true; };
  }, [user?.office_id, period, teamId]);

  return data;
}
