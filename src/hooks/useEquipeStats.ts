import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getErrorMessage } from "@/lib/errors";
import {
  EMPTY_SUMMARY, getPeriodDates, type MemberStats, type Period, type TeamSummary,
} from "@/components/Equipe/equipeDetalheShared";

/**
 * Métricas de produtividade de uma equipe (EquipeDetalhe): membros com
 * contagens por período, resumo somado e os ids dos membros. Extraído da
 * página para enxugá-la; a lógica das consultas é a mesma.
 */
export function useEquipeStats(teamId: string | undefined, officeId: string | null | undefined, period: Period) {
  const [members, setMembers] = useState<MemberStats[]>([]);
  const [summary, setSummary] = useState<TeamSummary>(EMPTY_SUMMARY);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!teamId || !officeId) return;
    setLoading(true);
    setError(null);

    try {
    const { start, end } = getPeriodDates(period);
    const now = new Date();
    const in7days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const in3days = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const today = now.toISOString().split("T")[0];

    // 1. Buscar membros da equipe com perfis
    const { data: membersData, error: membersError } = await supabase
      .from("office_team_members")
      .select("user_id, role")
      .eq("team_id", teamId);

    if (membersError) throw membersError;
    if (!membersData?.length) {
      // Antes só `return`: a tela mantinha membros/resumo da equipe aberta ANTES
      // (navegação entre equipes) como se fossem desta.
      setMembers([]);
      setMemberIds([]);
      setSummary(EMPTY_SUMMARY);
      return;
    }

    const userIds = membersData.map(m => m.user_id);
    setMemberIds(userIds);

    const { data: profilesData, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id, full_name, email")
      .in("user_id", userIds);
    if (profilesError) throw profilesError;

    const profileMap: Record<string, { full_name: string | null; email: string | null }> = {};
    (profilesData || []).forEach(p => { profileMap[p.user_id] = p; });

    // 2. Processos da equipe (team_id, responsável OU criador membro — sem filtro de data, são ativos)
    const procSel = "id, user_id, responsavel_id, team_id";
    const [procByTeam, procByResp, procByCreator] = await Promise.all([
      supabase.from("processos").select(procSel).eq("office_id", officeId)
        .eq("deletado", false).neq("status", "encerrado").eq("team_id", teamId),
      supabase.from("processos").select(procSel).eq("office_id", officeId)
        .eq("deletado", false).neq("status", "encerrado").in("responsavel_id", userIds),
      supabase.from("processos").select(procSel).eq("office_id", officeId)
        .eq("deletado", false).neq("status", "encerrado").in("user_id", userIds),
    ]);
    // Nenhuma das 9 consultas checava erro: uma falha virava "0" no card do membro,
    // indistinguível de "não tem nada" — um ranking de produtividade errado.
    const procErr = procByTeam.error || procByResp.error || procByCreator.error;
    if (procErr) throw procErr;
    // Mescla deduplicando por id (um processo pode bater em mais de um critério)
    const procSeen = new Set<string>();
    const processosData = [...(procByTeam.data || []), ...(procByResp.data || []), ...(procByCreator.data || [])]
      .filter((p) => { if (procSeen.has(p.id)) return false; procSeen.add(p.id); return true; });

    // 3. Buscar demais métricas em paralelo filtradas pelo período
    const [
      tarefasRes, audienciasRes,
      prazosRes, atendimentosRes, consultivosRes, timesheetRes
    ] = await Promise.all([
      supabase.from("tarefas").select("user_id, concluida").eq("office_id", officeId)
        .eq("deletado", false).in("user_id", userIds)
        .gte("created_at", start).lte("created_at", end),
      supabase.from("audiencias").select("user_id").eq("office_id", officeId)
        .eq("deletado", false).gte("data_audiencia", now.toISOString())
        .lte("data_audiencia", in7days).in("user_id", userIds),
      // deletado/concluído não são "prazos próximos" do membro.
      supabase.from("prazos").select("responsavel_id").eq("office_id", officeId)
        .eq("deletado", false).neq("status", "concluido")
        .gte("data_fim_prazo", today).lte("data_fim_prazo", in3days).in("responsavel_id", userIds),
      supabase.from("atendimentos").select("user_id").eq("office_id", officeId)
        .eq("deletado", false).gte("created_at", start).lte("created_at", end).in("user_id", userIds),
      supabase.from("consultivos").select("user_id").eq("office_id", officeId)
        .eq("deletado", false).gte("created_at", start).lte("created_at", end).in("user_id", userIds),
      // office_id: sem ele, horas de um membro em OUTRO escritório entravam na soma.
      supabase.from("timesheets").select("user_id, duracao_minutos").eq("office_id", officeId)
        .gte("created_at", start).lte("created_at", end).in("user_id", userIds),
    ]);

    const metricErr = tarefasRes.error || audienciasRes.error || prazosRes.error || atendimentosRes.error || consultivosRes.error || timesheetRes.error;
    if (metricErr) throw metricErr;

    // 4. Agrupar por user_id (key = campo que identifica o membro)
    const countBy = (arr: Record<string, unknown>[] | null, key = "user_id") => {
      const map: Record<string, number> = {};
      (arr || []).forEach(r => { const k = r[key]; if (typeof k === "string" && k) map[k] = (map[k] || 0) + 1; });
      return map;
    };

    const processosMap: Record<string, number> = {};
    processosData.forEach((p) => {
      const k = p.responsavel_id || p.user_id;
      if (k) processosMap[k] = (processosMap[k] || 0) + 1;
    });
    const audienciasMap = countBy(audienciasRes.data);
    const prazosMap = countBy(prazosRes.data, "responsavel_id");
    const atendimentosMap = countBy(atendimentosRes.data);
    const consultivosMap = countBy(consultivosRes.data);

    const tarefasPendMap: Record<string, number> = {};
    const tarefasConcMap: Record<string, number> = {};
    (tarefasRes.data || []).forEach(t => {
      if (t.concluida) tarefasConcMap[t.user_id] = (tarefasConcMap[t.user_id] || 0) + 1;
      else tarefasPendMap[t.user_id] = (tarefasPendMap[t.user_id] || 0) + 1;
    });

    const horasMap: Record<string, number> = {};
    (timesheetRes.data || []).forEach(t => {
      horasMap[t.user_id] = (horasMap[t.user_id] || 0) + (t.duracao_minutos || 0);
    });

    // 5. Montar lista de membros
    const memberStats: MemberStats[] = membersData.map(m => ({
      user_id: m.user_id,
      full_name: profileMap[m.user_id]?.full_name ?? null,
      email: profileMap[m.user_id]?.email ?? null,
      role: m.role as "coordinator" | "member",
      processos: processosMap[m.user_id] || 0,
      tarefasPendentes: tarefasPendMap[m.user_id] || 0,
      tarefasConcluidas: tarefasConcMap[m.user_id] || 0,
      audiencias: audienciasMap[m.user_id] || 0,
      prazos: prazosMap[m.user_id] || 0,
      atendimentos: atendimentosMap[m.user_id] || 0,
      consultivos: consultivosMap[m.user_id] || 0,
      horasTimesheet: Math.round((horasMap[m.user_id] || 0) / 60),
    }));

    // Coordenadores primeiro
    memberStats.sort((a, b) =>
      a.role === "coordinator" && b.role !== "coordinator" ? -1 :
      b.role === "coordinator" && a.role !== "coordinator" ? 1 : 0
    );

    setMembers(memberStats);

    // 6. Resumo da equipe
    setSummary({
      processos: processosData.length,
      tarefasPendentes: memberStats.reduce((s, m) => s + m.tarefasPendentes, 0),
      tarefasConcluidas: memberStats.reduce((s, m) => s + m.tarefasConcluidas, 0),
      audiencias: memberStats.reduce((s, m) => s + m.audiencias, 0),
      prazos: memberStats.reduce((s, m) => s + m.prazos, 0),
      atendimentos: memberStats.reduce((s, m) => s + m.atendimentos, 0),
      consultivos: memberStats.reduce((s, m) => s + m.consultivos, 0),
      horasTimesheet: memberStats.reduce((s, m) => s + m.horasTimesheet, 0),
    });
    } catch (e) {
      setError(getErrorMessage(e, "Não foi possível carregar os dados da equipe."));
    } finally {
      setLoading(false);
    }
  }, [teamId, officeId, period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { members, summary, memberIds, loading, error, refetch: fetchData };
}
