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

export interface MemberBreakdown {
  name: string;
  processos: number; prazos: number; tarefas: number; audiencias: number;
  tarefasConcluidas: number; prazosConcluidos: number; audienciasRealizadas: number; processosEncerrados: number;
  pontos: number;
}

// Pontuação por item finalizado (padrão; admin pode configurar)
export const PONTOS = { tarefa: 10, prazo: 25, audiencia: 15, processo: 40 };
export type PontosConfig = { tarefa: number; prazo: number; audiencia: number; processo: number };
export type MetaConfig = { area: string; alvo: number; label: string } | null;

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
  processosPorArea: { name: string; value: number; fill: string }[];
  // Novos módulos
  prazosPorMes: { mes: string; novos: number; cumpridos: number }[];
  prazosPorStatus: { name: string; value: number; fill: string }[];
  tarefasPorMes: { mes: string; criadas: number; concluidas: number }[];
  audienciasPorMes: { mes: string; total: number }[];
  audienciasPorStatus: { name: string; value: number; fill: string }[];
  consultivoPorMes: { mes: string; total: number }[];
  consultivoPorStatus: { name: string; value: number; fill: string }[];
  timesheetPorMes: { mes: string; horas: number }[];
  porMembro: MemberBreakdown[];
  pontosConfig: PontosConfig;
  meta: MetaConfig;
  metaAtual: number;
  isEmpty: boolean;
  refetch: () => void;
}

const PALETTE = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#8b5cf6", "#f97316"];
const STATUS_LABEL: Record<string, string> = {
  ativo: "Em andamento", encerrado: "Encerrados", suspenso: "Suspensos",
  arquivado: "Arquivados", pendente: "Pendentes",
};

export function useChartsData(period: ChartsPeriod = 6, teamId: string | null = null): ChartsData {
  const { user } = useAuth();
  const [reload, setReload] = useState(0);
  const refetch = () => setReload(r => r + 1);
  const [data, setData] = useState<ChartsData>({
    loading: true,
    totals: { processos: 0, clientes: 0, atendimentos: 0, receita: 0, despesa: 0 },
    processosPorMes: [], statusProcessos: [], clientesPorTipo: [],
    novosClientesPorMes: [], atendimentosPorMes: [], financeiroPorMes: [],
    honorariosPorCategoria: [], processosPorArea: [],
    prazosPorMes: [], prazosPorStatus: [], tarefasPorMes: [], audienciasPorMes: [],
    audienciasPorStatus: [], consultivoPorMes: [], consultivoPorStatus: [], timesheetPorMes: [],
    porMembro: [], pontosConfig: PONTOS, meta: null, metaAtual: 0, isEmpty: true,
    refetch,
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

      const [proc, prz, cli, at, fin, cons, ts, off] = await Promise.all([
        teamMemberIds
          ? supabase.from("processos").select("status, tipo_processo, created_at, updated_at, responsavel_id, user_id")
              .eq("office_id", officeId).eq("deletado", false).in("responsavel_id", teamMemberIds)
          : supabase.from("processos").select("status, tipo_processo, created_at, updated_at, responsavel_id, user_id")
              .eq("office_id", officeId).eq("deletado", false),
        inMembers(supabase.from("prazos").select("responsavel_id, data_fim_prazo, created_at, status")
          .eq("office_id", officeId), "responsavel_id"),
        supabase.from("clientes").select("tipo_pessoa, status, created_at")
          .eq("office_id", officeId).eq("deletado", false).eq("deletado_pendente", false),
        inMembers(supabase.from("atendimentos").select("created_at, responsavel_id, user_id")
          .eq("office_id", officeId).eq("deletado", false).gte("created_at", since), "responsavel_id"),
        inMembers(supabase.from("financeiro").select("tipo, valor, categoria, created_at, user_id")
          .eq("office_id", officeId).eq("deletado", false).gte("created_at", since), "user_id"),
        inMembers(supabase.from("consultivos").select("created_at, status, user_id, responsavel_id")
          .eq("office_id", officeId).eq("deletado", false).gte("created_at", since), "responsavel_id"),
        inMembers(supabase.from("timesheets").select("created_at, duracao_minutos, user_id")
          .gte("created_at", since), "user_id"),
        supabase.from("offices").select("settings").eq("id", officeId).maybeSingle(),
      ]);

      if (cancel) return;

      const procRows = proc.data || [];
      const przRows = prz.data || [];
      const cliRows = cli.data || [];
      const atRows = at.data || [];
      const finRows = fin.data || [];
      const consRows = cons.data || [];
      const tsRows = ts.data || [];
      const settings = (off.data as any)?.settings || {};
      const pontosConfig: PontosConfig = { ...PONTOS, ...(settings.chart_pontos || {}) };
      const meta: MetaConfig = settings.chart_meta && settings.chart_meta.area ? settings.chart_meta : null;

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
        if (!map[uid]) map[uid] = { name: uid, processos: 0, prazos: 0, tarefas: 0, audiencias: 0, tarefasConcluidas: 0, prazosConcluidos: 0, audienciasRealizadas: 0, processosEncerrados: 0, pontos: 0 };
        map[uid][field] += 1;
      };
      const memberMap: Record<string, MemberBreakdown> = {};
      procRows.forEach((p: any) => {
        const uid = p.responsavel_id || p.user_id;
        bump(memberMap, uid, "processos");
        if (p.status === "encerrado" && uid && memberMap[uid]) memberMap[uid].processosEncerrados += 1;
      });
      przRows.forEach((p: any) => {
        bump(memberMap, p.responsavel_id, "prazos");
        if (p.status === "concluido" && p.responsavel_id && memberMap[p.responsavel_id]) memberMap[p.responsavel_id].prazosConcluidos += 1;
      });
      // tarefas e audiências (todo o histórico, não só o período)
      const [tarRes, audRes] = await Promise.all([
        teamMemberIds
          ? supabase.from("tarefas").select("responsavel_id, user_id, concluida, created_at").eq("office_id", officeId).eq("deletado", false).in("responsavel_id", teamMemberIds)
          : supabase.from("tarefas").select("responsavel_id, user_id, concluida, created_at").eq("office_id", officeId).eq("deletado", false),
        teamMemberIds
          ? supabase.from("audiencias").select("responsavel_id, user_id, status, data_audiencia").eq("office_id", officeId).eq("deletado", false).in("responsavel_id", teamMemberIds)
          : supabase.from("audiencias").select("responsavel_id, user_id, status, data_audiencia").eq("office_id", officeId).eq("deletado", false),
      ]);
      if (cancel) return;
      (tarRes.data || []).forEach((t: any) => {
        const uid = t.responsavel_id || t.user_id;
        bump(memberMap, uid, "tarefas");
        if (t.concluida && uid && memberMap[uid]) memberMap[uid].tarefasConcluidas += 1;
      });
      (audRes.data || []).forEach((a: any) => {
        const uid = a.responsavel_id || a.user_id;
        bump(memberMap, uid, "audiencias");
        if (a.status === "realizada" && uid && memberMap[uid]) memberMap[uid].audienciasRealizadas += 1;
      });

      // Pontuação de produtividade (itens finalizados) — usa config do admin
      Object.values(memberMap).forEach(m => {
        m.pontos = m.tarefasConcluidas * pontosConfig.tarefa
          + m.prazosConcluidos * pontosConfig.prazo
          + m.audienciasRealizadas * pontosConfig.audiencia
          + m.processosEncerrados * pontosConfig.processo;
      });

      // Processos por área (tipo_processo)
      const areaCount: Record<string, number> = {};
      procRows.forEach((p: any) => { const a = (p.tipo_processo || "Sem área").trim() || "Sem área"; areaCount[a] = (areaCount[a] || 0) + 1; });
      const processosPorArea = Object.entries(areaCount)
        .sort((a, b) => b[1] - a[1]).slice(0, 8)
        .map(([k, v], i) => ({ name: k, value: v, fill: PALETTE[i % PALETTE.length] }));

      const monthlySum = (rows: any[], dateField: string, valFn?: (r: any) => number) => {
        const map: Record<string, number> = {};
        rows.forEach(r => { const mk = monthKey(r[dateField]); if (mk) map[mk] = (map[mk] || 0) + (valFn ? valFn(r) : 1); });
        return map;
      };
      const statusBreakdown = (rows: any[], labels: Record<string, string> = {}) => {
        const c: Record<string, number> = {};
        rows.forEach(r => { const s = r.status || "—"; c[s] = (c[s] || 0) + 1; });
        return Object.entries(c).map(([k, v], i) => ({ name: labels[k] || k, value: v, fill: PALETTE[i % PALETTE.length] }));
      };

      // PRAZOS
      const przNovos = monthlySum(przRows, "created_at");
      const przCump: Record<string, number> = {};
      przRows.forEach((p: any) => { if (p.status === "concluido") { const mk = monthKey(p.data_fim_prazo || p.created_at); if (mk) przCump[mk] = (przCump[mk] || 0) + 1; } });
      const prazosPorMes = months.map(m => ({ mes: m.label, novos: przNovos[m.key] || 0, cumpridos: przCump[m.key] || 0 }));
      const prazosPorStatus = statusBreakdown(przRows, { concluido: "Cumpridos", pendente: "Pendentes" });

      // TAREFAS
      const tarRows = tarRes.data || [];
      const tarCri = monthlySum(tarRows, "created_at");
      const tarConc: Record<string, number> = {};
      tarRows.forEach((t: any) => { if (t.concluida) { const mk = monthKey(t.created_at); if (mk) tarConc[mk] = (tarConc[mk] || 0) + 1; } });
      const tarefasPorMes = months.map(m => ({ mes: m.label, criadas: tarCri[m.key] || 0, concluidas: tarConc[m.key] || 0 }));

      // AUDIÊNCIAS
      const audRows = audRes.data || [];
      const audMes = monthlySum(audRows, "data_audiencia");
      const audienciasPorMes = months.map(m => ({ mes: m.label, total: audMes[m.key] || 0 }));
      const audienciasPorStatus = statusBreakdown(audRows, { realizada: "Realizadas", agendada: "Agendadas", cancelada: "Canceladas", confirmada: "Confirmadas", pendente: "Pendentes" });

      // CONSULTIVO
      const consMes = monthlySum(consRows, "created_at");
      const consultivoPorMes = months.map(m => ({ mes: m.label, total: consMes[m.key] || 0 }));
      const consultivoPorStatus = statusBreakdown(consRows, { concluido: "Concluídos", em_andamento: "Em andamento", pendente: "Pendentes" });

      // TIMESHEET (horas)
      const tsMin = monthlySum(tsRows, "created_at", (r) => Number(r.duracao_minutos) || 0);
      const timesheetPorMes = months.map(m => ({ mes: m.label, horas: Math.round((tsMin[m.key] || 0) / 60 * 10) / 10 }));

      // META de contratos (processos do período cujo tipo bate com a área-foco)
      let metaAtual = 0;
      if (meta?.area) {
        const alvoArea = meta.area.toLowerCase().trim();
        metaAtual = procRows.filter((p: any) =>
          monthKey(p.created_at) >= months[0].key &&
          (p.tipo_processo || "").toLowerCase().trim() === alvoArea
        ).length;
      }

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
        novosClientesPorMes, atendimentosPorMes, financeiroPorMes, honorariosPorCategoria, processosPorArea,
        prazosPorMes, prazosPorStatus, tarefasPorMes, audienciasPorMes, audienciasPorStatus,
        consultivoPorMes, consultivoPorStatus, timesheetPorMes,
        porMembro, pontosConfig, meta, metaAtual,
        isEmpty: procRows.length === 0 && cliRows.length === 0 && atRows.length === 0 && finRows.length === 0,
        refetch,
      });
    })();
    return () => { cancel = true; };
  }, [user?.office_id, period, teamId, reload]);

  return data;
}
