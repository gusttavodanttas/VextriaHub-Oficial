// Base do CRM (Crm.tsx): leads do funil + clientes convertidos.
//
// Antes a página lia useClientes() — a lista inteira do escritório com cap de 1000,
// em que os clientes "reais" (status ativo/inativo) disputavam o cap com os leads:
// num escritório com base grande, leads e convertidos antigos simplesmente sumiam
// do funil. Aqui só entra o que o CRM usa: leads inteiros (conjunto de trabalho,
// naturalmente limitado) e convertidos paginados com contagem exata
// (useHistoricoPaginado); os KPIs que precisam de todos os convertidos
// (taxa de conversão, valor ganho) vêm de uma consulta leve só com id/valor.
import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getErrorMessage } from "@/lib/errors";
import { useHistoricoPaginado } from "@/hooks/useHistoricoPaginado";
import type { ClienteComProcessos } from "@/types/database";

export const LEAD_STATUSES = ["lead", "quente", "morno", "frio"] as const;

const SELECT = "*, processos!processos_cliente_id_fkey(count)";

export function useCrmBase() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const officeId = user?.office_id;

  // Filtros comuns, aplicados depois do select (o builder só aceita filtros a partir dali).
  const doEscritorio = <Q extends { eq(col: string, val: string | boolean): Q }>(q: Q): Q =>
    q.eq("office_id", officeId!).eq("deletado", false).eq("deletado_pendente", false);

  const leads = useQuery({
    // Prefixo ["clientes"]: as mutações de cliente/lead já invalidam essa chave.
    queryKey: ["clientes", "crm", "leads", officeId],
    enabled: !!officeId,
    queryFn: async () => {
      const { data, error } = await doEscritorio(supabase.from("clientes").select(SELECT))
        .in("status", [...LEAD_STATUSES])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as ClienteComProcessos[];
    },
  });

  const convertidos = useHistoricoPaginado<ClienteComProcessos>({
    queryKey: ["clientes", "crm", "convertidos", officeId],
    enabled: !!officeId,
    fetchPage: async (from, to) => {
      const { data, error, count } = await doEscritorio(supabase.from("clientes").select(SELECT, { count: "exact" }))
        .eq("status", "convertido")
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) throw error;
      return { rows: (data || []) as ClienteComProcessos[], total: count ?? 0 };
    },
  });

  const resumoConvertidos = useQuery({
    queryKey: ["clientes", "crm", "convertidos-resumo", officeId],
    enabled: !!officeId,
    queryFn: async () => {
      const { data, error } = await doEscritorio(supabase.from("clientes").select("id, valor_estimado")).eq("status", "convertido");
      if (error) throw error;
      const rows = data || [];
      return { total: rows.length, valorGanho: rows.reduce((s, c) => s + (Number(c.valor_estimado) || 0), 0) };
    },
  });

  // Mesmo contrato que useClientes().refresh (os componentes do CRM recebem `refresh`).
  const refresh = async () => { await queryClient.invalidateQueries({ queryKey: ["clientes"] }); };

  const erro = leads.error ?? convertidos.error ?? resumoConvertidos.error;
  return {
    leads: leads.data ?? [],
    convertidos: convertidos.rows,
    /** Todos os convertidos, para taxa de conversão e valor ganho (independe da paginação). */
    resumoConvertidos: resumoConvertidos.data ?? null,
    convertidosRestantes: convertidos.restantes,
    carregarMaisConvertidos: convertidos.carregarMais,
    carregandoMaisConvertidos: convertidos.carregandoMais,
    loading: leads.isLoading || convertidos.isLoading,
    error: erro ? getErrorMessage(erro, "Não foi possível carregar a base do CRM.") : null,
    refresh,
    /** Leads + convertidos carregados — o que os relatórios/funil do CRM recebem. */
    todos: useMemo(() => [...(leads.data ?? []), ...convertidos.rows], [leads.data, convertidos.rows]),
  };
}
