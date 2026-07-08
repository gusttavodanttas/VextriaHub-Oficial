import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Arredondamento = "nenhum" | "6" | "15";

export interface TimesheetConfig {
  valorPadrao: number | null;
  valorClientes: Record<string, number>;
  arredondamento: Arredondamento;
}

const EMPTY: TimesheetConfig = { valorPadrao: null, valorClientes: {}, arredondamento: "nenhum" };

export function useTimesheetConfig(officeId: string) {
  const queryClient = useQueryClient();

  const { data } = useQuery<TimesheetConfig>({
    queryKey: ["ts-config", officeId],
    enabled: !!officeId,
    queryFn: async () => {
      const { data } = await supabase.from("offices").select("settings").eq("id", officeId).maybeSingle();
      const s = (data?.settings as any) ?? {};
      return {
        valorPadrao: s.ts_valor_hora_padrao ?? null,
        valorClientes: s.ts_valor_hora_clientes ?? {},
        arredondamento: (s.ts_arredondamento as Arredondamento) ?? "nenhum",
      };
    },
  });

  const save = useCallback(async (cfg: Partial<TimesheetConfig>) => {
    const { data: cur } = await supabase.from("offices").select("settings").eq("id", officeId).maybeSingle();
    const merged: any = { ...((cur?.settings as any) ?? {}) };
    if (cfg.valorPadrao !== undefined) merged.ts_valor_hora_padrao = cfg.valorPadrao;
    if (cfg.valorClientes !== undefined) merged.ts_valor_hora_clientes = cfg.valorClientes;
    if (cfg.arredondamento !== undefined) merged.ts_arredondamento = cfg.arredondamento;
    await supabase.from("offices").update({ settings: merged }).eq("id", officeId);
    queryClient.invalidateQueries({ queryKey: ["ts-config", officeId] });
  }, [officeId, queryClient]);

  return { config: data ?? EMPTY, save };
}

/** Minutos arredondados para o incremento de faturamento. */
export function roundMinutes(min: number, arred: Arredondamento) {
  const inc = arred === "6" ? 6 : arred === "15" ? 15 : 0;
  return inc > 0 ? Math.ceil(min / inc) * inc : min;
}
