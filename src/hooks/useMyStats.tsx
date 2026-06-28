import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface MyStats {
  processosAtivos: number;
  processosFinalizados: number;
  clientesAtendidos: number;
  tarefasConcluidas: number;
  pontos: number;
  loading: boolean;
}

// Pontuação meritocrática (mesma lógica do ranking de produtividade)
const PT = { tarefa: 10, prazo: 25, audiencia: 15, processo: 40 };

/** Estatísticas reais do usuário logado (o que é responsabilidade dele). */
export function useMyStats(): MyStats {
  const { user } = useAuth();
  const [stats, setStats] = useState<MyStats>({
    processosAtivos: 0, processosFinalizados: 0, clientesAtendidos: 0,
    tarefasConcluidas: 0, pontos: 0, loading: true,
  });

  useEffect(() => {
    if (!user?.id || !user?.office_id) { setStats(s => ({ ...s, loading: false })); return; }
    let cancel = false;
    (async () => {
      const office = user.office_id;
      const uid = user.id;
      const myProc = (q: any) => q.eq("office_id", office).eq("deletado", false).or(`responsavel_id.eq.${uid},user_id.eq.${uid}`);

      const [procAtivos, procEnc, clientes, tarefas, prazos, audiencias] = await Promise.all([
        myProc(supabase.from("processos").select("id", { count: "exact", head: true })).neq("status", "encerrado"),
        myProc(supabase.from("processos").select("id", { count: "exact", head: true })).eq("status", "encerrado"),
        supabase.from("clientes").select("id", { count: "exact", head: true }).eq("office_id", office).eq("deletado", false).eq("user_id", uid),
        supabase.from("tarefas").select("id", { count: "exact", head: true }).eq("office_id", office).eq("deletado", false).eq("concluida", true).or(`responsavel_id.eq.${uid},user_id.eq.${uid}`),
        supabase.from("prazos").select("id", { count: "exact", head: true }).eq("office_id", office).eq("status", "concluido").eq("responsavel_id", uid),
        supabase.from("audiencias").select("id", { count: "exact", head: true }).eq("office_id", office).eq("deletado", false).eq("status", "realizada").or(`responsavel_id.eq.${uid},user_id.eq.${uid}`),
      ]);

      if (cancel) return;
      const processosFinalizados = procEnc.count || 0;
      const tarefasConcluidas = tarefas.count || 0;
      const prazosConcluidos = prazos.count || 0;
      const audienciasRealizadas = audiencias.count || 0;
      const pontos = tarefasConcluidas * PT.tarefa + prazosConcluidos * PT.prazo
        + audienciasRealizadas * PT.audiencia + processosFinalizados * PT.processo;

      setStats({
        processosAtivos: procAtivos.count || 0,
        processosFinalizados,
        clientesAtendidos: clientes.count || 0,
        tarefasConcluidas,
        pontos,
        loading: false,
      });
    })();
    return () => { cancel = true; };
  }, [user?.id, user?.office_id]);

  return stats;
}
