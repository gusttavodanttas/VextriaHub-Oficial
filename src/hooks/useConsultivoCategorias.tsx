import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Tables } from "@/integrations/supabase/types";
import { assertRowsAffected, getErrorMessage } from "@/lib/errors";

export type ConsultivoCategoria = Tables<"consultivo_categorias">;

export function useConsultivoCategorias() {
  const [data, setData] = useState<ConsultivoCategoria[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetch = async () => {
    if (!user?.office_id) { setData([]); setLoading(false); return; }
    setLoading(true);
    const { data: rows } = await supabase
      .from("consultivo_categorias")
      .select("*")
      .eq("office_id", user.office_id)
      .order("ordem")
      .order("created_at");
    setData(rows || []);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, [user?.office_id]);

  const create = async (label: string, cor: string, icone: string): Promise<boolean> => {
    if (!user?.office_id) return false;
    const valor = label.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    const { error } = await supabase.from("consultivo_categorias").insert({
      office_id: user.office_id, label, valor, cor, icone,
      ordem: data.length,
    });
    if (error) { toast({ title: "Erro ao criar categoria", description: getErrorMessage(error), variant: "destructive" }); return false; }
    await fetch();
    toast({ title: "Categoria criada" });
    return true;
  };

  const update = async (id: string, label: string, cor: string, icone: string): Promise<boolean> => {
    const valor = label.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    // RLS bloqueada em UPDATE não gera erro, só casa 0 linhas — sem o
    // .select('id'), a UI dizia "atualizada" com o registro intocado.
    const { data: rows, error } = await supabase.from("consultivo_categorias").update({ label, valor, cor, icone }).eq("id", id).select("id");
    try {
      assertRowsAffected(rows, error, 1);
    } catch (e) {
      toast({ title: "Erro ao atualizar", description: getErrorMessage(e), variant: "destructive" });
      return false;
    }
    await fetch();
    toast({ title: "Categoria atualizada" });
    return true;
  };

  const remove = async (id: string): Promise<boolean> => {
    // Mesmo padrão do update acima — RLS bloqueada em DELETE não gera erro.
    const { data: rows, error } = await supabase.from("consultivo_categorias").delete().eq("id", id).select("id");
    try {
      assertRowsAffected(rows, error, 1);
    } catch (e) {
      toast({ title: "Erro ao excluir", description: getErrorMessage(e), variant: "destructive" });
      return false;
    }
    setData(prev => prev.filter(c => c.id !== id));
    toast({ title: "Categoria removida" });
    return true;
  };

  return { data, loading, create, update, remove, refetch: fetch };
}
