import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Consultivo = Tables<"consultivos"> & {
  clientes?: { nome: string } | null;
};

export function useConsultivos() {
  const [data, setData] = useState<Consultivo[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchData = async () => {
    if (!user?.office_id) { setData([]); setLoading(false); return; }
    setLoading(true);
    try {
      const { data: rows, error } = await supabase
        .from("consultivos")
        .select("*, clientes(nome)")
        .eq("office_id", user.office_id)
        .eq("deletado", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setData((rows as Consultivo[]) || []);
    } catch (err) {
      toast({ title: "Erro ao carregar consultivos", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [user?.office_id]);

  const create = async (payload: Omit<TablesInsert<"consultivos">, "user_id" | "office_id">): Promise<boolean> => {
    if (!user) return false;
    try {
      const { error } = await supabase.from("consultivos").insert({
        ...payload,
        user_id: user.id,
        office_id: user.office_id,
      });
      if (error) throw error;
      await fetchData();
      toast({ title: "Consultivo criado", description: `"${payload.titulo}" adicionado.` });
      return true;
    } catch {
      toast({ title: "Erro ao criar consultivo", variant: "destructive" });
      return false;
    }
  };

  const update = async (id: string, payload: TablesUpdate<"consultivos">): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("consultivos").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      await fetchData();
      return true;
    } catch {
      toast({ title: "Erro ao atualizar", variant: "destructive" });
      return false;
    }
  };

  const remove = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("consultivos").update({ deletado: true, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      setData(prev => prev.filter(c => c.id !== id));
      toast({ title: "Consultivo removido" });
      return true;
    } catch {
      toast({ title: "Erro ao remover", variant: "destructive" });
      return false;
    }
  };

  return { data, loading, create, update, remove, refetch: fetchData };
}
