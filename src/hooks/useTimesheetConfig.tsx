import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errors";

export type Arredondamento = "nenhum" | "6" | "15";

export interface TimesheetConfig {
  valorPadrao: number | null;
  valorClientes: Record<string, number>;
  arredondamento: Arredondamento;
}

const EMPTY: TimesheetConfig = { valorPadrao: null, valorClientes: {}, arredondamento: "nenhum" };

export function useTimesheetConfig(officeId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isError, error, refetch } = useQuery<TimesheetConfig>({
    queryKey: ["ts-config", officeId],
    enabled: !!officeId,
    queryFn: async () => {
      const { data, error } = await supabase.from("offices").select("settings").eq("id", officeId).maybeSingle();
      // Sem propagar o erro, a query "tinha sucesso" com EMPTY — e o dialog de
      // configurações reabre pré-preenchido com os defaults; salvar dali grava
      // valorClientes: {} por cima dos valores por cliente já configurados
      // (mesmo risco de perda de dados corrigido em useOfficeSettingList).
      if (error) throw error;
      const s = (data?.settings as any) ?? {};
      return {
        valorPadrao: s.ts_valor_hora_padrao ?? null,
        valorClientes: s.ts_valor_hora_clientes ?? {},
        arredondamento: (s.ts_arredondamento as Arredondamento) ?? "nenhum",
      };
    },
  });

  const save = useCallback(async (cfg: Partial<TimesheetConfig>) => {
    if (isError) {
      toast({ title: "Não foi possível salvar", description: "A configuração não carregou — recarregue antes de editar.", variant: "destructive" });
      return false;
    }
    const { data: cur } = await supabase.from("offices").select("settings").eq("id", officeId).maybeSingle();
    const merged: any = { ...((cur?.settings as any) ?? {}) };
    if (cfg.valorPadrao !== undefined) merged.ts_valor_hora_padrao = cfg.valorPadrao;
    if (cfg.valorClientes !== undefined) merged.ts_valor_hora_clientes = cfg.valorClientes;
    if (cfg.arredondamento !== undefined) merged.ts_arredondamento = cfg.arredondamento;
    const { data: updated, error } = await supabase.from("offices").update({ settings: merged }).eq("id", officeId).select("id");
    if (error || !updated || updated.length === 0) {
      toast({
        title: "Erro ao salvar",
        description: error?.message ?? "Só um administrador do escritório pode alterar esta configuração.",
        variant: "destructive",
      });
      return false;
    }
    queryClient.invalidateQueries({ queryKey: ["ts-config", officeId] });
    return true;
  }, [officeId, queryClient, toast, isError]);

  return {
    config: data ?? EMPTY,
    isError,
    error: isError ? getErrorMessage(error, "Não foi possível carregar a configuração.") : null,
    refetch,
    save,
  };
}

/** Minutos arredondados para o incremento de faturamento. */
export function roundMinutes(min: number, arred: Arredondamento) {
  const inc = arred === "6" ? 6 : arred === "15" ? 15 : 0;
  return inc > 0 ? Math.ceil(min / inc) * inc : min;
}
