import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface Meta {
  id: string;
  titulo: string;
  tipo: string;
  periodo: string;
  valorMeta: number;
  valorAtual: number;
  status: string;
  dataInicio: string; // YYYY-MM-DD
  dataFim: string;    // YYYY-MM-DD
}

export interface NovaMetaInput {
  titulo: string;
  tipo: string;
  periodo: string;
  valorMeta: number;
  dataInicio?: Date | string;
  dataFim?: Date | string;
}

const toISODate = (d: Date) => d.toISOString().split("T")[0];

// Deriva o intervalo de datas a partir do período (quando não personalizado)
function periodToRange(periodo: string, di?: Date | string, df?: Date | string): { inicio: string; fim: string } {
  if (periodo === "personalizado" && di && df) {
    return { inicio: toISODate(new Date(di)), fim: toISODate(new Date(df)) };
  }
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (periodo) {
    case "trimestral": {
      const q = Math.floor(m / 3);
      return { inicio: toISODate(new Date(y, q * 3, 1)), fim: toISODate(new Date(y, q * 3 + 3, 0)) };
    }
    case "semestral": {
      const h = m < 6 ? 0 : 6;
      return { inicio: toISODate(new Date(y, h, 1)), fim: toISODate(new Date(y, h + 6, 0)) };
    }
    case "anual":
      return { inicio: toISODate(new Date(y, 0, 1)), fim: toISODate(new Date(y, 11, 31)) };
    case "mensal":
    default:
      return { inicio: toISODate(new Date(y, m, 1)), fim: toISODate(new Date(y, m + 1, 0)) };
  }
}

export function useMetas() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [metas, setMetas] = useState<Meta[]>([]);
  const [loading, setLoading] = useState(true);

  // Calcula o valor atingido de uma meta com base em dados reais
  const computeAtual = useCallback(async (tipo: string, inicio: string, fim: string, fallback: number): Promise<number> => {
    if (!user?.office_id) return fallback;
    const office = user.office_id;
    const startIso = `${inicio}T00:00:00`;
    const endIso = `${fim}T23:59:59`;
    try {
      switch (tipo) {
        case "receita": {
          const { data } = await supabase.from("financeiro").select("valor")
            .eq("office_id", office).eq("deletado", false).eq("tipo", "receita")
            .gte("created_at", startIso).lte("created_at", endIso);
          return (data || []).reduce((s: number, r: any) => s + (Number(r.valor) || 0), 0);
        }
        case "clientes": {
          const { count } = await supabase.from("clientes").select("id", { count: "exact", head: true })
            .eq("office_id", office).eq("deletado", false).in("status", ["ativo", "convertido"])
            .gte("created_at", startIso).lte("created_at", endIso);
          return count || 0;
        }
        case "processos": {
          const { count } = await supabase.from("processos").select("id", { count: "exact", head: true })
            .eq("office_id", office).eq("deletado", false).eq("status", "encerrado")
            .gte("updated_at", startIso).lte("updated_at", endIso);
          return count || 0;
        }
        case "audiencias": {
          const { count } = await supabase.from("audiencias").select("id", { count: "exact", head: true })
            .eq("office_id", office).eq("deletado", false).eq("status", "realizada")
            .gte("data_audiencia", startIso).lte("data_audiencia", endIso);
          return count || 0;
        }
        case "atendimentos": {
          const { count } = await supabase.from("atendimentos").select("id", { count: "exact", head: true })
            .eq("office_id", office).eq("deletado", false)
            .gte("created_at", startIso).lte("created_at", endIso);
          return count || 0;
        }
        case "prazos": {
          const { count } = await supabase.from("prazos").select("id", { count: "exact", head: true })
            .eq("office_id", office).eq("status", "concluido")
            .gte("data_fim_prazo", inicio).lte("data_fim_prazo", fim);
          return count || 0;
        }
        default:
          return fallback;
      }
    } catch {
      return fallback;
    }
  }, [user?.office_id]);

  const fetch = useCallback(async () => {
    if (!user?.office_id) { setMetas([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase.from("metas").select("*")
      .eq("deletado", false).order("created_at", { ascending: false });

    const rows = data || [];
    const withProgress = await Promise.all(rows.map(async (r: any) => {
      const valorAtual = await computeAtual(r.tipo, r.data_inicio, r.data_fim, Number(r.valor_atual) || 0);
      return {
        id: r.id, titulo: r.titulo, tipo: r.tipo, periodo: r.periodo,
        valorMeta: Number(r.valor_meta) || 0, valorAtual, status: r.status || "ativa",
        dataInicio: r.data_inicio, dataFim: r.data_fim,
      } as Meta;
    }));
    setMetas(withProgress);
    setLoading(false);
  }, [user?.office_id, computeAtual]);

  useEffect(() => { fetch(); }, [fetch]);

  const create = async (input: NovaMetaInput): Promise<boolean> => {
    if (!user?.id) return false;
    const { inicio, fim } = periodToRange(input.periodo, input.dataInicio, input.dataFim);
    const { error } = await supabase.from("metas").insert({
      user_id: user.id, office_id: user.office_id,
      titulo: input.titulo, tipo: input.tipo, periodo: input.periodo,
      valor_meta: input.valorMeta, valor_atual: 0, status: "ativa",
      data_inicio: inicio, data_fim: fim,
    });
    if (error) { toast({ title: "Erro ao criar meta", description: error.message, variant: "destructive" }); return false; }
    toast({ title: "Meta criada" });
    await fetch();
    return true;
  };

  const update = async (id: string, input: NovaMetaInput): Promise<boolean> => {
    const { inicio, fim } = periodToRange(input.periodo, input.dataInicio, input.dataFim);
    const { error } = await supabase.from("metas").update({
      titulo: input.titulo, tipo: input.tipo, periodo: input.periodo,
      valor_meta: input.valorMeta, data_inicio: inicio, data_fim: fim,
      updated_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) { toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" }); return false; }
    toast({ title: "Meta atualizada" });
    await fetch();
    return true;
  };

  const remove = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from("metas").update({ deletado: true }).eq("id", id);
    if (error) { toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" }); return false; }
    setMetas(prev => prev.filter(m => m.id !== id));
    toast({ title: "Meta excluída" });
    return true;
  };

  return { metas, loading, create, update, remove, refetch: fetch };
}
