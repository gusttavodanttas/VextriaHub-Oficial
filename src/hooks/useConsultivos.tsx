import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { getErrorMessage, assertRowsAffected } from "@/lib/errors";

export type Consultivo = Tables<"consultivos"> & {
  clientes?: { nome: string } | null;
};

// PostgREST usa vírgula/parênteses como separadores em `.or()` — escapa o valor
// dinâmico entre aspas pra um termo de busca com esses caracteres não quebrar o filtro.
const escapeOrValue = (v: string) => `"${v.replace(/"/g, '\\"')}"`;

export interface ConsultivosListaParams {
  page: number;
  pageSize: number;
  status?: string | null;
  categoria?: string | null;
  prioridade?: string | null;
  clienteId?: string | null;
  search?: string;
}

/**
 * Lista PAGINADA de consultivos (usada só pela tela /consultivo) — filtros e
 * busca rodam no servidor, no mesmo padrão de useProcessosLista. Substitui o
 * fetch-all com cap de segurança que existia antes.
 */
export function useConsultivosLista(params: ConsultivosListaParams) {
  const { user } = useAuth();
  const { page, pageSize, status, categoria, prioridade, clienteId, search } = params;
  const q = (search || "").trim();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["consultivos", "lista", user?.office_id, page, pageSize, status || "all", categoria || "all", prioridade || "all", clienteId || "all", q],
    queryFn: async () => {
      if (!user?.office_id) return { rows: [] as Consultivo[], total: 0 };

      let query = supabase
        .from("consultivos")
        .select("*, clientes(nome)", { count: "exact" })
        .eq("office_id", user.office_id)
        .eq("deletado", false);

      if (status && status !== "all") query = query.eq("status", status);
      if (categoria && categoria !== "all") query = query.eq("categoria", categoria);
      if (prioridade && prioridade !== "all") query = query.eq("prioridade", prioridade);
      if (clienteId) query = query.eq("cliente_id", clienteId);
      if (q) {
        query = query.or(`titulo.ilike.${escapeOrValue(`%${q}%`)},descricao.ilike.${escapeOrValue(`%${q}%`)}`);
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      const { data: rows, error: fetchError, count } = await query
        .order("created_at", { ascending: false })
        .range(from, to);

      if (fetchError) throw fetchError;
      return { rows: (rows as Consultivo[]) || [], total: count ?? 0 };
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

/**
 * Contagens por status pros cards de KPI — sempre o total real do escritório,
 * independente dos filtros de busca/categoria/prioridade ativos (mesmo
 * comportamento de antes da paginação).
 */
export function useConsultivosStatusCounts() {
  const { user } = useAuth();

  const { data } = useQuery({
    queryKey: ["consultivos", "contagens", user?.office_id],
    queryFn: async () => {
      if (!user?.office_id) return { total: 0, pendente: 0, em_andamento: 0, concluido: 0 };
      const base = () => supabase.from("consultivos").select("id", { count: "exact", head: true })
        .eq("office_id", user.office_id!).eq("deletado", false);
      const [total, pendente, em_andamento, concluido] = await Promise.all([
        base(),
        base().eq("status", "pendente"),
        base().eq("status", "em_andamento"),
        base().eq("status", "concluido"),
      ]);
      return {
        total: total.count ?? 0,
        pendente: pendente.count ?? 0,
        em_andamento: em_andamento.count ?? 0,
        concluido: concluido.count ?? 0,
      };
    },
    enabled: !!user?.office_id,
    staleTime: 0,
    gcTime: 60000,
  });

  return data ?? { total: 0, pendente: 0, em_andamento: 0, concluido: 0 };
}

/**
 * Valores de `categoria` realmente em uso nos consultivos do escritório —
 * busca só essa coluna (leve mesmo em bases grandes), sem paginar. Usado pra
 * detectar categorias "órfãs" (gravadas num consultivo mas não cadastradas em
 * consultivo_categorias) mesmo quando o item órfão não está na página atual.
 */
export function useConsultivoCategoriaValoresEmUso(): string[] {
  const { user } = useAuth();

  const { data } = useQuery({
    queryKey: ["consultivos", "categorias-em-uso", user?.office_id],
    queryFn: async () => {
      if (!user?.office_id) return [];
      const { data: rows } = await supabase
        .from("consultivos")
        .select("categoria")
        .eq("office_id", user.office_id)
        .eq("deletado", false);
      return Array.from(new Set((rows || []).map((r) => r.categoria).filter(Boolean))) as string[];
    },
    enabled: !!user?.office_id,
    staleTime: 60000,
  });

  return data ?? [];
}

/** Mutações de consultivo (criar/atualizar/remover) — invalida lista, contagens
 * e categorias-em-uso juntas (mesmo prefixo de query key). */
export function useConsultivos() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const invalidate = useCallback(() =>
    queryClient.invalidateQueries({ queryKey: ["consultivos"] }),
    [queryClient]
  );

  const create = async (payload: Omit<TablesInsert<"consultivos">, "user_id" | "office_id">): Promise<boolean> => {
    if (!user?.office_id) return false;
    try {
      const { error } = await supabase.from("consultivos").insert({
        ...payload,
        user_id: user.id,
        office_id: user.office_id,
      });
      if (error) throw error;
      invalidate();
      toast({ title: "Consultivo criado", description: `"${payload.titulo}" adicionado.` });
      return true;
    } catch (err) {
      console.error("Erro ao criar consultivo:", err);
      toast({ title: "Erro ao criar consultivo", description: getErrorMessage(err), variant: "destructive" });
      return false;
    }
  };

  const update = async (id: string, payload: TablesUpdate<"consultivos">): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from("consultivos").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", id).select("id");
      assertRowsAffected(data, error, 1);
      invalidate();
      return true;
    } catch (err) {
      console.error("Erro ao atualizar consultivo:", err);
      toast({ title: "Erro ao atualizar", description: getErrorMessage(err), variant: "destructive" });
      return false;
    }
  };

  const remove = async (id: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from("consultivos").update({ deletado: true, updated_at: new Date().toISOString() }).eq("id", id).select("id");
      assertRowsAffected(data, error, 1);
      invalidate();
      toast({ title: "Consultivo removido" });
      return true;
    } catch (err) {
      console.error("Erro ao remover consultivo:", err);
      toast({ title: "Erro ao remover", description: getErrorMessage(err), variant: "destructive" });
      return false;
    }
  };

  return { create, update, remove };
}
