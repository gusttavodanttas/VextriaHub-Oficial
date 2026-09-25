// Dados + mutações de Atendimentos — extraído de pages/Atendimentos.tsx.
import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { assertRowsAffected, getErrorMessage } from "@/lib/errors";
import { patchOfficeSettings } from "@/lib/officeSettings";
import { continueOccurrences, type RecRule } from "@/lib/recorrencia";
import type { Atendimento } from "@/components/Atendimentos/shared";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/rows";

// Filtra soft-deletados em JS (não `.eq('deletado', false)` na query — linhas
// antigas podem ter a coluna null, e isso as excluiria indevidamente).
const naoDeletado = (rows: any[] | null) => (rows ?? []).filter((i: any) => !i.deletado) as unknown as Atendimento[];

export const useAtendimentos = (officeId: string | null | undefined) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Split ativos/histórico (mesmo padrão de usePrazosData): "ativos"
  // (agendado/pendente) é o conjunto de trabalho normal, naturalmente limitado
  // pelo volume atual de agenda — busca sem cap. "histórico" (realizado/
  // cancelado) só cresce, nunca sai — busca com cap de segurança, mais
  // recentes primeiro. Substitui o fetch-all com .limit(1000) que, ordenado
  // por data DESCENDENTE, cortava justamente os atendimentos mais ANTIGOS (ou
  // pior, se houvesse muita recorrência futura agendada, podia cortar até os
  // de hoje) — bug que a divisão abaixo elimina de vez para o lado "ativos".
  const ativos = useQuery({
    queryKey: ["atendimentos", officeId, "ativos"],
    enabled: !!officeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("atendimentos")
        .select("*, clientes(nome)")
        .eq("office_id", officeId!)
        .in("status", ["agendado", "pendente"])
        .order("data_atendimento", { ascending: true });
      if (error) throw error;
      return naoDeletado(data);
    },
  });

  const historico = useQuery({
    queryKey: ["atendimentos", officeId, "historico"],
    enabled: !!officeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("atendimentos")
        .select("*, clientes(nome)")
        .eq("office_id", officeId!)
        .in("status", ["realizado", "cancelado"])
        .order("data_atendimento", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return naoDeletado(data);
    },
  });

  const query = {
    data: [...(ativos.data ?? []), ...(historico.data ?? [])],
    isLoading: ativos.isLoading || historico.isLoading,
    isError: ativos.isError || historico.isError,
    error: ativos.error ?? historico.error,
    refetch: () => { ativos.refetch(); historico.refetch(); },
  };

  const invalidate = useCallback(() =>
    queryClient.invalidateQueries({ queryKey: ["atendimentos", officeId] }),
    [queryClient, officeId]
  );

  const create = useMutation({
    mutationFn: async (payload: TablesInsert<"atendimentos">) => {
      const { error } = await supabase.from("atendimentos").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Atendimento registrado!" }); },
    onError: (e: Error) => toast({ title: "Erro ao criar", description: e.message, variant: "destructive" }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...payload }: TablesUpdate<"atendimentos"> & { id: string }) => {
      const { data, error } = await supabase.from("atendimentos").update(payload).eq("id", id).select("id");
      assertRowsAffected(data, error, 1);
    },
    onSuccess: () => { invalidate(); toast({ title: "Atendimento atualizado!" }); },
    onError: (e: Error) => toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.from("atendimentos").update({ deletado: true }).eq("id", id).select("id");
      assertRowsAffected(data, error, 1);
    },
    onSuccess: () => { invalidate(); toast({ title: "Atendimento excluído!" }); },
    onError: (e: Error) => toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" }),
  });

  const markRealizado = useMutation({
    mutationFn: async (item: Atendimento) => {
      const { data, error } = await supabase.from("atendimentos").update({ status: "realizado" }).eq("id", item.id).select("id");
      assertRowsAffected(data, error, 1);

      // Recorrência encadeada: ao concluir, gera a PRÓXIMA ocorrência (best-effort)
      const rule = item.recorrencia_regra as RecRule | null;
      const restantes = item.recorrencia_restantes ?? 0;
      if (rule && restantes > 0 && item.data_atendimento) {
        const base = parseISO(item.data_atendimento);
        const next = continueOccurrences(base, rule, 1)[0];
        const row: any = {
          tipo_atendimento: item.tipo_atendimento,
          data_atendimento: format(next, "yyyy-MM-dd'T'HH:mm:ss"),
          observacoes: item.observacoes ?? null,
          status: "agendado",
          cliente_id: item.cliente_id ?? null,
          processo_id: item.processo_id ?? null,
          user_id: item.user_id,
          office_id: item.office_id,
          deletado: false,
          responsavel_id: item.responsavel_id ?? null,
          duracao: item.duracao ?? null,
          recorrencia_grupo: item.recorrencia_grupo ?? null,
          recorrencia_regra: rule,
          recorrencia_restantes: restantes - 1,
          ...(Array.isArray(item.avisos_dias) ? { avisos_dias: item.avisos_dias } : {}),
        };
        await supabase.from("atendimentos").insert(row);
      }
    },
    onSuccess: () => { invalidate(); toast({ title: "Marcado como realizado!" }); },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return { query, create, update, remove, markRealizado };
};

// Tipos de atendimento personalizados do escritório (offices.settings.at_tipos_extras)
export const useAtendimentoTipos = (officeId: string) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: extras = [], isError, error, refetch } = useQuery<string[]>({
    queryKey: ["office-settings-at", officeId],
    enabled: !!officeId,
    queryFn: async () => {
      const { data, error } = await supabase.from("offices").select("settings").eq("id", officeId).maybeSingle();
      // Sem propagar o erro, a query "tinha sucesso" com lista vazia — e um save()
      // em seguida gravava essa lista vazia por cima dos tipos extras reais
      // (mesmo risco de perda de dados corrigido em useOfficeSettingList).
      if (error) throw error;
      return ((data?.settings as any)?.at_tipos_extras as string[]) ?? [];
    },
  });

  const save = useCallback(async (tipos: string[]) => {
    if (isError) {
      toast({ title: "Não foi possível salvar", description: "Os tipos extras não carregaram — recarregue antes de editar.", variant: "destructive" });
      return false;
    }
    try {
      await patchOfficeSettings(officeId, { at_tipos_extras: tipos });
    } catch (e) {
      toast({ title: "Erro ao salvar", description: getErrorMessage(e, "Não foi possível salvar."), variant: "destructive" });
      return false;
    }
    queryClient.invalidateQueries({ queryKey: ["office-settings-at", officeId] });
    return true;
  }, [officeId, queryClient, toast, isError]);

  return { extras, isError, error: isError ? getErrorMessage(error, "Não foi possível carregar os tipos extras.") : null, refetch, save };
};
