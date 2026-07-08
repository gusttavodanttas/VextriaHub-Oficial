// Dados + mutações de Atendimentos — extraído de pages/Atendimentos.tsx.
import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { continueOccurrences, type RecRule } from "@/lib/recorrencia";
import type { Atendimento } from "@/components/Atendimentos/shared";

export const useAtendimentos = (officeId: string | null | undefined) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ["atendimentos", officeId],
    enabled: !!officeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("atendimentos")
        .select("*, clientes(nome)")
        .eq("office_id", officeId!)
        .order("data_atendimento", { ascending: false });
      if (error) throw error;
      return (data ?? []).filter((i: any) => !i.deletado) as Atendimento[];
    },
  });

  const invalidate = useCallback(() =>
    queryClient.invalidateQueries({ queryKey: ["atendimentos", officeId] }),
    [queryClient, officeId]
  );

  const create = useMutation({
    mutationFn: async (payload: any) => {
      const { error } = await supabase.from("atendimentos").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Atendimento registrado!" }); },
    onError: (e: Error) => toast({ title: "Erro ao criar", description: e.message, variant: "destructive" }),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...payload }: any) => {
      const { error } = await supabase.from("atendimentos").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Atendimento atualizado!" }); },
    onError: (e: Error) => toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("atendimentos").update({ deletado: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Atendimento excluído!" }); },
    onError: (e: Error) => toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" }),
  });

  const markRealizado = useMutation({
    mutationFn: async (item: Atendimento) => {
      const { error } = await supabase.from("atendimentos").update({ status: "realizado" }).eq("id", item.id);
      if (error) throw error;

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

  const { data: extras = [] } = useQuery<string[]>({
    queryKey: ["office-settings-at", officeId],
    enabled: !!officeId,
    queryFn: async () => {
      const { data } = await supabase.from("offices").select("settings").eq("id", officeId).maybeSingle();
      return ((data?.settings as any)?.at_tipos_extras as string[]) ?? [];
    },
  });

  const save = useCallback(async (tipos: string[]) => {
    const { data: cur } = await supabase.from("offices").select("settings").eq("id", officeId).maybeSingle();
    const merged = { ...(cur?.settings as any ?? {}), at_tipos_extras: tipos };
    await supabase.from("offices").update({ settings: merged }).eq("id", officeId);
    queryClient.invalidateQueries({ queryKey: ["office-settings-at", officeId] });
  }, [officeId, queryClient]);

  return { extras, save };
};
