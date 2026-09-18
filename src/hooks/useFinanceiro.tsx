// Dados + mutações do Financeiro e categorias (offices.settings) — extraídos
// de pages/Financeiro.tsx sem mudança de comportamento.
import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  DEFAULT_CATEGORIAS_RECEITA, DEFAULT_CATEGORIAS_DESPESA, DEFAULT_GRUPOS_PRIORIDADE,
  valorPago as calcValorPago,
  type FinanceiroItem, type PrioridadeGrupo,
} from "@/components/Financeiro/shared";
import { assertRowsAffected, getErrorMessage } from "@/lib/errors";
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
      const rows = Array.isArray(payload) ? payload : [payload];
      const { error } = await supabase.from("financeiro").insert(rows);
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
      const { data, error } = await supabase.from("financeiro").update(payload).eq("id", id).select("id");
      assertRowsAffected(data, error, 1);
    },
    onSuccess: () => { invalidate(); toast({ title: "Registro atualizado!" }); },
    onError: (e: Error) => toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.from("financeiro").update({ deletado: true }).eq("id", id).select("id");
      assertRowsAffected(data, error, 1);
    },
    onSuccess: () => { invalidate(); toast({ title: "Registro excluído!" }); },
    onError: (e: Error) => toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" }),
  });

  // Registra um pagamento/recebimento (total ou parcial) sobre um lançamento.
  // `valor` é o quanto está sendo pago agora, somado ao que já tinha sido pago
  // antes (item.valor_pago) — se o total acumulado cobre o valor do lançamento,
  // o status vira "pago"; senão fica "parcial" guardando o saldo já quitado.
  const registrarPagamento = useMutation({
    mutationFn: async ({ item, valor }: { item: FinanceiroItem; valor: number }) => {
      const pagoAtual = calcValorPago(item);
      const totalPago = Math.min(item.valor, Math.max(0, pagoAtual + valor));
      const quitado = totalPago >= item.valor - 0.005;
      const payload = {
        status: quitado ? "pago" : "parcial",
        valor_pago: totalPago,
        data_pagamento: format(new Date(), "yyyy-MM-dd"),
      };
      const { data, error } = await supabase.from("financeiro").update(payload).eq("id", item.id).select("id");
      assertRowsAffected(data, error, 1);
      return quitado;
    },
    onSuccess: (quitado) => { invalidate(); toast({ title: quitado ? "Marcado como pago!" : "Pagamento parcial registrado!" }); },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const cancelarGrupo = useMutation({
    mutationFn: async (grupoId: string) => {
      const hoje = format(new Date(), "yyyy-MM-dd");
      // Conta ANTES de atualizar: 0 linhas afetadas é legítimo quando o grupo já não
      // tem lançamento futuro pendente — só é bloqueio de permissão quando o filtro
      // casava alguma coisa e a RLS impediu o UPDATE de tocar nela.
      const { count } = await supabase.from("financeiro")
        .select("id", { count: "exact", head: true })
        .eq("grupo_id", grupoId)
        .eq("status", "pendente")
        .gte("data_vencimento", hoje);
      const { data, error } = await supabase.from("financeiro")
        .update({ deletado: true })
        .eq("grupo_id", grupoId)
        .eq("status", "pendente")
        .gte("data_vencimento", hoje)
        .select("id");
      assertRowsAffected(data, error, count ?? 0);
    },
    onSuccess: () => { invalidate(); toast({ title: "Lançamentos futuros cancelados." }); },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return { query, create, update, remove, registrarPagamento, cancelarGrupo };
};


const useFinanceiroCategorias = (officeId: string) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isError, error, refetch } = useQuery({
    queryKey: ["office-settings", officeId],
    enabled: !!officeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("offices")
        .select("settings")
        .eq("id", officeId)
        .maybeSingle();
      // Sem propagar o erro, a query "tinha sucesso" com os defaults — e um save()
      // em seguida gravava esses defaults por cima das categorias reais (mesmo
      // risco de perda de dados corrigido em useOfficeSettingList).
      if (error) throw error;
      const s = (data?.settings as any) ?? {};
      return {
        receita: (s.fin_categorias_receita as string[]) ?? DEFAULT_CATEGORIAS_RECEITA,
        despesa: (s.fin_categorias_despesa as string[]) ?? DEFAULT_CATEGORIAS_DESPESA,
      };
    },
  });

  const save = useCallback(async (receita: string[], despesa: string[]) => {
    if (isError) {
      toast({ title: "Não foi possível salvar", description: "As categorias não carregaram — recarregue antes de editar.", variant: "destructive" });
      return false;
    }
    const { data: cur } = await supabase.from("offices").select("settings").eq("id", officeId).maybeSingle();
    const merged = { ...(cur?.settings as any ?? {}), fin_categorias_receita: receita, fin_categorias_despesa: despesa };
    const { data: updated, error } = await supabase.from("offices").update({ settings: merged }).eq("id", officeId).select("id");
    try {
      assertRowsAffected(updated, error, 1);
    } catch (e) {
      toast({ title: "Erro ao salvar", description: e instanceof Error ? e.message : "Não foi possível salvar.", variant: "destructive" });
      return false;
    }
    queryClient.invalidateQueries({ queryKey: ["office-settings", officeId] });
    return true;
  }, [officeId, queryClient, toast, isError]);

  return {
    categoriasReceita: data?.receita ?? DEFAULT_CATEGORIAS_RECEITA,
    categoriasDespesa: data?.despesa ?? DEFAULT_CATEGORIAS_DESPESA,
    isError,
    error: isError ? getErrorMessage(error, "Não foi possível carregar as categorias.") : null,
    refetch,
    save,
  };
};


// Grupos de prioridade das despesas (G1/G2/G3/Esperar por padrão) — assim como
// as categorias, customizáveis por escritório e persistidos em offices.settings.
const useFinanceiroGruposPrioridade = (officeId: string) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isError, error, refetch } = useQuery({
    queryKey: ["office-settings-prioridade", officeId],
    enabled: !!officeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("offices")
        .select("settings")
        .eq("id", officeId)
        .maybeSingle();
      // Mesmo risco das outras configs em offices.settings: sem propagar o erro,
      // um save() em seguida gravaria os defaults por cima dos grupos reais.
      if (error) throw error;
      const s = (data?.settings as any) ?? {};
      return (s.fin_grupos_prioridade as PrioridadeGrupo[]) ?? DEFAULT_GRUPOS_PRIORIDADE;
    },
  });

  const save = useCallback(async (grupos: PrioridadeGrupo[]) => {
    if (isError) {
      toast({ title: "Não foi possível salvar", description: "Os grupos de prioridade não carregaram — recarregue antes de editar.", variant: "destructive" });
      return false;
    }
    const { data: cur } = await supabase.from("offices").select("settings").eq("id", officeId).maybeSingle();
    const merged = { ...(cur?.settings as any ?? {}), fin_grupos_prioridade: grupos };
    const { data: updated, error } = await supabase.from("offices").update({ settings: merged }).eq("id", officeId).select("id");
    try {
      assertRowsAffected(updated, error, 1);
    } catch (e) {
      toast({ title: "Erro ao salvar", description: e instanceof Error ? e.message : "Não foi possível salvar.", variant: "destructive" });
      return false;
    }
    queryClient.invalidateQueries({ queryKey: ["office-settings-prioridade", officeId] });
    return true;
  }, [officeId, queryClient, toast, isError]);

  return {
    gruposPrioridade: data ?? DEFAULT_GRUPOS_PRIORIDADE,
    isError,
    error: isError ? getErrorMessage(error, "Não foi possível carregar os grupos de prioridade.") : null,
    refetch,
    save,
  };
};


export { useFinanceiro, useFinanceiroCategorias, useFinanceiroGruposPrioridade };
