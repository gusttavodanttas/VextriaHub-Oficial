import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ProcessoResumo {
  id: string;
  titulo: string | null;
  numero_processo: string | null;
  status: string | null;
  created_at: string;
}
export interface AtendimentoResumo {
  id: string;
  tipo_atendimento: string;
  data_atendimento: string;
  status: string | null;
}

// Carrega os últimos processos e atendimentos de um cliente (para o modal de detalhes).
export function useClienteResumo(clientId: string | null, enabled: boolean) {
  const { user } = useAuth();
  const [processos, setProcessos] = useState<ProcessoResumo[]>([]);
  const [atendimentos, setAtendimentos] = useState<AtendimentoResumo[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !clientId || !user?.office_id) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      const [pr, at] = await Promise.all([
        supabase
          .from("processos")
          .select("id, titulo, numero_processo, status, created_at")
          .eq("cliente_id", clientId)
          .eq("office_id", user.office_id)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("atendimentos")
          .select("id, tipo_atendimento, data_atendimento, status")
          .eq("cliente_id", clientId)
          .eq("deletado", false)
          .order("data_atendimento", { ascending: false })
          .limit(5),
      ]);
      if (cancel) return;
      setProcessos((pr.data as any) || []);
      setAtendimentos((at.data as any) || []);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [clientId, enabled, user?.office_id]);

  return { processos, atendimentos, loading };
}
