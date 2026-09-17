// Lista PAGINADA de clientes (usada só pela tela /clientes) — mesmo padrão
// de useProcessosLista.tsx/useConsultivosLista. useClientes() continua
// intacto (fetch-all capado em 1000) para quem precisa da lista inteira,
// como o CRM (funil de leads) e os seletores de cliente em outras telas.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getErrorMessage } from "@/lib/errors";
import type { ClienteComProcessos } from "@/types/database";

// PostgREST usa vírgula/parênteses como separadores em `.or()` — escapa o valor
// dinâmico entre aspas pra um termo de busca com esses caracteres não quebrar o filtro.
const escapeOrValue = (v: string) => `"${v.replace(/"/g, '\\"')}"`;

// Leads CRM puros (status 'lead') moram no funil (Crm.tsx), não na lista de
// clientes reais — mesma exclusão que antes rodava em memória na página.
const FILTRO_SEM_LEAD = "status.is.null,status.not.ilike.lead";

export interface ClientesListaParams {
  page: number;
  pageSize: number;
  search?: string;
  tipoPessoa?: string | null;
  origem?: string | null;
  status?: string | null;
  dataInicioFrom?: Date | null;
  dataInicioTo?: Date | null;
  teamMemberIds?: string[] | null;
  sortBy: "recentes" | "nome";
}

export function useClientesLista(params: ClientesListaParams) {
  const { user } = useAuth();
  const {
    page, pageSize, search, tipoPessoa, origem, status,
    dataInicioFrom, dataInicioTo, teamMemberIds, sortBy,
  } = params;
  const q = (search || "").trim();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [
      "clientes", "lista", user?.office_id, page, pageSize, q,
      tipoPessoa || "all", origem || "all", status || "all",
      dataInicioFrom?.getTime() || 0, dataInicioTo?.getTime() || 0,
      (teamMemberIds || []).join(","), sortBy,
    ],
    queryFn: async () => {
      if (!user?.office_id) return { rows: [] as ClienteComProcessos[], total: 0 };

      let query = supabase
        .from("clientes")
        .select("*, processos!processos_cliente_id_fkey(count)", { count: "exact" })
        .eq("office_id", user.office_id)
        .eq("deletado", false)
        .eq("deletado_pendente", false)
        .or(FILTRO_SEM_LEAD);

      if (tipoPessoa) query = query.eq("tipo_pessoa", tipoPessoa);
      if (origem) query = query.eq("origem", origem);
      if (status) query = query.ilike("status", status);
      if (dataInicioFrom) query = query.gte("created_at", dataInicioFrom.toISOString());
      if (dataInicioTo) query = query.lte("created_at", dataInicioTo.toISOString());
      if (teamMemberIds && teamMemberIds.length) query = query.in("user_id", teamMemberIds);
      if (q) {
        // Busca por nome/e-mail/documento/telefone via ilike — diferente da busca
        // client-side anterior, não normaliza dígitos (um usuário buscando só os
        // números de um telefone formatado como "(11) 98765-4321" pode não achar
        // por essa via; o nome/e-mail continuam cobertos normalmente).
        const esc = escapeOrValue(`%${q}%`);
        query = query.or(`nome.ilike.${esc},email.ilike.${esc},cpf_cnpj.ilike.${esc},telefone.ilike.${esc}`);
      }

      // "Mais processos" não dá pra ordenar no servidor (seria por contagem de
      // uma relação embutida, que o PostgREST não suporta via .order()) — a UI
      // oferece só "recentes"/"nome" agora.
      query = sortBy === "nome"
        ? query.order("nome", { ascending: true })
        : query.order("created_at", { ascending: false });

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      const { data: rows, error: fetchError, count } = await query.range(from, to);
      if (fetchError) throw fetchError;
      return { rows: (rows as ClienteComProcessos[]) || [], total: count ?? 0 };
    },
    enabled: !!user?.office_id,
    staleTime: 0,
    gcTime: 60000,
    placeholderData: (prev) => prev,
  });

  return {
    data: data?.rows ?? [],
    total: data?.total ?? 0,
    loading: isLoading,
    error: error ? getErrorMessage(error) : null,
    refetch: () => { refetch(); },
  };
}

/** Contagens globais pros cards de KPI — sempre o total real do escritório
 * (excluindo leads), independente dos filtros/busca ativos. */
export function useClientesStats() {
  const { user } = useAuth();

  const { data } = useQuery({
    queryKey: ["clientes", "contagens", user?.office_id],
    queryFn: async () => {
      if (!user?.office_id) return { total: 0, ativos: 0, inativos: 0, juridica: 0 };
      const base = () => supabase.from("clientes").select("id", { count: "exact", head: true })
        .eq("office_id", user.office_id!).eq("deletado", false).eq("deletado_pendente", false)
        .or(FILTRO_SEM_LEAD);
      const [total, ativos, inativos, juridica] = await Promise.all([
        base(),
        base().ilike("status", "ativo"),
        base().ilike("status", "inativo"),
        base().eq("tipo_pessoa", "juridica"),
      ]);
      return {
        total: total.count ?? 0,
        ativos: ativos.count ?? 0,
        inativos: inativos.count ?? 0,
        juridica: juridica.count ?? 0,
      };
    },
    enabled: !!user?.office_id,
    staleTime: 0,
    gcTime: 60000,
  });

  return data ?? { total: 0, ativos: 0, inativos: 0, juridica: 0 };
}

/** Aniversariantes do mês corrente — busca leve e separada (não paginada),
 * já que precisa varrer todos os clientes, não só a página atual. */
export function useClientesAniversariantesDoMes() {
  const { user } = useAuth();
  const mes = String(new Date().getMonth() + 1).padStart(2, "0");

  const { data } = useQuery({
    queryKey: ["clientes", "aniversariantes", user?.office_id, mes],
    queryFn: async () => {
      if (!user?.office_id) return [] as ClienteComProcessos[];
      const { data: rows } = await supabase
        .from("clientes")
        .select("*, processos!processos_cliente_id_fkey(count)")
        .eq("office_id", user.office_id)
        .eq("deletado", false)
        .eq("deletado_pendente", false)
        .or(FILTRO_SEM_LEAD)
        .like("data_aniversario", `____-${mes}-__`);
      return (rows as ClienteComProcessos[]) || [];
    },
    enabled: !!user?.office_id,
    staleTime: 5 * 60_000,
  });

  return data ?? [];
}
