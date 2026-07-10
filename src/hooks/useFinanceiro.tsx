// Dados + mutações do Financeiro e categorias (offices.settings) — extraídos
// de pages/Financeiro.tsx sem mudança de comportamento.
import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  DEFAULT_CATEGORIAS_RECEITA, DEFAULT_CATEGORIAS_DESPESA,
  type FinanceiroItem,
} from "@/components/Financeiro/shared";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/rows";

// ─── Hook financeiro ─────────────────────────────────────────────────────────

const useFinanceiro = (officeId: string | null | undefined) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ["financeiro", officeId],
    enabled: !!officeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financeiro")
        .select("*, clientes!cliente_id(nome)")
        .eq("office_id", officeId!)
        .eq("deletado", false)
        .order("data_vencimento", { ascending: true });
      if (error) throw error;
      return (data ?? []) as FinanceiroItem[];
    },
  });

  const invalidate = useCallback(() =>
    queryClient.invalidateQueries({ queryKey: ["financeiro", officeId] }),
    [queryClient, officeId]
  );

  const create = useMutation({
    mutationFn: async (payload: TablesInsert<"financeiro"> | TablesInsert<"financeiro">[]) => {
      const { error } = await supabase.from("financeiro").insert(payload);
      if (error) throw error;
    },
    onSuccess: (_d, payload) => {
      invalidate();
      const n = Array.isArray(payload) ? payload.length : 1;
      toast({ title: n > 1 ? `${n} lançamentos criados!` : "Registro criado!" });
    },
    onError: (e: Error) => toast({ title: "Erro ao criar", description: e.message, variant: "destructive" }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...payload }: TablesUpdate<"financeiro"> & { id: string }) => {
      const { error } = await supabase.from("financeiro").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Registro atualizado!" }); },
    onError: (e: Error) => toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("financeiro").update({ deletado: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Registro excluído!" }); },
    onError: (e: Error) => toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" }),
  });

  const markPago = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("financeiro")
        .update({ status: "pago", data_pagamento: format(new Date(), "yyyy-MM-dd") })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Marcado como pago!" }); },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const cancelarGrupo = useMutation({
    mutationFn: async (grupoId: string) => {
      const hoje = format(new Date(), "yyyy-MM-dd");
      const { error } = await supabase.from("financeiro")
        .update({ deletado: true })
        .eq("grupo_id", grupoId)
        .eq("status", "pendente")
        .gte("data_vencimento", hoje);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Lançamentos futuros cancelados." }); },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return { query, create, update, remove, markPago, cancelarGrupo };
};


const useFinanceiroCategorias = (officeId: string) => {
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["office-settings", officeId],
    enabled: !!officeId,
    queryFn: async () => {
      const { data } = await supabase
        .from("offices")
        .select("settings")
        .eq("id", officeId)
        .maybeSingle();
      const s = (data?.settings as any) ?? {};
      return {
        receita: (s.fin_categorias_receita as string[]) ?? DEFAULT_CATEGORIAS_RECEITA,
        despesa: (s.fin_categorias_despesa as string[]) ?? DEFAULT_CATEGORIAS_DESPESA,
      };
    },
  });

  const save = useCallback(async (receita: string[], despesa: string[]) => {
    const { data: cur } = await supabase.from("offices").select("settings").eq("id", officeId).maybeSingle();
    const merged = { ...(cur?.settings as any ?? {}), fin_categorias_receita: receita, fin_categorias_despesa: despesa };
    await supabase.from("offices").update({ settings: merged }).eq("id", officeId);
    queryClient.invalidateQueries({ queryKey: ["office-settings", officeId] });
  }, [officeId, queryClient]);

  return {
    categoriasReceita: data?.receita ?? DEFAULT_CATEGORIAS_RECEITA,
    categoriasDespesa: data?.despesa ?? DEFAULT_CATEGORIAS_DESPESA,
    save,
  };
};


export { useFinanceiro, useFinanceiroCategorias };
